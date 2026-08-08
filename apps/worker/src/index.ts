import { Worker, type Job } from "bullmq";
import { checkScannerTools } from "./toolcheck.js";
import { runScan, type ScanJob } from "./pipeline.js";
import { isLlmConfigured } from "./llm.js";
import { closePool } from "./db.js";

const connection = {
  host: process.env.VALKEY_HOST!,
  port: Number(process.env.VALKEY_PORT ?? 6379),
  password: process.env.VALKEY_PASSWORD || undefined,
  // BullMQ requires this on the consumer side: with ioredis' default retry cap
  // the blocking commands a Worker relies on error out instead of waiting.
  maxRetriesPerRequest: null,
};

await checkScannerTools();

// Same reasoning as the scanner probe: whether the key reached the container is
// otherwise invisible until a scan quietly comes back without explanations.
// Reports presence only — the value is never logged.
console.log(
  isLlmConfigured()
    ? "[llm] LLM_API_KEY present — findings will be explained"
    : "[llm] LLM_API_KEY not set — findings will have no explanations (supported)",
);

async function processScan(job: Job<ScanJob>) {
  console.log(`[worker] received job ${job.id}`, job.data);
  await runScan(job.data);
  return { ok: true };
}

const worker = new Worker("scans", processScan, { connection, concurrency: 1 });

worker.on("ready", () => console.log("[worker] ready"));
worker.on("error", (err) => console.error("[worker] error:", err.message));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));
worker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));

// Zerops sends SIGTERM on redeploy and when scaling in. close() lets an
// in-flight scan finish instead of leaving the job stuck until its lock expires.
async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, draining`);
  try {
    await worker.close();
    await closePool();
  } finally {
    process.exit(0);
  }
}
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => void shutdown(signal));
}
