const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { logger } = require('../middleware/logger');
const taskService = require('../services/taskService');

/**
 * @swagger
 * /api/dividers:
 *   get:
 *     summary: Get all column dividers
 *     description: |
 *       Returns time-of-day dividers for the Today column. These are UI-only elements, not tasks.
 *
 *       ## Determining Task Time Sections
 *
 *       To categorize Today's tasks into Morning/Afternoon/Evening sections, compare task positions to divider positions:
 *
 *       1. Fetch tasks: `GET /api/tasks?column=today`
 *       2. Fetch dividers: `GET /api/dividers`
 *       3. Find the "Morning/Afternoon" divider (label_above="Morning") and "Afternoon/Evening" divider (label_above="Afternoon")
 *       4. Categorize tasks:
 *          - **Morning**: task.position < morning_afternoon_divider.position
 *          - **Afternoon**: task.position < afternoon_evening_divider.position (and >= morning divider)
 *          - **Evening**: task.position >= afternoon_evening_divider.position
 *
 *       ### Example
 *       ```
 *       // If dividers are at positions 5 and 12:
 *       // - Tasks at positions 0-4 → Morning
 *       // - Tasks at positions 6-11 → Afternoon
 *       // - Tasks at positions 13+ → Evening
 *       ```
 *
 *       Note: Dividers share the same position space as tasks, so positions are interleaved.
 *     tags: [Dividers]
 *     responses:
 *       200:
 *         description: Array of dividers ordered by position
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
 *                   column_name:
 *                     type: string
 *                     example: today
 *                   label_above:
 *                     type: string
 *                     example: Morning
 *                     description: The section label above the divider line
 *                   label_below:
 *                     type: string
 *                     example: Afternoon
 *                     description: The section label below the divider line
 *                   position:
 *                     type: integer
 *                     description: Position in the Today column (shared position space with tasks)
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM column_dividers ORDER BY position'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/dividers/{id}/move:
 *   put:
 *     summary: Move a divider to a new position
 *     description: Updates the divider's position within the Today column
 *     tags: [Dividers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Divider ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - position
 *             properties:
 *               position:
 *                 type: integer
 *                 description: New position for the divider
 *     responses:
 *       200:
 *         description: Updated divider
 *       404:
 *         description: Divider not found
 */
router.put('/:id/move', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { position } = req.body;

    if (typeof position !== 'number') {
      return res.status(400).json({ error: 'Position is required and must be a number' });
    }

    // Update the divider's position
    const result = await pool.query(
      `UPDATE column_dividers
       SET position = $1
       WHERE id = $2
       RETURNING *`,
      [position, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Divider not found' });
    }

    // Renumber all positions in Today column to keep tasks and dividers in sync
    await taskService.renumberColumnPositions('today');

    // Re-fetch the divider to get its final position after renumbering
    const finalResult = await pool.query(
      'SELECT * FROM column_dividers WHERE id = $1',
      [id]
    );

    logger.info('Divider moved', { dividerId: id, newPosition: finalResult.rows[0].position });
    res.json(finalResult.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
