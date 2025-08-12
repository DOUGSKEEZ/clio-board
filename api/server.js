const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// Import middleware
const { logger, requestLogger, errorLogger } = require('./middleware/logger');
const { authenticateAgent } = require('./middleware/agentAuth');

// Import database pool
const pool = require('./db/pool');

// Import Swagger documentation
const { swaggerSpec, swaggerUi } = require('./swagger');

// Import route modules
const tasksRouter = require('./routes/tasks');
const routinesRouter = require('./routes/routines'); 
const notesRouter = require('./routes/notes');
// const analyticsRouter = require('./routes/analytics'); // TODO: Phase 2

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - CSP configured for Samwise development
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'", "http://192.168.10.21:3000"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "http://192.168.10.21:3000",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net", 
        "https://kit.fontawesome.com"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "http://192.168.10.21:3000",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://kit.fontawesome.com",
        "https://ka-f.fontawesome.com"
      ],
      fontSrc: [
        "'self'",
        "http://192.168.10.21:3000", 
        "https://cdnjs.cloudflare.com",
        "https://ka-f.fontawesome.com",
        "https://fonts.gstatic.com"
      ],
      connectSrc: [
        "'self'",
        "http://192.168.10.21:3000",
        "https://ka-f.fontawesome.com"
      ],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://192.168.10.21:3000'] // Only allow from Samwise in production
    : true, // Allow all origins in development
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(requestLogger);

// Agent authentication middleware
app.use(authenticateAgent);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CLIO-Board API Documentation'
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns server health status and database connectivity
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await pool.query('SELECT NOW()');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: true,
        timestamp: dbResult.rows[0].now
      },
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// System metrics endpoint
app.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Debug endpoints for development
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/status', async (req, res) => {
    try {
      const dbResult = await pool.query('SELECT COUNT(*) as task_count FROM tasks WHERE status != $1', ['archived']);
      const routinesResult = await pool.query('SELECT COUNT(*) as routine_count FROM routines WHERE status != $1', ['archived']);
      
      res.json({
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          activeTasks: parseInt(dbResult.rows[0].task_count),
          activeRoutines: parseInt(routinesResult.rows[0].routine_count)
        },
        environment: process.env.NODE_ENV,
        debug: process.env.DEBUG === 'true'
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/debug/logs', (req, res) => {
    // Return recent log entries (simplified version)
    res.json({
      message: 'Check console output for logs',
      logFiles: ['./logs/combined.log', './logs/error.log'],
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API information endpoint
 *     description: Returns API metadata and authentication status
 *     tags: [System]
 *     security:
 *       - AgentAuth: []
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "CLIO-Board API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 actor:
 *                   type: string
 *                   enum: [user, agent]
 *                   example: user
 *                 isAgent:
 *                   type: boolean
 *                   example: false
 */
// API Routes (placeholder for now)
app.get('/api', (req, res) => {
  res.json({
    message: 'CLIO-Board API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    actor: req.actor,
    isAgent: req.isAgent
  });
});

// Mount API route modules
app.use('/api/tasks', tasksRouter);
app.use('/api/routines', routinesRouter);
app.use('/api/notes', notesRouter);
// app.use('/api/analytics', analyticsRouter); // TODO: Phase 2

// Catch-all handler for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use(errorLogger);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`CLIO-Board server started`, {
    port: PORT,
    environment: process.env.NODE_ENV,
    debug: process.env.DEBUG === 'true'
  });

  // Test database connection on startup
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info('Database connection verified', {
      timestamp: result.rows[0].now
    });
  } catch (error) {
    logger.error('Database connection failed', {
      error: error.message,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});