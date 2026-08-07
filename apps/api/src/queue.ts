import { Queue } from "bullmq";

const connection = {
  host: process.env.VALKEY_HOST!,
  port: Number(process.env.VALKEY_PORT ?? 6379),
  password: process.env.VALKEY_PASSWORD || undefined,
};

export const scanQueue = new Queue("scans", { connection });

export async function enqueueScan(scanId: string, repoUrl: string) {
  await scanQueue.add(
    "scan",
    { scanId, repoUrl },
    { attempts: 2, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 50 }
  );
}
// The worker (apps/worker) creates a `new Worker("scans", processor, { connection })`.
// Progress: worker publishes to Valkey channel `scan:{id}`; api/src/stream.ts subscribes & relays via SSE.
