import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | null | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

const isLocal = databaseUrl?.includes("localhost") || databaseUrl?.includes("127.0.0.1");
const useSsl = databaseUrl && !isLocal && !databaseUrl.includes("sslmode=disable");

export const pool =
  global.__pgPool ??
  (databaseUrl 
    ? new Pool({
        connectionString: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 10000,
      })
    : null) as Pool;

if (!pool && process.env.NODE_ENV === "development") {
  console.warn("⚠️ DATABASE_URL is missing. Database features will not work.");
}

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}