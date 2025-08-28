const express = require('express');
const router = express.Router();
const noteService = require('../services/noteService');
const { createAuditMiddleware } = require('../middleware/auditLog');
const { logger } = require('../middleware/logger');

/**
 * @swagger
 * /api/notes:
 *   get:
 *     summary: Get all active notes
 *     description: Returns all notes that are not archived
 *     tags: [Notes]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [user, agent]
 *         description: Filter by note type
 *       - in: query
 *         name: column_position
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 4
 *         description: Filter by column position (1-2 user, 3-4 agent)
 *     responses:
 *       200:
 *         description: Array of notes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [user, agent]
 *                   source:
 *                     type: string
 *                     enum: [manual, voice, conversation, claude_api]
 *                   column_position:
 *                     type: integer
 *                   task_id:
 *                     type: string
 *                     format: uuid
 *                   routine_id:
 *                     type: string
 *                     format: uuid
 *                   created_at:
 *                     type: string
 *                     format: date-time
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      type: req.query.type,
      column_position: req.query.column_position ? parseInt(req.query.column_position) : undefined,
      routine_id: req.query.routine_id
    };
    
    const notes = await noteService.getNotes(filters);
    res.json(notes);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/notes/archived:
 *   get:
 *     summary: Get all archived notes
 *     description: Returns all notes that have been archived
 *     tags: [Notes]
 *     responses:
 *       200:
 *         description: Array of archived notes
 */
router.get('/archived', async (req, res, next) => {
  try {
    const archivedNotes = await noteService.getArchivedNotes();
    res.json(archivedNotes);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/notes/{id}:
 *   get:
 *     summary: Get a single note by ID
 *     description: Returns a note with associated task/routine info
 *     tags: [Notes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Note ID
 *     responses:
 *       200:
 *         description: Note object
 *       404:
 *         description: Note not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const note = await noteService.getNoteById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/notes:
 *   post:
 *     summary: Create a new note
 *     description: Creates a new note in the scratch area
 *     tags: [Notes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 description: Note title (optional)
 *               content:
 *                 type: string
 *                 description: Note content
 *               type:
 *                 type: string
 *                 enum: [user, agent]
 *                 default: user
 *               source:
 *                 type: string
 *                 enum: [manual, voice, conversation, claude_api]
 *                 default: manual
 *               column_position:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *                 description: Column position (1-2 user, 3-4 agent)
 *               task_id:
 *                 type: string
 *                 format: uuid
 *                 description: Associated task ID
 *               routine_id:
 *                 type: string
 *                 format: uuid
 *                 description: Associated routine ID
 *     responses:
 *       201:
 *         description: Created note
 *       400:
 *         description: Invalid input
 */
router.post('/',
  createAuditMiddleware('create_note', 'note'),
  async (req, res, next) => {
    try {
      const { title, content, type, source, column_position, task_id, routine_id } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      // Validate column position if provided
      if (column_position && (column_position < 1 || column_position > 4)) {
        return res.status(400).json({ error: 'Column position must be between 1 and 4' });
      }

      // Override type based on actor
      const noteType = req.isAgent ? 'agent' : (type || 'user');

      const note = await noteService.createNote({
        title,
        content,
        type: noteType,
        source: source || (req.isAgent ? 'conversation' : 'manual'),
        column_position,
        task_id,
        routine_id
      });

      // Audit log
      await req.audit(note.id, null, note);
      
      res.status(201).json(note);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/notes/{id}:
 *   put:
 *     summary: Update a note
 *     description: Updates note content or position
 *     tags: [Notes]
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
 *               content:
 *                 type: string
 *               column_position:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *     responses:
 *       200:
 *         description: Updated note
 *       404:
 *         description: Note not found
 */
router.put('/:id',
  createAuditMiddleware('update_note', 'note'),
  async (req, res, next) => {
    try {
      const noteId = req.params.id;
      
      // Get original note for audit
      const originalNote = await noteService.getNoteById(noteId);
      if (!originalNote) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Validate column position if provided
      if (req.body.column_position && 
          (req.body.column_position < 1 || req.body.column_position > 4)) {
        return res.status(400).json({ error: 'Column position must be between 1 and 4' });
      }

      const updatedNote = await noteService.updateNote(noteId, req.body);
      
      // Audit log
      await req.audit(noteId, originalNote, updatedNote);
      
      res.json(updatedNote);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/notes/{id}/move:
 *   put:
 *     summary: Move note to different column
 *     description: Moves a note to a different column in the scratch area
 *     tags: [Notes]
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
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *                 description: New column position
 *     responses:
 *       200:
 *         description: Moved note
 */
router.put('/:id/move',
  createAuditMiddleware('move_note', 'note'),
  async (req, res, next) => {
    try {
      const { column, position } = req.body;
      
      if (!column || column < 1 || column > 4) {
        return res.status(400).json({ error: 'Column must be between 1 and 4' });
      }

      const noteId = req.params.id;
      const originalNote = await noteService.getNoteById(noteId);
      
      if (!originalNote) {
        return res.status(404).json({ error: 'Note not found' });
      }

      const movedNote = await noteService.moveNote(noteId, column, position);
      
      // Audit log
      await req.audit(noteId, originalNote, movedNote);
      
      res.json(movedNote);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/notes/{id}/convert:
 *   post:
 *     summary: Convert note to task
 *     description: Converts a note to a task and archives the note
 *     tags: [Notes]
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
 *                 description: Task title (defaults to note title)
 *               column_name:
 *                 type: string
 *                 enum: [today, tomorrow, this_week, horizon]
 *                 default: today
 *               routine_id:
 *                 type: string
 *                 format: uuid
 *               due_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Created task and archived note
 *       404:
 *         description: Note not found
 */
router.post('/:id/convert',
  createAuditMiddleware('convert_note_to_task', 'note'),
  async (req, res, next) => {
    try {
      const noteId = req.params.id;
      const taskData = req.body;
      
      const result = await noteService.convertToTask(noteId, taskData);
      
      // Audit log for both note and task
      await req.audit(noteId, { converted: false }, { converted: true, task_id: result.task.id });
      
      res.status(201).json(result);
    } catch (error) {
      if (error.message === 'Note not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/notes/{id}/archive:
 *   put:
 *     summary: Archive a note
 *     description: Archives a note (soft delete)
 *     tags: [Notes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Archived note
 *       404:
 *         description: Note not found
 */
router.put('/:id/archive',
  createAuditMiddleware('archive_note', 'note'),
  async (req, res, next) => {
    try {
      const noteId = req.params.id;
      
      const originalNote = await noteService.getNoteById(noteId);
      if (!originalNote) {
        return res.status(404).json({ error: 'Note not found' });
      }

      const archivedNote = await noteService.archiveNote(noteId);
      
      // Audit log
      await req.audit(noteId, originalNote, archivedNote);
      
      res.json(archivedNote);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/notes/{id}/restore:
 *   put:
 *     summary: Restore an archived note
 *     description: Restores an archived note back to active
 *     tags: [Notes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Restored note
 *       404:
 *         description: Note not found
 */
router.put('/:id/restore',
  createAuditMiddleware('restore_note', 'note'),
  async (req, res, next) => {
    try {
      const noteId = req.params.id;
      
      const originalNote = await noteService.getNoteById(noteId);
      if (!originalNote) {
        return res.status(404).json({ error: 'Note not found' });
      }

      const restoredNote = await noteService.restoreNote(noteId);
      
      // Audit log
      await req.audit(noteId, originalNote, restoredNote);
      
      res.json(restoredNote);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;