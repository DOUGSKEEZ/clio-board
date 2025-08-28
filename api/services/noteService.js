const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../middleware/logger');
const taskService = require('./taskService');

class NoteService {
  /**
   * Get all active notes
   * @param {Object} filters - Optional filters (type, column_position)
   * @returns {Array} Array of notes
   */
  async getNotes(filters = {}) {
    try {
      let query = `
        SELECT n.*,
               t.title as task_title,
               r.title as routine_title
        FROM notes n
        LEFT JOIN tasks t ON n.task_id = t.id
        LEFT JOIN routines r ON n.routine_id = r.id
        WHERE n.is_archived = false
      `;

      const values = [];
      let paramCount = 0;

      if (filters.type) {
        query += ` AND n.type = $${++paramCount}`;
        values.push(filters.type);
      }

      if (filters.column_position) {
        query += ` AND n.column_position = $${++paramCount}`;
        values.push(filters.column_position);
      }

      if (filters.routine_id) {
        query += ` AND n.routine_id = $${++paramCount}`;
        values.push(filters.routine_id);
      }

      query += ' ORDER BY n.column_position, n.position, n.created_at DESC';

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching notes', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all archived notes
   * @returns {Array} Array of archived notes
   */
  async getArchivedNotes() {
    try {
      const query = `
        SELECT n.*,
               t.title as task_title,
               r.title as routine_title
        FROM notes n
        LEFT JOIN tasks t ON n.task_id = t.id
        LEFT JOIN routines r ON n.routine_id = r.id
        WHERE n.is_archived = true
        ORDER BY n.archived_at DESC, n.created_at DESC
      `;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching archived notes', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a single note by ID
   * @param {String} noteId - Note UUID
   * @returns {Object} Note
   */
  async getNoteById(noteId) {
    try {
      const query = `
        SELECT n.*,
               t.title as task_title,
               r.title as routine_title
        FROM notes n
        LEFT JOIN tasks t ON n.task_id = t.id
        LEFT JOIN routines r ON n.routine_id = r.id
        WHERE n.id = $1
      `;

      const result = await pool.query(query, [noteId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching note by ID', { error: error.message, noteId });
      throw error;
    }
  }

  /**
   * Create a new note
   * @param {Object} noteData - Note data
   * @returns {Object} Created note
   */
  async createNote(noteData) {
    try {
      const id = uuidv4();
      
      // Determine column position based on type
      let columnPosition = noteData.column_position;
      if (!columnPosition) {
        // Default: user notes in column 1, agent notes in column 3
        columnPosition = noteData.type === 'agent' ? 3 : 1;
      }

      const query = `
        INSERT INTO notes (
          id, title, content, type, source, 
          column_position, task_id, routine_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *
      `;

      const values = [
        id,
        noteData.title || null,
        noteData.content,
        noteData.type || 'user',
        noteData.source || 'manual',
        columnPosition,
        noteData.task_id || null,
        noteData.routine_id || null
      ];

      const result = await pool.query(query, values);
      logger.info('Note created', { 
        noteId: id, 
        type: noteData.type, 
        source: noteData.source 
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating note', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a note
   * @param {String} noteId - Note ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated note
   */
  async updateNote(noteId, updates) {
    try {
      const allowedFields = ['title', 'content', 'column_position', 'routine_id', 'task_id'];
      const setClause = [];
      const values = [];
      let paramCount = 1;

      for (const field of allowedFields) {
        if (updates.hasOwnProperty(field)) {
          setClause.push(`${field} = $${paramCount++}`);
          values.push(updates[field]);
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(noteId);
      const query = `
        UPDATE notes 
        SET ${setClause.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      logger.info('Note updated', { noteId, updates });
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating note', { error: error.message, noteId });
      throw error;
    }
  }

  /**
   * Archive a note
   * @param {String} noteId - Note ID
   * @returns {Object} Archived note
   */
  async archiveNote(noteId) {
    try {
      const query = `
        UPDATE notes
        SET is_archived = true,
            archived_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [noteId]);
      logger.info('Note archived', { noteId });
      return result.rows[0];
    } catch (error) {
      logger.error('Error archiving note', { error: error.message, noteId });
      throw error;
    }
  }

  /**
   * Restore an archived note
   * @param {String} noteId - Note ID
   * @returns {Object} Restored note
   */
  async restoreNote(noteId) {
    try {
      const query = `
        UPDATE notes
        SET is_archived = false,
            archived_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [noteId]);
      logger.info('Note restored', { noteId });
      return result.rows[0];
    } catch (error) {
      logger.error('Error restoring note', { error: error.message, noteId });
      throw error;
    }
  }

  /**
   * Convert a note to a task
   * @param {String} noteId - Note ID
   * @param {Object} taskData - Additional task data
   * @returns {Object} Created task and archived note
   */
  async convertToTask(noteId, taskData = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the note
      const noteQuery = 'SELECT * FROM notes WHERE id = $1';
      const noteResult = await client.query(noteQuery, [noteId]);
      
      if (noteResult.rows.length === 0) {
        throw new Error('Note not found');
      }

      const note = noteResult.rows[0];

      // Create task from note
      const task = await taskService.createTask({
        title: taskData.title || note.title || 'Task from note',
        notes: note.content,
        routine_id: taskData.routine_id || note.routine_id,
        column_name: taskData.column_name || 'today',
        due_date: taskData.due_date || null
      });

      // Archive the note (but keep it for reference)
      await client.query(
        'UPDATE notes SET is_archived = true, archived_at = NOW(), task_id = $1 WHERE id = $2',
        [task.id, noteId]
      );

      await client.query('COMMIT');
      
      logger.info('Note converted to task', { 
        noteId, 
        taskId: task.id,
        title: task.title 
      });

      return {
        task,
        archivedNote: { ...note, is_archived: true, task_id: task.id }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error converting note to task', { error: error.message, noteId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a note permanently (only for agents that can't delete tasks)
   * @param {String} noteId - Note ID
   * @returns {Boolean} Success
   */
  async deleteNote(noteId) {
    try {
      const query = 'DELETE FROM notes WHERE id = $1 RETURNING id';
      const result = await pool.query(query, [noteId]);
      
      if (result.rows.length === 0) {
        throw new Error('Note not found');
      }

      logger.info('Note deleted permanently', { noteId });
      return true;
    } catch (error) {
      logger.error('Error deleting note', { error: error.message, noteId });
      throw error;
    }
  }

  /**
   * Move note to different column
   * @param {String} noteId - Note ID
   * @param {Number} newColumn - New column position (1-4)
   * @param {Number} newPosition - Position within the column
   * @returns {Object} Updated note
   */
  async moveNote(noteId, newColumn, newPosition = null) {
    try {
      if (newColumn < 1 || newColumn > 4) {
        throw new Error('Column position must be between 1 and 4');
      }

      let query;
      let values;
      
      if (newPosition !== null && newPosition !== undefined) {
        query = `
          UPDATE notes
          SET column_position = $1, position = $2, updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `;
        values = [newColumn, newPosition, noteId];
      } else {
        query = `
          UPDATE notes
          SET column_position = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `;
        values = [newColumn, noteId];
      }

      const result = await pool.query(query, values);
      logger.info('Note moved', { noteId, newColumn, newPosition });
      return result.rows[0];
    } catch (error) {
      logger.error('Error moving note', { error: error.message, noteId });
      throw error;
    }
  }
}

module.exports = new NoteService();