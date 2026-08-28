const { Pool } = require('pg');

// Uses DATABASE_URL from .env, e.g.:
// DATABASE_URL=postgres://user:password@localhost:5432/dropship_store
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error on idle client', err);
});

module.exports = pool;
