import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function migrate() {
  console.log("Starting migration...");
  const { pool } = await import("@/lib/postgres");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create company_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create user_tank_permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_tank_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES company_users(id) ON DELETE CASCADE,
        tank_key TEXT NOT NULL,
        access_level TEXT NOT NULL DEFAULT 'view',
        UNIQUE(user_id, tank_key)
      );
    `);

    await client.query("COMMIT");
    console.log("Migration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
