
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    const envPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      const match = env.match(/^DATABASE_URL=(.+)$/m);
      if (match) connectionString = match[1].trim().replace(/^"|"$/g, '');
    }
  }

  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Creating tank_alarm_history table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tank_alarm_history (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        tank_key TEXT NOT NULL,
        tank_name TEXT,
        metric TEXT NOT NULL,
        value NUMERIC,
        threshold NUMERIC,
        threshold_type TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("Table created successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
