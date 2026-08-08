import { Redis } from "ioredis";
import { config, require_ } from "./env.js";

export interface ScanEvent {
  phase: string;
  message?: string | null;
  /** Set by the worker; used to drop replayed duplicates on the client. */
  at?: string;
}

export type ScanEventListener = (event: ScanEvent) => void;

/**
 * A Valkey connection in subscriber mode can only issue subscribe/unsubscribe
 * commands — ordinary commands are rejected. So this must never reuse the
 * client from valkey.ts, which answers /healthz's PING and backs the rate
 * limiter; putting that one into subscriber mode would break both.
 */
let subscriber: Redis | undefined;

/** scanId -> listeners. Empty sets are removed so the map cannot grow forever. */
const listeners = new Map<string, Set<ScanEventListener>>();

function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis({
      host: config.valkey.host ?? require_("VALKEY_HOST"),
      port: config.valkey.port,
      password: config.valkey.password,
      // A dropped progress tick is cosmetic, but a subscriber that gives up
      // permanently silences every open stream, so this one keeps retrying.
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    });

    subscriber.on("error", (err) => console.error("[pubsub] subscriber error:", err.message));

    // Re-subscribe after a reconnect, otherwise streams that were open across a
    // blip would stay silent while looking healthy.
    subscriber.on("ready", () => {
      const channels = [...listeners.keys()].map(channelFor);
      if (channels.length > 0) {
        subscriber!.subscribe(...channels).catch((err) =>
          console.error("[pubsub] resubscribe failed:", err.message),
        );
      }
    });

    subscriber.on("message", (channel, payload) => {
      const scanId = channel.startsWith("scan:") ? channel.slice(5) : channel;
      const set = listeners.get(scanId);
      if (!set || set.size === 0) return;

      let event: ScanEvent;
      try {
        event = JSON.parse(payload) as ScanEvent;
      } catch {
        return; // A malformed publish is dropped, never forwarded.
      }
      for (const listener of set) {
        try {
          listener(event);
        } catch (err) {
          console.error("[pubsub] listener threw:", err instanceof Error ? err.message : err);
        }
      }
    });
  }
  return subscriber;
}

function channelFor(scanId: string): string {
  return `scan:${scanId}`;
}

/**
 * Subscribes to one scan's progress. Returns an unsubscribe function.
 *
 * One shared connection is multiplexed across all open streams and reference
 * counted per scan: the first listener issues SUBSCRIBE, the last one to leave
 * issues UNSUBSCRIBE. A connection per client would be simpler and would leak a
 * Valkey connection for every browser tab.
 *
 * `scanId` must already be validated — it is interpolated into a channel name.
 */
export async function subscribeToScan(
  scanId: string,
  listener: ScanEventListener,
): Promise<() => void> {
  const existing = listeners.get(scanId);
  if (existing) {
    existing.add(listener);
  } else {
    listeners.set(scanId, new Set([listener]));
    await getSubscriber().subscribe(channelFor(scanId));
  }

  let released = false;
  return () => {
    if (released) return; // idempotent: 'close' can fire more than once
    released = true;

    const set = listeners.get(scanId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(scanId);
      subscriber?.unsubscribe(channelFor(scanId)).catch(() => {});
    }
  };
}

/** Exposed for tests and diagnostics: how many scans currently have listeners. */
export function activeSubscriptionCount(): number {
  return listeners.size;
}

export async function closePubsub(): Promise<void> {
  listeners.clear();
  await subscriber?.quit().catch(() => subscriber?.disconnect());
  subscriber = undefined;
}
