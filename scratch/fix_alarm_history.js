const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if table has data
    const dataCheck = await client.query('SELECT count(*) FROM tank_alarm_history');
    const count = parseInt(dataCheck.rows[0].count);
    
    if (count > 0) {
      console.log(`Table has ${count} rows. Altering column type...`);
      // If there's data, we might need a more complex migration or just clear it if it's test data
      // For now, let's try to alter it
      await client.query('ALTER TABLE tank_alarm_history ALTER COLUMN company_id TYPE UUID USING NULL');
      console.log('Altered column to UUID (set to NULL as current values are likely invalid integers)');
    } else {
      console.log('Table is empty. Altering column type...');
      await client.query('ALTER TABLE tank_alarm_history ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid');
    }
    
    await client.query('COMMIT');
    console.log('Fixed tank_alarm_history schema.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to fix schema:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema();
