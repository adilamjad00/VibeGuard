import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { getPool } from "./db.js";
import { getValkey } from "./valkey.js";
import { getBucket, getS3 } from "./s3.js";

export type CheckResult = "ok" | `error: ${string}`;

export interface HealthReport {
  status: "ok" | "degraded";
  db: CheckResult;
  valkey: CheckResult;
  s3: CheckResult;
  uptimeSeconds: number;
}

/** Never rejects — a failed dependency is data, not an exception. */
async function check(fn: () => Promise<unknown>): Promise<CheckResult> {
  try {
    await fn();
    return "ok";
  } catch (err) {
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function healthReport(): Promise<HealthReport> {
  const [db, valkey, s3] = await Promise.all([
    check(() => getPool().query("select 1")),
    check(() => getValkey().ping()),
    check(() => getS3().send(new HeadBucketCommand({ Bucket: getBucket() }))),
  ]);

  const status = db === "ok" && valkey === "ok" && s3 === "ok" ? "ok" : "degraded";
  return { status, db, valkey, s3, uptimeSeconds: Math.round(process.uptime()) };
}
