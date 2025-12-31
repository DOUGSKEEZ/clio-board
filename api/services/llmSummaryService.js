const pool = require('../db/pool');
const { logger } = require('../middleware/logger');

/**
 * LLM Summary Service
 * Provides concise, context-efficient endpoints optimized for LLM consumption.
 * Target: 500-1000 characters per response.
 */
class LLMSummaryService {
  /**
   * Truncate string at word boundary
   * @param {string} str - String to truncate
   * @param {number} maxLen - Maximum length
   * @returns {string} Truncated string
   */
  truncate(str, maxLen = 50) {
    if (!str || str.length <= maxLen) return str;
    const truncated = str.substring(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  }

  /**
   * Get tasks summary grouped by column
   * @param {Object} options - Query options
   * @returns {Object} Tasks summary
   */
  async getTasksSummary(options = {}) {
    const { limit = 5, columns = null, routine = null } = options;

    try {
      let query = `
        SELECT
          t.id,
          t.title,
          t.column_name,
          t.due_date,
          t.position,
          r.title as routine_title
        FROM tasks t
        LEFT JOIN routines r ON t.routine_id = r.id
        WHERE t.is_archived = false
      `;

      const values = [];
      let paramCount = 0;

      if (columns) {
        const columnList = columns.split(',').map(c => c.trim().toLowerCase().replace(' ', '_'));
        query += ` AND t.column_name = ANY($${++paramCount}::text[])`;
        values.push(columnList);
      }

      if (routine) {
        query += ` AND (r.id::text = $${++paramCount} OR r.title ILIKE $${++paramCount})`;
        values.push(routine, `%${routine}%`);
        paramCount++;
      }

      query += ' ORDER BY t.column_name, t.position';

      const result = await pool.query(query, values);
      const tasks = result.rows;

      // Group by column
      const byColumn = {};
      const columnOrder = ['today', 'tomorrow', 'this_week', 'horizon'];

      for (const col of columnOrder) {
        const colTasks = tasks
          .filter(t => t.column_name === col)
          .slice(0, limit)
          .map(t => ({
            id: t.id,
            title: this.truncate(t.title, 60),
            due: t.due_date ? t.due_date.toISOString().split('T')[0] : null,
            routine: t.routine_title || null
          }));

        if (colTasks.length > 0) {
          // Convert column_name to display format
          const displayName = col.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
          byColumn[displayName] = colTasks;
        }
      }

      // Calculate overdue and due this week
      const now = new Date();
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now).length;
      const dueThisWeek = tasks.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate >= now && dueDate <= weekFromNow;
      }).length;

      return {
        total: tasks.length,
        byColumn,
        overdue,
        dueThisWeek
      };
    } catch (error) {
      logger.error('Error getting tasks summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Get notes summary with previews
   * @param {Object} options - Query options
   * @returns {Object} Notes summary
   */
  async getNotesSummary(options = {}) {
    const { limit = 10, previewLength = 50, routine = null } = options;

    try {
      let query = `
        SELECT
          n.id,
          n.title,
          n.content,
          r.title as routine_title
        FROM notes n
        LEFT JOIN routines r ON n.routine_id = r.id
        WHERE n.is_archived = false
      `;

      const values = [];
      let paramCount = 0;

      if (routine) {
        query += ` AND (r.id::text = $${++paramCount} OR r.title ILIKE $${++paramCount})`;
        values.push(routine, `%${routine}%`);
        paramCount++;
      }

      query += ' ORDER BY n.updated_at DESC';
      query += ` LIMIT $${++paramCount}`;
      values.push(limit);

      const result = await pool.query(query, values);

      // Get total count
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM notes WHERE is_archived = false'
      );
      const total = parseInt(countResult.rows[0].count);

      const items = result.rows.map(n => ({
        id: n.id,
        title: n.title || '(Untitled)',
        preview: this.truncate(n.content, previewLength),
        routine: n.routine_title || null
      }));

      return { total, items };
    } catch (error) {
      logger.error('Error getting notes summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Get routines summary with their tasks and notes
   * @param {Object} options - Query options
   * @returns {Object} Routines summary
   */
  async getRoutinesSummary(options = {}) {
    const { includeItems = true, itemLimit = 3 } = options;

    try {
      const routinesQuery = `
        SELECT
          r.id,
          r.title,
          r.status,
          r.icon
        FROM routines r
        WHERE r.is_archived = false
        ORDER BY r.display_order, r.created_at DESC
      `;

      const routinesResult = await pool.query(routinesQuery);
      const routines = routinesResult.rows;

      const items = [];
      let activeCount = 0;

      for (const routine of routines) {
        if (routine.status === 'active') activeCount++;

        const item = {
          id: routine.id,
          name: routine.title,
          status: routine.status,
          icon: routine.icon
        };

        if (includeItems) {
          // Get tasks for this routine
          const tasksResult = await pool.query(`
            SELECT id, title, column_name
            FROM tasks
            WHERE routine_id = $1 AND is_archived = false
            ORDER BY position
            LIMIT $2
          `, [routine.id, itemLimit]);

          item.tasks = tasksResult.rows.map(t => ({
            id: t.id,
            title: this.truncate(t.title, 40),
            column: t.column_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
          }));

          // Get notes for this routine
          const notesResult = await pool.query(`
            SELECT id, title
            FROM notes
            WHERE routine_id = $1 AND is_archived = false
            ORDER BY updated_at DESC
            LIMIT $2
          `, [routine.id, itemLimit]);

          item.notes = notesResult.rows.map(n => ({
            id: n.id,
            title: this.truncate(n.title || '(Untitled)', 40)
          }));
        }

        items.push(item);
      }

      return {
        total: routines.length,
        active: activeCount,
        items
      };
    } catch (error) {
      logger.error('Error getting routines summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Get single routine detail summary
   * @param {string} routineId - Routine UUID
   * @returns {Object} Routine summary
   */
  async getRoutineSummary(routineId) {
    try {
      const routineQuery = `
        SELECT id, title, status, icon
        FROM routines
        WHERE id = $1
      `;
      const routineResult = await pool.query(routineQuery, [routineId]);

      if (routineResult.rows.length === 0) {
        return null;
      }

      const routine = routineResult.rows[0];

      // Get tasks for this routine
      const tasksResult = await pool.query(`
        SELECT id, title, column_name, due_date
        FROM tasks
        WHERE routine_id = $1 AND is_archived = false
        ORDER BY column_name, position
      `, [routineId]);

      // Get notes for this routine
      const notesResult = await pool.query(`
        SELECT id, title, content
        FROM notes
        WHERE routine_id = $1 AND is_archived = false
        ORDER BY updated_at DESC
      `, [routineId]);

      return {
        id: routine.id,
        name: routine.title,
        status: routine.status,
        icon: routine.icon,
        taskCount: tasksResult.rows.length,
        noteCount: notesResult.rows.length,
        tasks: tasksResult.rows.map(t => ({
          id: t.id,
          title: this.truncate(t.title, 50),
          column: t.column_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          due: t.due_date ? t.due_date.toISOString().split('T')[0] : null
        })),
        notes: notesResult.rows.map(n => ({
          id: n.id,
          title: this.truncate(n.title || '(Untitled)', 40),
          preview: this.truncate(n.content, 50)
        }))
      };
    } catch (error) {
      logger.error('Error getting routine summary', { error: error.message, routineId });
      throw error;
    }
  }

  /**
   * Get note excerpt
   * @param {string} noteId - Note UUID
   * @param {number} excerptLength - Max excerpt length
   * @returns {Object} Note with excerpt
   */
  async getNoteExcerpt(noteId, excerptLength = 300) {
    try {
      const query = `
        SELECT n.id, n.title, n.content, n.updated_at,
               r.title as routine_title
        FROM notes n
        LEFT JOIN routines r ON n.routine_id = r.id
        WHERE n.id = $1
      `;
      const result = await pool.query(query, [noteId]);

      if (result.rows.length === 0) {
        return null;
      }

      const note = result.rows[0];
      const wordCount = note.content ? note.content.split(/\s+/).length : 0;

      return {
        id: note.id,
        title: note.title || '(Untitled)',
        routine: note.routine_title || null,
        excerpt: this.truncate(note.content, excerptLength),
        wordCount,
        lastModified: note.updated_at
      };
    } catch (error) {
      logger.error('Error getting note excerpt', { error: error.message, noteId });
      throw error;
    }
  }

  /**
   * Get task context (full detail for single task)
   * @param {string} taskId - Task UUID
   * @returns {Object} Task context
   */
  async getTaskContext(taskId) {
    try {
      const query = `
        SELECT t.id, t.title, t.notes, t.column_name, t.due_date, t.created_at,
               r.title as routine_title,
               COALESCE(
                 (SELECT json_agg(
                   json_build_object('text', li.title, 'done', li.completed)
                   ORDER BY li.position
                 )
                 FROM list_items li
                 WHERE li.task_id = t.id), '[]'::json
               ) as checklist
        FROM tasks t
        LEFT JOIN routines r ON t.routine_id = r.id
        WHERE t.id = $1
      `;
      const result = await pool.query(query, [taskId]);

      if (result.rows.length === 0) {
        return null;
      }

      const task = result.rows[0];

      return {
        id: task.id,
        title: task.title,
        description: task.notes || null,
        column: task.column_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        routine: task.routine_title || null,
        due: task.due_date ? task.due_date.toISOString().split('T')[0] : null,
        created: task.created_at.toISOString().split('T')[0],
        checklist: task.checklist || []
      };
    } catch (error) {
      logger.error('Error getting task context', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * Cross-entity search
   * Supports both full (user) and summary (LLM) modes
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  async search(searchQuery, options = {}) {
    const {
      type = null,
      limit = null,
      summary = false  // LLM mode: concise responses
    } = options;

    // Default limits based on mode
    const effectiveLimit = limit || (summary ? 5 : 15);

    try {
      const results = { tasks: [], notes: [], routines: [] };
      let totalHits = 0;

      // Search tasks
      if (!type || type === 'tasks') {
        const tasksQuery = `
          SELECT t.id, t.title, t.column_name, t.due_date, t.notes, t.updated_at,
                 r.title as routine_title
          FROM tasks t
          LEFT JOIN routines r ON t.routine_id = r.id
          WHERE t.is_archived = false
            AND (t.title ILIKE $1 OR t.notes ILIKE $1)
          ORDER BY t.updated_at DESC
          LIMIT $2
        `;
        const tasksResult = await pool.query(tasksQuery, [`%${searchQuery}%`, effectiveLimit]);

        results.tasks = tasksResult.rows.map(t => {
          const base = {
            id: t.id,
            title: summary ? this.truncate(t.title, 50) : t.title,
            column: t.column_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            routine: t.routine_title || null
          };

          // Full mode includes more fields
          if (!summary) {
            base.due = t.due_date ? t.due_date.toISOString().split('T')[0] : null;
            base.notes = t.notes || null;
            base.updatedAt = t.updated_at;
          }

          return base;
        });
        totalHits += tasksResult.rows.length;
      }

      // Search notes
      if (!type || type === 'notes') {
        const notesQuery = `
          SELECT n.id, n.title, n.content, n.updated_at, n.type, n.source,
                 r.title as routine_title
          FROM notes n
          LEFT JOIN routines r ON n.routine_id = r.id
          WHERE n.is_archived = false
            AND (n.title ILIKE $1 OR n.content ILIKE $1)
          ORDER BY n.updated_at DESC
          LIMIT $2
        `;
        const notesResult = await pool.query(notesQuery, [`%${searchQuery}%`, effectiveLimit]);

        results.notes = notesResult.rows.map(n => {
          const base = {
            id: n.id,
            title: summary ? this.truncate(n.title || '(Untitled)', 40) : (n.title || '(Untitled)'),
            routine: n.routine_title || null
          };

          if (summary) {
            base.preview = this.truncate(n.content, 50);
          } else {
            base.content = n.content;
            base.type = n.type;
            base.source = n.source;
            base.updatedAt = n.updated_at;
          }

          return base;
        });
        totalHits += notesResult.rows.length;
      }

      // Search routines
      if (!type || type === 'routines') {
        const routinesQuery = `
          SELECT id, title, description, status, icon, updated_at
          FROM routines
          WHERE is_archived = false
            AND (title ILIKE $1 OR description ILIKE $1)
          ORDER BY updated_at DESC
          LIMIT $2
        `;
        const routinesResult = await pool.query(routinesQuery, [`%${searchQuery}%`, effectiveLimit]);

        results.routines = routinesResult.rows.map(r => {
          const base = {
            id: r.id,
            name: r.title,
            status: r.status
          };

          if (!summary) {
            base.description = r.description;
            base.icon = r.icon;
            base.updatedAt = r.updated_at;
          }

          return base;
        });
        totalHits += routinesResult.rows.length;
      }

      return {
        query: searchQuery,
        results,
        totalHits
      };
    } catch (error) {
      logger.error('Error in search', { error: error.message, searchQuery });
      throw error;
    }
  }
}

module.exports = new LLMSummaryService();
