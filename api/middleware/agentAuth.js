const crypto = require('crypto');
const { logger } = require('./logger');

// Allowed IPs for agent requests (add Clio-AI-agent IP when known)
const ALLOWED_AGENT_IPS = [
  '127.0.0.1',           // localhost (development)
  '::1',                 // IPv6 localhost
  '192.168.10.21',       // Samwise (same server) (for testing! Remember to remove)
  '192.168.20.20',       // Placeholder for Clio-AI-agent IP  Framework "Frodo" - WHERE AGENT WILL RUN
  // The agent runs on Framework Desktop but can reach VLAN 10 services
  // It cannot reach internet directly - uses Samwise as filtered proxy
];

// Agent authentication middleware
const authenticateAgent = (req, res, next) => {
  const agentKey = req.headers['x-agent-key'];
  const expectedKey = process.env.AGENT_API_KEY;
  const clientIP = req.ip || req.connection.remoteAddress;

  if (!expectedKey) {
    logger.warn('Agent API key not configured in environment');
    return next();
  }

  // If agent key is provided, validate it
  if (agentKey) {
    if (agentKey === expectedKey) {
      // Additional security: IP validation for agent requests
      if (!ALLOWED_AGENT_IPS.includes(clientIP)) {
        logger.warn('Agent key used from unauthorized IP', {
          ip: clientIP,
          userAgent: req.get('User-Agent'),
          url: req.url,
          allowedIPs: ALLOWED_AGENT_IPS
        });
        
        return res.status(403).json({
          error: 'unauthorized_ip',
          message: 'Agent requests not allowed from this IP address'
        });
      }

      req.isAgent = true;
      req.actor = 'agent';
      
      // Hash the key for audit logging (security)
      req.agentKeyHash = crypto
        .createHash('sha256')
        .update(agentKey)
        .digest('hex');
      
      logger.debug('Agent authenticated successfully', { ip: clientIP });
    } else {
      logger.warn('Invalid agent key provided', { 
        ip: clientIP, 
        userAgent: req.get('User-Agent') 
      });
      
      return res.status(401).json({
        error: 'invalid_agent_key',
        message: 'Invalid agent authentication key'
      });
    }
  } else {
    // No agent key = user request
    req.isAgent = false;
    req.actor = 'user';
  }

  next();
};

module.exports = {
  authenticateAgent
};