import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { pool } from "./src/lib/postgres";

async function checkSchema() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tank_alarm_history'
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit();
}

checkSchema();
