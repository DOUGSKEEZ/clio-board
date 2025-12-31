const express = require('express');
const router = express.Router();
const llmSummaryService = require('../services/llmSummaryService');

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Cross-entity search
 *     description: |
 *       Search across tasks, notes, and routines.
 *
 *       **Two modes available:**
 *       - **User mode (default)**: Full results with all fields, higher limit (15)
 *       - **LLM mode (summary=true)**: Concise results optimized for context (~750 chars)
 *
 *       Use `summary=true` for LLM integrations to minimize token usage.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [tasks, notes, routines]
 *         description: Filter by entity type (omit for all types)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Max results per type (default 15 for user mode, 5 for LLM mode)
 *       - in: query
 *         name: summary
 *         schema:
 *           type: boolean
 *           default: false
 *         description: |
 *           Enable LLM-optimized mode with concise responses.
 *           Truncates titles/content, limits results, excludes verbose fields.
 *     responses:
 *       200:
 *         description: Search results grouped by type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                   description: The search query
 *                 results:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       description: |
 *                         Matching tasks. In summary mode: id, title (truncated), column, routine.
 *                         In full mode: adds due, notes, updatedAt.
 *                     notes:
 *                       type: array
 *                       description: |
 *                         Matching notes. In summary mode: id, title (truncated), preview, routine.
 *                         In full mode: adds content, type, source, updatedAt.
 *                     routines:
 *                       type: array
 *                       description: |
 *                         Matching routines. In summary mode: id, name, status.
 *                         In full mode: adds description, icon, updatedAt.
 *                 totalHits:
 *                   type: integer
 *                   description: Total number of matches across all types
 *       400:
 *         description: Search query is required
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, type, limit, summary } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const options = {
      type: type || null,
      limit: limit ? parseInt(limit) : null,
      summary: summary === 'true'
    };

    const results = await llmSummaryService.search(q.trim(), options);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
