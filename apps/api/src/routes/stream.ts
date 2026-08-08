import type { FastifyInstance, FastifyReply } from "fastify";
import { getPool } from "../db.js";
import { subscribeToScan, type ScanEvent } from "../pubsub.js";
import { isUuid } from "../uuid.js";

const HEARTBEAT_MS = 15_000;
/** A scan that has not finished in this long is not going to; free the socket. */
const MAX_STREAM_MS = 10 * 60_000;

const TERMINAL = new Set(["done", "failed"]);

export async function streamRoutes(app: FastifyInstance) {
  /**
   * Server-sent progress for one scan.
   *
   * This is a read-only view of information `GET /scans/:id` already exposes —
   * it adds no new disclosure. The one genuinely new surface is the Valkey
   * channel name, which is why the id is validated as a UUID before it is
   * interpolated into it.
   */
  app.get("/scans/:id/stream", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "invalid scan id" });

    const { rows } = await getPool().query<{ status: string }>(
      `select status from scans where id = $1`,
      [id],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "scan not found" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Without this a buffering reverse proxy holds the whole stream until the
      // scan ends, which looks exactly like the feature not working.
      "X-Accel-Buffering": "no",
    });
    reply.hijack();

    // Subscribe BEFORE reading history. The intuitive order — read the table,
    // then subscribe — silently drops any event published in the gap between
    // the two, which is precisely when a fast scan emits them.
    const buffered: ScanEvent[] = [];
    let replaying = true;
    const seen = new Set<string>();

    const send = (event: ScanEvent) => {
      const key = `${event.phase}|${event.message ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      write(reply, event);
      if (TERMINAL.has(event.phase)) finish();
    };

    let unsubscribe: (() => void) | undefined;
    let heartbeat: NodeJS.Timeout | undefined;
    let deadline: NodeJS.Timeout | undefined;
    let closed = false;

    function finish() {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (deadline) clearTimeout(deadline);
      unsubscribe?.();
      reply.raw.end();
    }

    // Client navigated away or the socket died: release the subscription so the
    // ref count in pubsub.ts can drop the channel.
    req.raw.on("close", finish);

    try {
      unsubscribe = await subscribeToScan(id, (event) => {
        if (replaying) buffered.push(event);
        else send(event);
      });
    } catch (err) {
      req.log.error({ err, id }, "failed to subscribe to scan progress");
      write(reply, { phase: "stream_error", message: "progress unavailable" });
      finish();
      return;
    }

    if (closed) return; // client vanished during subscribe

    // Replay what already happened, so a client that connects late — or after
    // the scan finished entirely — still gets the full picture.
    try {
      const history = await getPool().query<{ phase: string; message: string | null }>(
        `select phase, message from scan_events where scan_id = $1 order by created_at asc`,
        [id],
      );
      for (const row of history.rows) {
        if (closed) return;
        send({ phase: row.phase, message: row.message });
      }

      // The terminal event lives on `scans.status`, not necessarily in
      // scan_events, so a finished scan is resolved explicitly here.
      const current = await getPool().query<{ status: string }>(
        `select status from scans where id = $1`,
        [id],
      );
      const status = current.rows[0]?.status;
      if (status && TERMINAL.has(status)) send({ phase: status });
    } catch (err) {
      req.log.error({ err, id }, "failed to replay scan history");
    } finally {
      replaying = false;
    }

    if (closed) return;
    for (const event of buffered) {
      send(event);
      if (closed) return;
    }

    heartbeat = setInterval(() => {
      // A comment frame: keeps proxies and load balancers from reaping an idle
      // connection during a long clone.
      reply.raw.write(": ping\n\n");
    }, HEARTBEAT_MS);

    deadline = setTimeout(() => {
      write(reply, { phase: "stream_timeout", message: "stream closed; reload for current status" });
      finish();
    }, MAX_STREAM_MS);
  });
}

function write(reply: FastifyReply, event: ScanEvent): void {
  if (reply.raw.writableEnded) return;
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}
