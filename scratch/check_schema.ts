import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function checkSchema() {
  const { pool } = await import("../src/lib/postgres");
  if (!pool) {
    console.error("Pool is null. Check DATABASE_URL in .env.local");
    return;
  }
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tank_alarm_history'
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit();
}

checkSchema();
