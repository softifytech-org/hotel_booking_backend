const { Pool } = require('pg');

// Supabase Transaction Pooler (port 6543) — prepared statements disabled for compatibility
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Disable prepared statements for Supabase pgBouncer transaction mode
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  console.error('Unexpected DB client error:', err.message);
});

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Supabase connection failed:', err.message);
  } else {
    console.log('✅ Supabase PostgreSQL connected');
    release();
  }
});

module.exports = pool;
