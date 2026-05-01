const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const envPath = path.join(__dirname, '..', '.env.local');
  let dbUrl = '';
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) {
      dbUrl = match[1].trim();
    }
  }

  if (!dbUrl) {
    console.error("Could not find DATABASE_URL in .env.local");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log("Connected to database...");

    const query = `
      ALTER TABLE company_tank_settings 
      ADD COLUMN IF NOT EXISTS fluid_color VARCHAR(9) DEFAULT NULL, 
      ADD COLUMN IF NOT EXISTS temp_color VARCHAR(9) DEFAULT NULL, 
      ADD COLUMN IF NOT EXISTS disable_volume BOOLEAN DEFAULT FALSE, 
      ADD COLUMN IF NOT EXISTS disable_temperature BOOLEAN DEFAULT FALSE;
    `;

    await client.query(query);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
