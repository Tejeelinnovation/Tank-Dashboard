const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    await client.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS pwd_reset_requested BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS pwd_reset_approved BOOLEAN DEFAULT FALSE
    `);
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
