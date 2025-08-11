const express = require('express');
const router = express.Router();
const routineService = require('../services/routineService');
const { createAuditMiddleware } = require('../middleware/auditLog');
const { logger } = require('../middleware/logger');

/**
 * @swagger
 * /api/routines:
 *   get:
 *     summary: Get all active routines
 *     description: Returns all routines that are not archived with task counts
 *     tags: [Routines]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, paused, completed]
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [project, recurring]
 *         description: Filter by type
 *     responses:
 *       200:
 *         description: Array of routines
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Routine'
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type
    };
    
    const routines = await routineService.getRoutines(filters);
    res.json(routines);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/routines/{id}:
 *   get:
 *     summary: Get a single routine by ID
 *     description: Returns a routine with task counts
 *     tags: [Routines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Routine ID
 *     responses:
 *       200:
 *         description: Routine object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Routine'
 *       404:
 *         description: Routine not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const routine = await routineService.getRoutineById(req.params.id);
    if (!routine) {
      return res.status(404).json({ error: 'Routine not found' });
    }
    res.json(routine);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/routines/{id}/tasks:
 *   get:
 *     summary: Get all tasks for a routine
 *     description: Returns all tasks associated with a routine (mini-board view)
 *     tags: [Routines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Routine ID
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
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const tasks = await routineService.getRoutineTasks(req.params.id);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/routines:
 *   post:
 *     summary: Create a new routine
 *     description: Creates a new routine (project or recurring)
 *     tags: [Routines]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 description: Routine title
 *               description:
 *                 type: string
 *                 description: Routine description
 *               type:
 *                 type: string
 *                 enum: [project, recurring]
 *                 description: Routine type
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *                 description: Hex color for UI
 *                 default: '#3498db'
 *               icon:
 *                 type: string
 *                 description: Emoji icon
 *                 default: '📌'
 *               achievable:
 *                 type: boolean
 *                 description: Can be marked complete
 *                 default: false
 *     responses:
 *       201:
 *         description: Created routine
 *       400:
 *         description: Invalid input
 */
router.post('/',
  createAuditMiddleware('create_routine', 'routine'),
  async (req, res, next) => {
    try {
      const { title, description, type, color, icon, achievable } = req.body;
      
      if (!title || !type) {
        return res.status(400).json({ error: 'Title and type are required' });
      }

      if (!['project', 'recurring'].includes(type)) {
        return res.status(400).json({ error: 'Type must be either project or recurring' });
      }

      const routine = await routineService.createRoutine({
        title,
        description,
        type,
        color,
        icon,
        achievable
      });

      // Audit log
      await req.audit(routine.id, null, routine);
      
      res.status(201).json(routine);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/routines/{id}:
 *   put:
 *     summary: Update a routine
 *     description: Updates routine properties
 *     tags: [Routines]
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
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *               icon:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [project, recurring]
 *               achievable:
 *                 type: boolean
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed]
 *     responses:
 *       200:
 *         description: Updated routine
 *       404:
 *         description: Routine not found
 */
router.put('/:id',
  createAuditMiddleware('update_routine', 'routine'),
  async (req, res, next) => {
    try {
      const routineId = req.params.id;
      
      // Get original routine for audit
      const originalRoutine = await routineService.getRoutineById(routineId);
      if (!originalRoutine) {
        return res.status(404).json({ error: 'Routine not found' });
      }

      const updatedRoutine = await routineService.updateRoutine(routineId, req.body);
      
      // Audit log
      await req.audit(routineId, originalRoutine, updatedRoutine);
      
      res.json(updatedRoutine);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/routines/{id}/pause:
 *   put:
 *     summary: Pause a routine
 *     description: Pauses a routine with optional resume date
 *     tags: [Routines]
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
 *               pauseUntil:
 *                 type: string
 *                 format: date-time
 *                 description: When to resume the routine
 *     responses:
 *       200:
 *         description: Paused routine
 *       404:
 *         description: Routine not found
 */
router.put('/:id/pause',
  createAuditMiddleware('pause_routine', 'routine'),
  async (req, res, next) => {
    try {
      const routineId = req.params.id;
      const { pauseUntil } = req.body;
      
      const originalRoutine = await routineService.getRoutineById(routineId);
      if (!originalRoutine) {
        return res.status(404).json({ error: 'Routine not found' });
      }

      const pausedRoutine = await routineService.pauseRoutine(routineId, pauseUntil);
      
      // Audit log
      await req.audit(routineId, originalRoutine, pausedRoutine);
      
      res.json(pausedRoutine);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/routines/{id}/complete:
 *   put:
 *     summary: Complete a routine
 *     description: Marks an achievable routine as complete
 *     tags: [Routines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Completed routine
 *       400:
 *         description: Routine is not achievable
 *       404:
 *         description: Routine not found
 */
router.put('/:id/complete',
  createAuditMiddleware('complete_routine', 'routine'),
  async (req, res, next) => {
    try {
      const routineId = req.params.id;
      
      const originalRoutine = await routineService.getRoutineById(routineId);
      if (!originalRoutine) {
        return res.status(404).json({ error: 'Routine not found' });
      }

      const completedRoutine = await routineService.completeRoutine(routineId);
      
      // Audit log
      await req.audit(routineId, originalRoutine, completedRoutine);
      
      res.json(completedRoutine);
    } catch (error) {
      if (error.message === 'Routine is not marked as achievable') {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/routines/{id}/archive:
 *   put:
 *     summary: Archive a routine
 *     description: Archives a routine
 *     tags: [Routines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Archived routine
 *       404:
 *         description: Routine not found
 */
router.put('/:id/archive',
  createAuditMiddleware('archive_routine', 'routine'),
  async (req, res, next) => {
    try {
      const routineId = req.params.id;
      
      const originalRoutine = await routineService.getRoutineById(routineId);
      if (!originalRoutine) {
        return res.status(404).json({ error: 'Routine not found' });
      }

      const archivedRoutine = await routineService.archiveRoutine(routineId);
      
      // Audit log
      await req.audit(routineId, originalRoutine, archivedRoutine);
      
      res.json(archivedRoutine);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/routines/{id}/restore:
 *   put:
 *     summary: Restore an archived routine
 *     description: Restores an archived routine back to active status
 *     tags: [Routines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Restored routine
 *       404:
 *         description: Routine not found
 */
router.put('/:id/restore',
  createAuditMiddleware('restore_routine', 'routine'),
  async (req, res, next) => {
    try {
      const routineId = req.params.id;
      
      const originalRoutine = await routineService.getRoutineById(routineId);
      if (!originalRoutine) {
        return res.status(404).json({ error: 'Routine not found' });
      }

      const restoredRoutine = await routineService.restoreRoutine(routineId);
      
      // Audit log
      await req.audit(routineId, originalRoutine, restoredRoutine);
      
      res.json(restoredRoutine);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;