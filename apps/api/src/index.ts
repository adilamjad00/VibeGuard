import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./env.js";
import { migrate } from "./migrate.js";
import { healthReport } from "./health.js";
import { closePool } from "./db.js";
import { closeValkey, getValkey } from "./valkey.js";
import { scanRoutes } from "./routes/scans.js";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  // Zerops terminates TLS in front of the service; trust its forwarding headers
  // so request logs and any future rate limiting see the real client IP.
  trustProxy: true,
});

await app.register(cors, { origin: config.corsOrigin });

// Each accepted POST /scans makes a private worker clone an arbitrary remote
// repository. Without a cap this endpoint is a fetch amplifier pointed at
// GitHub, so it is rate limited by source IP. Reads are left generous — the
// frontend polls them.
//
// The counter lives in Valkey, not in process memory. An in-memory store is
// per-replica, so scaling `api` to N containers silently multiplies the real
// limit by N — the one thing this control exists to prevent.
await app.register(rateLimit, {
  global: false,
  max: 10,
  timeWindow: "1 minute",
  redis: getValkey(),
  // Distinct prefix so these counters can never collide with BullMQ's keys in
  // the same Valkey instance.
  nameSpace: "vibeguard-ratelimit:",
  // Fail open if Valkey is unreachable. That sounds permissive for a security
  // control, but POST /scans enqueues through the same Valkey — if it is down
  // the request already fails at enqueueScan with a 503, so failing closed here
  // would only swap one rejection for a less informative one.
  skipOnError: true,
});

await app.register(scanRoutes);

/**
 * Reports each dependency independently and answers 503 unless all three are
 * healthy, so "green" is something curl can assert rather than something a
 * human has to eyeball.
 */
app.get("/healthz", async (_req, reply) => {
  const report = await healthReport();
  return reply.code(report.status === "ok" ? 200 : 503).send(report);
});

app.get("/", async () => ({
  name: "vibeguard-api",
  status: "ok",
  endpoints: ["/healthz"],
}));

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  try {
    await app.close();
    await Promise.allSettled([closePool(), closeValkey()]);
  } finally {
    process.exit(0);
  }
}
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => void shutdown(signal));
}

// The migration must not gate listening. If the DB is briefly unreachable while
// the managed service starts, we still want the port open and /healthz telling
// the truth rather than a crash loop and an unreachable URL.
try {
  await migrate();
} catch (err) {
  app.log.error({ err }, "migration failed; continuing so /healthz can report it");
}

await app.listen({ port: config.port, host: config.host });
app.log.info(`vibeguard-api listening on ${config.host}:${config.port}`);
