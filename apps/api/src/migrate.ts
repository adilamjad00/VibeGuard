import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.js";

/**
 * Applies schema.sql on API boot.
 *
 * Every statement is `create ... if not exists`, so this is idempotent and safe
 * to run on every start and on every replica. That buys us a migration path
 * with no psql, no VPN tunnel and no one-shot job in the critical path — which
 * matters when the whole deploy has to come up unattended.
 *
 * `uuid-ossp` needs privileges the managed DB user may not have. If that single
 * statement is the only thing that fails we retry the rest with pgcrypto's
 * gen_random_uuid(), which is built into PostgreSQL 13+ and needs no extension.
 */
export async function migrate(): Promise<void> {
  const path = fileURLToPath(new URL("./schema.sql", import.meta.url));
  const sql = await readFile(path, "utf8");

  try {
    await getPool().query(sql);
    console.log("[migrate] schema applied");
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/uuid-ossp|uuid_generate_v4|permission denied to create extension/i.test(message)) {
      throw err;
    }
    console.warn(`[migrate] uuid-ossp unavailable (${message}); falling back to gen_random_uuid()`);
  }

  const fallback = sql
    .replace(/create extension if not exists "uuid-ossp";\s*/i, "")
    .replaceAll("uuid_generate_v4()", "gen_random_uuid()");

  await getPool().query(fallback);
  console.log("[migrate] schema applied using gen_random_uuid()");
}
