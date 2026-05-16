const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function inspect() {
  try {
    console.log("--- user_tank_permissions ---");
    const res = await pool.query("SELECT * FROM user_tank_permissions");
    console.table(res.rows);

    console.log("\n--- company_tank_settings ---");
    const res2 = await pool.query("SELECT tank_key, tank_name, company_id FROM company_tank_settings");
    console.table(res2.rows);

    console.log("\n--- company_users ---");
    const res3 = await pool.query("SELECT id, username, company_id FROM company_users");
    console.table(res3.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
