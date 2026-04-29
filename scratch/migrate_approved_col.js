
const { Pool } = require('pg');

async function migrate() {
  // Assuming DATABASE_URL is in environment (Node --env-file will provide it)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Checking columns...");
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'pwd_reset_approved';
    `);

    if (checkRes.rows.length === 0) {
      console.log("Adding column pwd_reset_approved...");
      await pool.query(`ALTER TABLE companies ADD COLUMN pwd_reset_approved BOOLEAN DEFAULT FALSE;`);
      console.log("Column added.");
    } else {
      console.log("Column pwd_reset_approved already exists.");
    }
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
