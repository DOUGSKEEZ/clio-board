/**
 * RAG Notifier Service
 *
 * Sends notifications to Vivaldi for RAG indexing when clio-board entities change.
 * Fire-and-forget pattern - failures are logged but don't block the operation.
 */

const { logger } = require('../middleware/logger');

const RAG_ENDPOINT = process.env.VIVALDI_RAG_URL || 'http://192.168.10.21:3002/api/rag/index';
const RAG_TIMEOUT = parseInt(process.env.RAG_TIMEOUT, 10) || 5000;

/**
 * Notify Vivaldi of a clio-board change for RAG indexing.
 * Fire-and-forget - failures are logged but don't block the operation.
 *
 * @param {Object} entity - The entity (task, note, routine) with full data
 * @param {String} entityType - 'task' | 'note' | 'routine'
 * @param {String} action - 'upsert' | 'archive' | 'unarchive' | 'delete'
 */
async function notifyRAGIndex(entity, entityType, action) {
  try {
    const payload = {
      id: `${entityType}_${entity.id}`,
      entity_type: entityType,
      action: action,
      text: formatForRAG(entity, entityType),
      metadata: extractMetadata(entity, entityType),
      updated_at: entity.updated_at || new Date().toISOString()
    };

    // Fire-and-forget with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RAG_TIMEOUT);

    fetch(RAG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) {
          logger.warn('RAG index notification failed', {
            entityType,
            entityId: entity.id,
            action,
            status: response.status
          });
        } else {
          logger.debug('RAG index notification sent', {
            entityType,
            entityId: entity.id,
            action
          });
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        // Don't log AbortError as warning - it's expected on timeout
        if (err.name !== 'AbortError') {
          logger.warn('RAG index notification failed', {
            entityType,
            entityId: entity.id,
            action,
            error: err.message
          });
        }
      });

  } catch (err) {
    logger.warn('Failed to build RAG payload', {
      entityType,
      error: err.message
    });
  }
}

/**
 * Build searchable text representation for RAG embedding.
 * This is what gets semantically searched.
 *
 * @param {Object} entity - The entity data
 * @param {String} type - 'task' | 'note' | 'routine'
 * @returns {String} Formatted text for embedding
 */
function formatForRAG(entity, type) {
  switch (type) {
    case 'task':
      return formatTask(entity);
    case 'note':
      return formatNote(entity);
    case 'routine':
      return formatRoutine(entity);
    default:
      throw new Error(`Unknown entity type: ${type}`);
  }
}

/**
 * Format a task for RAG indexing
 */
function formatTask(task) {
  let text = `Task: "${task.title}"
Status: ${task.status}
Column: ${task.column_name}`;

  if (task.due_date) {
    text += `\nDue: ${task.due_date}`;
  }

  // Include routine info if available
  if (task.routine_title) {
    text += `\nRoutine: ${task.routine_title}`;
  } else if (task.routine?.title) {
    text += `\nRoutine: ${task.routine.title}`;
  } else {
    text += `\nStandalone task`;
  }

  // Include task notes/description
  if (task.notes) {
    text += `\nNotes: ${task.notes}`;
  }

  // List items - comma-separated
  if (task.items && task.items.length > 0) {
    const itemList = task.items.map(i => i.title).join(', ');
    text += `\nChecklist items: ${itemList}`;
  }

  return text;
}

/**
 * Format a note for RAG indexing
 */
function formatNote(note) {
  let text = `Note: "${note.title || 'Untitled'}"`;

  // Include routine info if available
  if (note.routine_title) {
    text += `\nRoutine: ${note.routine_title}`;
  } else if (note.routine?.title) {
    text += `\nRoutine: ${note.routine.title}`;
  }

  // Include related task if available
  if (note.task_title) {
    text += `\nRelated task: ${note.task_title}`;
  } else if (note.task?.title) {
    text += `\nRelated task: ${note.task.title}`;
  }

  // Note type context
  if (note.type === 'agent') {
    text += `\nType: CLio's note`;
    if (note.source === 'conversation') {
      text += ` (from conversation)`;
    }
  }

  // Main content
  text += `\nContent: ${note.content}`;

  return text;
}

/**
 * Format a routine for RAG indexing
 */
function formatRoutine(routine) {
  let text = `Routine: "${routine.title}"
Status: ${routine.status}`;

  if (routine.description) {
    text += `\nDescription: ${routine.description}`;
  }

  if (routine.achievable) {
    text += `\nThis is an achievable project (can be completed)`;
  } else {
    text += `\nThis is an ongoing routine`;
  }

  return text;
}

/**
 * Extract metadata for ChromaDB storage
 *
 * @param {Object} entity - The entity data
 * @param {String} type - 'task' | 'note' | 'routine'
 * @returns {Object} Metadata object
 */
function extractMetadata(entity, type) {
  const base = {
    entity_type: type,
    created_at: entity.created_at,
    updated_at: entity.updated_at
  };

  switch (type) {
    case 'task':
      return {
        ...base,
        status: entity.status,
        column: entity.column_name,
        routine_id: entity.routine_id || null,
        routine_name: entity.routine_title || entity.routine?.title || null,
        has_checklist: !!(entity.items && entity.items.length > 0),
        due_date: entity.due_date || null
      };

    case 'note':
      return {
        ...base,
        note_type: entity.type,
        source: entity.source,
        routine_id: entity.routine_id || null,
        routine_name: entity.routine_title || entity.routine?.title || null,
        task_id: entity.task_id || null
      };

    case 'routine':
      return {
        ...base,
        status: entity.status,
        achievable: entity.achievable || false
      };

    default:
      return base;
  }
}

module.exports = {
  notifyRAGIndex,
  formatForRAG,
  extractMetadata
};
