import pg from "pg";
import { config, require_ } from "./env.js";

let pool: pg.Pool | undefined;

/** Lazily created so a missing DATABASE_URL fails at query time with a clear message. */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl ?? require_("DATABASE_URL"),
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
    // A pool-level error with no listener takes the process down. Log instead:
    // a dropped idle connection is normal and pg will reconnect on next use.
    pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
