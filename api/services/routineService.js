const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../middleware/logger');

class RoutineService {
  /**
   * Get all active routines
   * @param {Object} filters - Optional filters (status, type)
   * @returns {Array} Array of routines
   */
  async getRoutines(filters = {}) {
    try {
      let query = `
        SELECT r.*,
               COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending') as pending_tasks,
               COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks
        FROM routines r
        LEFT JOIN tasks t ON r.id = t.routine_id
        WHERE r.status != 'archived'
      `;

      const values = [];
      let paramCount = 0;

      if (filters.status) {
        query += ` AND r.status = $${++paramCount}`;
        values.push(filters.status);
      }

      if (filters.type) {
        query += ` AND r.type = $${++paramCount}`;
        values.push(filters.type);
      }

      query += ' GROUP BY r.id ORDER BY r.created_at DESC';

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching routines', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a single routine by ID
   * @param {String} routineId - Routine UUID
   * @returns {Object} Routine with task count
   */
  async getRoutineById(routineId) {
    try {
      const query = `
        SELECT r.*,
               COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending') as pending_tasks,
               COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks
        FROM routines r
        LEFT JOIN tasks t ON r.id = t.routine_id
        WHERE r.id = $1
        GROUP BY r.id
      `;

      const result = await pool.query(query, [routineId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching routine by ID', { error: error.message, routineId });
      throw error;
    }
  }

  /**
   * Get all tasks for a routine (mini-board view)
   * @param {String} routineId - Routine UUID
   * @returns {Array} Tasks associated with the routine
   */
  async getRoutineTasks(routineId) {
    try {
      const query = `
        SELECT t.*,
               COALESCE(
                 CASE WHEN t.type = 'list' THEN (
                   SELECT json_agg(
                     json_build_object(
                       'id', li.id,
                       'title', li.title,
                       'completed', li.completed,
                       'position', li.position
                     ) ORDER BY li.position
                   )
                   FROM list_items li
                   WHERE li.task_id = t.id
                 ) END, '[]'::json
               ) as items
        FROM tasks t
        WHERE t.routine_id = $1
        ORDER BY t.column_name, t.position
      `;

      const result = await pool.query(query, [routineId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching routine tasks', { error: error.message, routineId });
      throw error;
    }
  }

  /**
   * Create a new routine
   * @param {Object} routineData - Routine data
   * @returns {Object} Created routine
   */
  async createRoutine(routineData) {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO routines (
          id, title, description, color, icon, type, 
          status, achievable
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *
      `;

      const values = [
        id,
        routineData.title,
        routineData.description || null,
        routineData.color || '#3498db',
        routineData.icon || '📌',
        routineData.type || 'project',
        'active',
        routineData.achievable || false
      ];

      const result = await pool.query(query, values);
      logger.info('Routine created', { routineId: id, title: routineData.title });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating routine', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a routine
   * @param {String} routineId - Routine ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated routine
   */
  async updateRoutine(routineId, updates) {
    try {
      const allowedFields = ['title', 'description', 'color', 'icon', 'type', 'status', 'achievable'];
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

      values.push(routineId);
      const query = `
        UPDATE routines 
        SET ${setClause.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      logger.info('Routine updated', { routineId, updates });
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating routine', { error: error.message, routineId });
      throw error;
    }
  }

  /**
   * Pause a routine
   * @param {String} routineId - Routine ID
   * @param {Date} pauseUntil - When to resume (optional)
   * @returns {Object} Updated routine
   */
  async pauseRoutine(routineId, pauseUntil = null) {
    try {
      const query = `
        UPDATE routines
        SET status = 'paused', 
            pause_until = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await pool.query(query, [pauseUntil, routineId]);
      logger.info('Routine paused', { routineId, pauseUntil });
      return result.rows[0];
    } catch (error) {
      logger.error('Error pausing routine', { error: error.message, routineId });
      throw error;
    }
  }

  /**
   * Archive a routine
   * @param {String} routineId - Routine ID
   * @returns {Object} Archived routine
   */
  async archiveRoutine(routineId) {
    try {
      const query = `
        UPDATE routines
        SET status = 'archived', 
            archived_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [routineId]);
      logger.info('Routine archived', { routineId });
      return result.rows[0];
    } catch (error) {
      logger.error('Error archiving routine', { error: error.message, routineId });
      throw error;
    }
  }

  /**
   * Complete a routine (only for achievable routines)
   * @param {String} routineId - Routine ID
   * @returns {Object} Completed routine
   */
  async completeRoutine(routineId) {
    try {
      // Check if routine is achievable
      const routine = await this.getRoutineById(routineId);
      if (!routine) {
        throw new Error('Routine not found');
      }
      
      if (!routine.achievable) {
        throw new Error('Routine is not marked as achievable');
      }

      const query = `
        UPDATE routines
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [routineId]);
      logger.info('Routine completed', { routineId });
      return result.rows[0];
    } catch (error) {
      logger.error('Error completing routine', { error: error.message, routineId });
      throw error;
    }
  }

  /**
   * Restore an archived routine
   * @param {String} routineId - Routine ID
   * @returns {Object} Restored routine
   */
  async restoreRoutine(routineId) {
    try {
      const query = `
        UPDATE routines
        SET status = 'active',
            archived_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [routineId]);
      logger.info('Routine restored', { routineId });
      return result.rows[0];
    } catch (error) {
      logger.error('Error restoring routine', { error: error.message, routineId });
      throw error;
    }
  }
}

module.exports = new RoutineService();