const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const { createAuditMiddleware } = require('../middleware/auditLog');
const { logger } = require('../middleware/logger');

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
 *               due_time:
 *                 type: string
 *                 format: time
 *     responses:
 *       201:
 *         description: Created task
 *       400:
 *         description: Invalid input
 */
router.post('/', 
  createAuditMiddleware('create_task', 'task'),
  async (req, res, next) => {
    try {
      const { title, notes, routine_id, column_name, due_date, due_time } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const task = await taskService.createTask({
        title,
        notes,
        routine_id,
        column_name,
        due_date,
        due_time
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
 *               due_time:
 *                 type: string
 *                 format: time
 *     responses:
 *       200:
 *         description: Updated task
 *       404:
 *         description: Task not found
 */
router.put('/:id',
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