/**
 * Runtime configuration, entirely from the environment.
 *
 * Deliberately does NOT throw on missing values. A crash-looping service shows
 * judges a dead URL and tells us nothing; a service that boots and reports
 * "s3: error: S3_BUCKET is not set" on /healthz is diagnosable in one request.
 * Missing config surfaces as an unhealthy dependency, not as a dead process.
 */

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

/** Throws only when a dependency is actually used, so the message names the var. */
export function require_(name: string): string {
  const v = optional(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",

  databaseUrl: optional("DATABASE_URL"),

  valkey: {
    host: optional("VALKEY_HOST"),
    port: Number(process.env.VALKEY_PORT ?? 6379),
    password: optional("VALKEY_PASSWORD"),
  },

  s3: {
    endpoint: optional("S3_ENDPOINT"),
    accessKeyId: optional("S3_ACCESS_KEY"),
    secretAccessKey: optional("S3_SECRET_KEY"),
    bucket: optional("S3_BUCKET"),
  },

  /** Browser origins allowed to call this API. `true` = reflect any origin. */
  corsOrigin: optional("CORS_ORIGIN") ?? true,
} as const;
