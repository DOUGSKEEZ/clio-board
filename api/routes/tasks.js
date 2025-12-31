const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const llmSummaryService = require('../services/llmSummaryService');
const { createAuditMiddleware } = require('../middleware/auditLog');
const { logger } = require('../middleware/logger');
const validation = require('../middleware/validation');

/**
 * @swagger
 * /api/tasks/summary:
 *   get:
 *     summary: Get LLM-optimized tasks summary
 *     description: |
 *       Returns tasks grouped by column with minimal fields.
 *       Optimized for LLM context (~900 chars for 15-20 tasks).
 *
 *       Use this endpoint when you need a quick overview of all tasks
 *       without consuming excessive context tokens.
 *     tags: [Tasks, LLM Summary]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Max tasks per column
 *       - in: query
 *         name: columns
 *         schema:
 *           type: string
 *         description: Comma-separated column filter (e.g., "Today,Tomorrow")
 *       - in: query
 *         name: routine
 *         schema:
 *           type: string
 *         description: Filter by routine name or ID
 *     responses:
 *       200:
 *         description: Tasks summary grouped by column
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of active tasks
 *                 byColumn:
 *                   type: object
 *                   description: Tasks grouped by column name
 *                 overdue:
 *                   type: integer
 *                   description: Count of overdue tasks
 *                 dueThisWeek:
 *                   type: integer
 *                   description: Count of tasks due this week
 */
router.get('/summary', async (req, res, next) => {
  try {
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit) : 5,
      columns: req.query.columns || null,
      routine: req.query.routine || null
    };

    const summary = await llmSummaryService.getTasksSummary(options);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get all active tasks
 *     description: Returns all tasks that are not archived, with their list items if applicable
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: column
 *         schema:
 *           type: string
 *           enum: [today, tomorrow, this_week, horizon]
 *         description: Filter by column
 *       - in: query
 *         name: routine_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by routine
 *     responses:
 *       200:
 *         description: Array of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      column: req.query.column,
      routine_id: req.query.routine_id
    };
    
    const tasks = await taskService.getTasks(filters);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/archived:
 *   get:
 *     summary: Get all archived tasks
 *     description: Returns all tasks that have been archived, with their list items if applicable
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: column
 *         schema:
 *           type: string
 *           enum: [today, tomorrow, this_week, horizon]
 *         description: Filter by column
 *       - in: query
 *         name: routine_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by routine
 *     responses:
 *       200:
 *         description: Array of archived tasks
 */
router.get('/archived', async (req, res, next) => {
  try {
    const filters = {
      column: req.query.column,
      routine_id: req.query.routine_id
    };
    
    const archivedTasks = await taskService.getArchivedTasks(filters);
    res.json(archivedTasks);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get a single task by ID
 *     description: Returns a task with its list items if applicable
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/{id}/context:
 *   get:
 *     summary: Get LLM-optimized task context
 *     description: |
 *       Returns full context for a single task in a concise format.
 *       Includes description, checklist items, and routine membership.
 *       Optimized for LLM context (~550 chars).
 *
 *       Use this endpoint when you need complete details about a specific task.
 *     tags: [Tasks, LLM Summary]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task context
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                   nullable: true
 *                 column:
 *                   type: string
 *                 routine:
 *                   type: string
 *                   nullable: true
 *                 due:
 *                   type: string
 *                   format: date
 *                   nullable: true
 *                 created:
 *                   type: string
 *                   format: date
 *                 checklist:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       done:
 *                         type: boolean
 *       404:
 *         description: Task not found
 */
router.get('/:id/context', async (req, res, next) => {
  try {
    const context = await llmSummaryService.getTaskContext(req.params.id);
    if (!context) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(context);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     description: Creates a new task (always starts as type='task')
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Task title
 *               notes:
 *                 type: string
 *                 description: Task notes
 *               routine_id:
 *                 type: string
 *                 format: uuid
 *                 description: Associated routine ID
 *               column_name:
 *                 type: string
 *                 enum: [today, tomorrow, this_week, horizon]
 *                 default: today
 *               due_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Created task
 *       400:
 *         description: Invalid input
 */
router.post('/', 
  validation.validateTask,
  createAuditMiddleware('create_task', 'task'),
  async (req, res, next) => {
    try {
      const { title, notes, routine_id, column_name, due_date } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const task = await taskService.createTask({
        title,
        notes,
        routine_id,
        column_name,
        due_date
      });

      // Audit log
      await req.audit(task.id, null, task);
      
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task
 *     description: Updates task properties (title, notes, column, etc.)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               notes:
 *                 type: string
 *               routine_id:
 *                 type: string
 *                 format: uuid
 *               column_name:
 *                 type: string
 *                 enum: [today, tomorrow, this_week, horizon]
 *               position:
 *                 type: integer
 *               due_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Updated task
 *       404:
 *         description: Task not found
 */
router.put('/:id',
  validation.validateTask,
  createAuditMiddleware('update_task', 'task'),
  async (req, res, next) => {
    try {
      const taskId = req.params.id;
      
      // Get original task for audit
      const originalTask = await taskService.getTaskById(taskId);
      if (!originalTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updatedTask = await taskService.updateTask(taskId, req.body);
      
      // Audit log
      await req.audit(taskId, originalTask, updatedTask);
      
      res.json(updatedTask);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}/move:
 *   put:
 *     summary: Move task to different column
 *     description: Moves a task to a different column and/or position
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - column
 *             properties:
 *               column:
 *                 type: string
 *                 enum: [today, tomorrow, this_week, horizon]
 *               position:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Moved task
 */
router.put('/:id/move',
  createAuditMiddleware('move_task', 'task'),
  async (req, res, next) => {
    try {
      const { column, position } = req.body;
      
      if (!column) {
        return res.status(400).json({ error: 'Column is required' });
      }

      const taskId = req.params.id;
      const originalTask = await taskService.getTaskById(taskId);
      
      if (!originalTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const movedTask = await taskService.moveTask(taskId, column, position);
      
      // Audit log
      await req.audit(taskId, originalTask, movedTask);
      
      res.json(movedTask);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}/archive:
 *   put:
 *     summary: Archive a task
 *     description: Archives a task (preserves list items if type='list')
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Archived task
 *       404:
 *         description: Task not found
 */
router.put('/:id/archive',
  createAuditMiddleware('archive_task', 'task'),
  async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const originalTask = await taskService.getTaskById(taskId);
      
      if (!originalTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const archivedTask = await taskService.archiveTask(taskId);
      
      // Audit log
      await req.audit(taskId, originalTask, archivedTask);
      
      res.json(archivedTask);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}/restore:
 *   put:
 *     summary: Restore a task from archive
 *     description: Restores an archived task back to active status
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Restored task
 *       404:
 *         description: Task not found
 */
router.put('/:id/restore',
  createAuditMiddleware('restore_task', 'task'),
  async (req, res, next) => {
    try {
      const taskId = req.params.id;
      
      // Don't check if task exists first since getTaskById only finds active tasks
      // The restoreTask method will handle task not found errors
      const restoredTask = await taskService.restoreTask(taskId);
      
      // Audit log (use restored task as both original and new for audit)
      await req.audit(taskId, restoredTask, restoredTask);
      
      res.json(restoredTask);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}/complete:
 *   post:
 *     summary: Mark task as complete
 *     description: Marks a task as complete and archives it
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Completed task
 *       404:
 *         description: Task not found
 */
router.post('/:id/complete',
  createAuditMiddleware('complete_task', 'task'),
  async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const originalTask = await taskService.getTaskById(taskId);
      
      if (!originalTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const completedTask = await taskService.completeTask(taskId);
      
      // Audit log
      await req.audit(taskId, originalTask, completedTask);
      
      res.json(completedTask);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}/items:
 *   get:
 *     summary: Get items for a task
 *     description: Returns all list items for a task (if type='list')
 *     tags: [List Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Array of list items
 */
router.get('/:id/items', async (req, res, next) => {
  try {
    const items = await taskService.getItems(req.params.id);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks/{id}/items:
 *   post:
 *     summary: Add item to task
 *     description: Adds an item to a task (auto-converts task to list if needed)
 *     tags: [List Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Item text
 *     responses:
 *       201:
 *         description: Created item
 *       400:
 *         description: Invalid input
 */
router.post('/:id/items',
  validation.validateListItem,
  createAuditMiddleware('add_item', 'list_item'),
  async (req, res, next) => {
    try {
      const { title } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const taskId = req.params.id;
      const item = await taskService.addItemToTask(taskId, { title });
      
      // Audit log
      await req.audit(item.id, null, item);
      
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}/items/{itemId}:
 *   put:
 *     summary: Update list item
 *     description: Updates a list item (check/uncheck or edit title)
 *     tags: [List Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated item
 */
router.put('/:id/items/:itemId',
  validation.validateListItem,
  createAuditMiddleware('update_item', 'list_item'),
  async (req, res, next) => {
    try {
      const { id: taskId, itemId } = req.params;
      
      const updatedItem = await taskService.updateItem(taskId, itemId, req.body);
      
      if (!updatedItem) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      // Audit log
      await req.audit(itemId, null, updatedItem);
      
      res.json(updatedItem);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/tasks/{id}/items/{itemId}:
 *   delete:
 *     summary: Delete list item
 *     description: Deletes an item (auto-converts list to task if last item)
 *     tags: [List Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Item deleted
 *       404:
 *         description: Item not found
 */
router.delete('/:id/items/:itemId',
  createAuditMiddleware('delete_item', 'list_item'),
  async (req, res, next) => {
    try {
      const { id: taskId, itemId } = req.params;
      
      const success = await taskService.deleteItem(taskId, itemId);
      
      if (!success) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      // Audit log
      await req.audit(itemId, { deleted: true }, null);
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;