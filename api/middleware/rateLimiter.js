const { logger } = require('./logger');

// In-memory store for rate limiting (consider Redis for production)
const rateLimitStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > data.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware specifically for agent requests
 * @param {number} maxRequests - Maximum requests per window (default: 500)
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 */
const agentRateLimit = (maxRequests = 500, windowMs = 60 * 1000) => {
  return (req, res, next) => {
    // Only apply rate limiting to agent requests
    if (!req.isAgent) {
      return next();
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    const key = `agent:${clientIP}`;
    const now = Date.now();

    // Get or create rate limit data for this client
    let clientData = rateLimitStore.get(key);
    
    if (!clientData || (now - clientData.windowStart) >= windowMs) {
      // Reset or create new window
      clientData = {
        requests: 1,
        windowStart: now,
        windowMs: windowMs
      };
    } else {
      // Increment request count in current window
      clientData.requests++;
    }

    rateLimitStore.set(key, clientData);

    // Check if rate limit exceeded
    if (clientData.requests > maxRequests) {
      const resetTime = new Date(clientData.windowStart + windowMs);
      
      logger.warn('Agent rate limit exceeded', {
        ip: clientIP,
        requests: clientData.requests,
        maxRequests: maxRequests,
        windowMs: windowMs,
        resetTime: resetTime.toISOString(),
        userAgent: req.get('User-Agent'),
        url: req.url
      });

      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Rate limit exceeded.',
        retryAfter: Math.ceil((clientData.windowStart + windowMs - now) / 1000),
        limit: maxRequests,
        window: windowMs / 1000,
        resetTime: resetTime.toISOString()
      });
    }

    // Add rate limit headers for debugging
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.requests),
      'X-RateLimit-Reset': new Date(clientData.windowStart + windowMs).toISOString(),
      'X-RateLimit-Window': windowMs / 1000
    });

    next();
  };
};

module.exports = {
  agentRateLimit
};