const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../middleware/logger');

class TaskService {
  /**
   * Get all active tasks (not archived)
   * @param {Object} filters - Optional filters (column, routine_id)
   * @returns {Array} Array of tasks with their items if type='list'
   */
  async getTasks(filters = {}) {
    try {
      let query = `
        SELECT t.*, 
               r.title as routine_title,
               r.color as routine_color,
               r.icon as routine_icon,
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
        LEFT JOIN routines r ON t.routine_id = r.id
        WHERE t.status != 'archived'
      `;

      const values = [];
      let paramCount = 0;

      if (filters.column) {
        query += ` AND t.column_name = $${++paramCount}`;
        values.push(filters.column);
      }

      if (filters.routine_id) {
        query += ` AND t.routine_id = $${++paramCount}`;
        values.push(filters.routine_id);
      }

      query += ' ORDER BY t.column_name, t.position';

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching tasks', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a single task by ID
   * @param {String} taskId - Task UUID
   * @returns {Object} Task with items if type='list'
   */
  async getTaskById(taskId) {
    try {
      const query = `
        SELECT t.*, 
               r.title as routine_title,
               r.color as routine_color,
               r.icon as routine_icon,
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
        LEFT JOIN routines r ON t.routine_id = r.id
        WHERE t.id = $1
      `;

      const result = await pool.query(query, [taskId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching task by ID', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * Create a new task (always starts as type='task')
   * @param {Object} taskData - Task data
   * @returns {Object} Created task
   */
  async createTask(taskData) {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO tasks (
          id, routine_id, title, notes, type, status, 
          due_date, due_time, position, column_name
        ) VALUES (
          $1, $2, $3, $4, 'task', 'pending', 
          $5, $6, $7, $8
        ) RETURNING *
      `;

      // Get next position for the column
      const position = await this.getNextPosition(taskData.column_name || 'today');

      const values = [
        id,
        taskData.routine_id || null,
        taskData.title,
        taskData.notes || null,
        taskData.due_date || null,
        taskData.due_time || null,
        position,
        taskData.column_name || 'today'
      ];

      const result = await pool.query(query, values);
      logger.info('Task created', { taskId: id, title: taskData.title });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating task', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a task
   * @param {String} taskId - Task ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated task
   */
  async updateTask(taskId, updates) {
    try {
      // Build dynamic UPDATE query
      const allowedFields = ['title', 'notes', 'routine_id', 'due_date', 'due_time', 'column_name', 'position'];
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

      values.push(taskId);
      const query = `
        UPDATE tasks 
        SET ${setClause.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      logger.info('Task updated', { taskId, updates });
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating task', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * Archive a task (preserves list items if type='list')
   * @param {String} taskId - Task ID
   * @returns {Object} Archived task
   */
  async archiveTask(taskId) {
    try {
      // Get task with items
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      let archivedItems = null;
      if (task.type === 'list' && task.items && task.items.length > 0) {
        // Preserve items as snapshot
        archivedItems = JSON.stringify(task.items);
      }

      const query = `
        UPDATE tasks
        SET status = 'archived', 
            archived_at = NOW(),
            archived_items = $1
        WHERE id = $2
        RETURNING *
      `;

      const result = await pool.query(query, [archivedItems, taskId]);
      logger.info('Task archived', { taskId, hadItems: !!archivedItems });
      return result.rows[0];
    } catch (error) {
      logger.error('Error archiving task', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * Complete a task (marks complete, then archives)
   * @param {String} taskId - Task ID
   * @returns {Object} Completed task
   */
  async completeTask(taskId) {
    try {
      // First mark as completed
      const completeQuery = `
        UPDATE tasks
        SET status = 'completed', 
            completed_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      await pool.query(completeQuery, [taskId]);
      
      // Then archive it
      const archivedTask = await this.archiveTask(taskId);
      logger.info('Task completed and archived', { taskId });
      return archivedTask;
    } catch (error) {
      logger.error('Error completing task', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * Add item to task (auto-converts task to list)
   * @param {String} taskId - Task ID
   * @param {Object} itemData - Item data
   * @returns {Object} Created item
   */
  async addItemToTask(taskId, itemData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the task
      const taskQuery = 'SELECT type FROM tasks WHERE id = $1';
      const taskResult = await client.query(taskQuery, [taskId]);
      
      if (taskResult.rows.length === 0) {
        throw new Error('Task not found');
      }

      const task = taskResult.rows[0];

      // Auto-convert task to list if needed
      if (task.type === 'task') {
        await client.query(
          'UPDATE tasks SET type = $1 WHERE id = $2',
          ['list', taskId]
        );
        logger.debug('Task converted to list', { taskId });
      }

      // Get next position for the item
      const positionResult = await client.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM list_items WHERE task_id = $1',
        [taskId]
      );
      const position = positionResult.rows[0].next_position;

      // Add the item
      const itemId = uuidv4();
      const insertQuery = `
        INSERT INTO list_items (id, task_id, title, completed, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const itemResult = await client.query(insertQuery, [
        itemId,
        taskId,
        itemData.title,
        false,
        position
      ]);

      await client.query('COMMIT');
      
      logger.info('Item added to task', { taskId, itemId, title: itemData.title });
      return itemResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding item to task', { error: error.message, taskId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update a list item (check/uncheck or edit title)
   * @param {String} taskId - Task ID
   * @param {String} itemId - Item ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated item
   */
  async updateItem(taskId, itemId, updates) {
    try {
      const allowedFields = ['title', 'completed', 'position'];
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

      values.push(itemId);
      values.push(taskId);

      const query = `
        UPDATE list_items
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount} AND task_id = $${paramCount + 1}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      logger.info('Item updated', { taskId, itemId, updates });
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating item', { error: error.message, taskId, itemId });
      throw error;
    }
  }

  /**
   * Delete an item (auto-converts list to task if last item)
   * @param {String} taskId - Task ID
   * @param {String} itemId - Item ID
   * @returns {Boolean} Success
   */
  async deleteItem(taskId, itemId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete the item
      const deleteQuery = 'DELETE FROM list_items WHERE id = $1 AND task_id = $2';
      const deleteResult = await client.query(deleteQuery, [itemId, taskId]);

      if (deleteResult.rowCount === 0) {
        throw new Error('Item not found');
      }

      // Check if any items remain
      const countQuery = 'SELECT COUNT(*) as count FROM list_items WHERE task_id = $1';
      const countResult = await client.query(countQuery, [taskId]);
      const remainingItems = parseInt(countResult.rows[0].count);

      // Auto-convert list back to task if no items remain
      if (remainingItems === 0) {
        await client.query(
          'UPDATE tasks SET type = $1 WHERE id = $2',
          ['task', taskId]
        );
        logger.debug('List converted back to task', { taskId });
      }

      await client.query('COMMIT');
      
      logger.info('Item deleted', { taskId, itemId, remainingItems });
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting item', { error: error.message, taskId, itemId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get items for a task
   * @param {String} taskId - Task ID
   * @returns {Array} List items
   */
  async getItems(taskId) {
    try {
      const query = `
        SELECT * FROM list_items
        WHERE task_id = $1
        ORDER BY position
      `;
      const result = await pool.query(query, [taskId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching items', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * Helper: Get next position for a column
   * @param {String} column - Column name
   * @returns {Number} Next position
   */
  async getNextPosition(column) {
    const query = `
      SELECT COALESCE(MAX(position), 0) + 1 as next_position
      FROM tasks
      WHERE column_name = $1 AND status != 'archived'
    `;
    const result = await pool.query(query, [column]);
    return result.rows[0].next_position;
  }

  /**
   * Move task to different column or position
   * @param {String} taskId - Task ID
   * @param {String} newColumn - New column
   * @param {Number} newPosition - New position (optional)
   * @returns {Object} Updated task
   */
  async moveTask(taskId, newColumn, newPosition = null) {
    try {
      if (!newPosition) {
        newPosition = await this.getNextPosition(newColumn);
      }

      const query = `
        UPDATE tasks
        SET column_name = $1, position = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await pool.query(query, [newColumn, newPosition, taskId]);
      logger.info('Task moved', { taskId, newColumn, newPosition });
      return result.rows[0];
    } catch (error) {
      logger.error('Error moving task', { error: error.message, taskId });
      throw error;
    }
  }
}

module.exports = new TaskService();