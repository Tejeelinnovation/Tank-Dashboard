const { Pool } = require('pg');
const fs = require('fs');

async function migrate() {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const dbUrlMatch = envFile.match(/DATABASE_URL=(.+)/);
  if (!dbUrlMatch) {
    console.error('DATABASE_URL not found in .env.local');
    return;
  }
  const dbUrl = dbUrlMatch[1].trim();

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Adding influx_org and influx_bucket columns to companies table...');
    await pool.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS influx_org TEXT,
      ADD COLUMN IF NOT EXISTS influx_bucket TEXT;
    `);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
