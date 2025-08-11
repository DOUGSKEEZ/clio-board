const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'clio_board',
  user: process.env.DB_USER || 'samwise',
  // For local connections, omit password to use peer authentication
  ...(process.env.DB_PASSWORD && { password: process.env.DB_PASSWORD }),
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Test connection on startup
pool.on('connect', (client) => {
  console.log(`Connected to PostgreSQL database: ${process.env.DB_NAME}`);
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down PostgreSQL pool...');
  pool.end(() => {
    console.log('PostgreSQL pool has ended');
    process.exit(0);
  });
});

module.exports = pool;