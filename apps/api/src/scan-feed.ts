import { getPool } from "./db.js";
import { subscribeToScan, type ScanEvent } from "./pubsub.js";

export const TERMINAL_PHASES = new Set(["done", "failed"]);

export interface FeedSink {
  /** Deliver one event to the client. */
  send(event: ScanEvent): void;
  /** Called once the scan reaches a terminal phase. */
  close(): void;
}

export interface ScanFeed {
  /** Idempotent; safe to call from a disconnect handler. */
  stop(): void;
}

/**
 * The progress feed for one scan, independent of transport.
 *
 * Extracted so SSE and WebSocket cannot drift apart: the ordering rule below is
 * the subtle part, and having two copies of it would mean two chances to get it
 * wrong.
 *
 * Ordering: subscribe FIRST, buffer what arrives, then replay history, then
 * flush the buffer. The intuitive order — read `scan_events`, then subscribe —
 * silently drops anything published in the gap between the two, which is
 * exactly when a fast scan emits it.
 *
 * `scanId` must already be validated as a UUID: it is interpolated into a
 * Valkey channel name.
 */
export async function openScanFeed(scanId: string, sink: FeedSink): Promise<ScanFeed> {
  const buffered: ScanEvent[] = [];
  const seen = new Set<string>();
  let replaying = true;
  let stopped = false;
  let unsubscribe: (() => void) | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    unsubscribe?.();
  };

  const emit = (event: ScanEvent) => {
    if (stopped) return;
    const key = `${event.phase}|${event.message ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    sink.send(event);
    if (TERMINAL_PHASES.has(event.phase)) {
      stop();
      sink.close();
    }
  };

  unsubscribe = await subscribeToScan(scanId, (event) => {
    if (replaying) buffered.push(event);
    else emit(event);
  });

  try {
    const history = await getPool().query<{ phase: string; message: string | null }>(
      `select phase, message from scan_events where scan_id = $1 order by created_at asc`,
      [scanId],
    );
    for (const row of history.rows) {
      if (stopped) return { stop };
      emit({ phase: row.phase, message: row.message });
    }

    // The terminal state lives on `scans.status`, not necessarily in
    // scan_events, so a finished scan is resolved explicitly. This is what
    // makes a client that connects late — or after the scan ended — still get
    // the full picture and an immediate close.
    const current = await getPool().query<{ status: string }>(
      `select status from scans where id = $1`,
      [scanId],
    );
    const status = current.rows[0]?.status;
    if (status && TERMINAL_PHASES.has(status)) emit({ phase: status });
  } finally {
    replaying = false;
  }

  for (const event of buffered) {
    if (stopped) break;
    emit(event);
  }

  return { stop };
}

/** Shared by both transports: does this scan exist? */
export async function scanExists(scanId: string): Promise<boolean> {
  const { rows } = await getPool().query(`select 1 from scans where id = $1`, [scanId]);
  return rows.length > 0;
}
