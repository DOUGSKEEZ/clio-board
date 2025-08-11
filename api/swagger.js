const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'CLIO-Board API',
    version: '1.0.0',
    description: 'Personal task management system with AI agent integration',
    contact: {
      name: 'CLIO Board',
      url: 'http://192.168.10.21:3000'
    }
  },
  servers: [
    {
      url: 'http://192.168.10.21:3000',
      description: 'Production server (Samwise)'
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      AgentAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Agent-Key',
        description: 'Agent authentication key for CLIO-Hermes-Agent'
      }
    },
    schemas: {
      Task: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Task ID'
          },
          routine_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Associated routine ID (null for orphan tasks)'
          },
          title: {
            type: 'string',
            maxLength: 255,
            description: 'Task title'
          },
          notes: {
            type: 'string',
            nullable: true,
            description: 'Free-form notes'
          },
          type: {
            type: 'string',
            enum: ['task', 'list'],
            description: 'AUTO-MANAGED: Converts based on items'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'archived'],
            description: 'Task status'
          },
          due_date: {
            type: 'string',
            format: 'date',
            nullable: true,
            description: 'Due date (optional)'
          },
          column_name: {
            type: 'string',
            enum: ['today', 'tomorrow', 'this_week', 'horizon'],
            description: 'Kanban column'
          },
          position: {
            type: 'integer',
            description: 'Position within column'
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          },
          updated_at: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['title', 'column_name']
      },
      Routine: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          title: {
            type: 'string',
            maxLength: 255,
            description: 'Routine name'
          },
          description: {
            type: 'string',
            nullable: true
          },
          color: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            description: 'Hex color for UI'
          },
          icon: {
            type: 'string',
            description: 'Emoji icon'
          },
          type: {
            type: 'string',
            enum: ['project', 'recurring']
          },
          status: {
            type: 'string',
            enum: ['active', 'paused', 'completed', 'archived']
          },
          achievable: {
            type: 'boolean',
            description: 'Can be marked complete'
          }
        },
        required: ['title', 'type']
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    }
  }
};

// Options for the swagger docs
const options = {
  definition: swaggerDefinition,
  apis: ['./api/routes/*.js', './api/server.js'], // Path to the API files
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerSpec,
  swaggerUi
};