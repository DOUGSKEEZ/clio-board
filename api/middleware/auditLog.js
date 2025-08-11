const pool = require('../db/pool');
const { logger } = require('./logger');

// Audit logging middleware
const auditLogger = async (action, entityType, entityId, previousState, newState, req) => {
  try {
    const auditEntry = {
      actor: req.actor || 'user',
      action,
      entity_type: entityType,
      entity_id: entityId,
      previous_state: previousState ? JSON.stringify(previousState) : null,
      new_state: newState ? JSON.stringify(newState) : null,
      agent_key_hash: req.agentKeyHash || null
    };

    const query = `
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state, agent_key_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;

    const values = [
      auditEntry.actor,
      auditEntry.action,
      auditEntry.entity_type,
      auditEntry.entity_id,
      auditEntry.previous_state,
      auditEntry.new_state,
      auditEntry.agent_key_hash
    ];

    const result = await pool.query(query, values);
    
    logger.debug('Audit log entry created', {
      auditId: result.rows[0].id,
      actor: auditEntry.actor,
      action,
      entityType,
      entityId
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create audit log entry', {
      error: error.message,
      action,
      entityType,
      entityId
    });
    // Don't throw - audit logging shouldn't break the main operation
  }
};

// Middleware factory for different audit actions
const createAuditMiddleware = (action, entityType) => {
  return (req, res, next) => {
    // Store audit function on request for use in route handlers
    req.audit = (entityId, previousState, newState) => {
      return auditLogger(action, entityType, entityId, previousState, newState, req);
    };
    next();
  };
};

module.exports = {
  auditLogger,
  createAuditMiddleware
};