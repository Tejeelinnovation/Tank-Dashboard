const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      ALTER TABLE company_tank_settings 
      ADD COLUMN IF NOT EXISTS fluid_color VARCHAR(9) DEFAULT NULL, 
      ADD COLUMN IF NOT EXISTS temp_color VARCHAR(9) DEFAULT NULL, 
      ADD COLUMN IF NOT EXISTS disable_volume BOOLEAN DEFAULT FALSE, 
      ADD COLUMN IF NOT EXISTS disable_temperature BOOLEAN DEFAULT FALSE;
    `);
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
