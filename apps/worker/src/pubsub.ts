import { Redis } from "ioredis";

let publisher: Redis | undefined;

/**
 * PUBLISH is an ordinary command, so this is a normal connection — only the
 * *subscriber* side (in the api) is restricted to subscribe commands.
 */
function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis({
      host: process.env.VALKEY_HOST!,
      port: Number(process.env.VALKEY_PORT ?? 6379),
      password: process.env.VALKEY_PASSWORD || undefined,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    publisher.on("error", (err) => console.error("[pubsub] publisher error:", err.message));
  }
  return publisher;
}

/**
 * Announce a scan phase to anyone streaming it.
 *
 * Fire-and-forget by design. Progress is a cosmetic overlay on a pipeline whose
 * real state lives in Postgres, so a Valkey blip must degrade the animation and
 * nothing else — it must never fail a scan or lose a finding. Every event is
 * also written to `scan_events` by the caller, which is what lets a late client
 * replay the ones it missed.
 */
export async function publishScanEvent(
  scanId: string,
  phase: string,
  message?: string | null,
): Promise<void> {
  try {
    await getPublisher().publish(
      `scan:${scanId}`,
      JSON.stringify({ phase, message: message ?? null, at: new Date().toISOString() }),
    );
  } catch (err) {
    console.error(`[pubsub] publish failed for ${scanId}/${phase}:`, err instanceof Error ? err.message : err);
  }
}

export async function closePublisher(): Promise<void> {
  await publisher?.quit().catch(() => publisher?.disconnect());
  publisher = undefined;
}
