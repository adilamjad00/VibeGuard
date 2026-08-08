import type { FastifyInstance, FastifyReply } from "fastify";
import type { ScanEvent } from "../pubsub.js";
import { openScanFeed, scanExists } from "../scan-feed.js";
import { isUuid } from "../uuid.js";

const HEARTBEAT_MS = 15_000;
/** A scan that has not finished in this long is not going to; free the socket. */
const MAX_STREAM_MS = 10 * 60_000;

export async function streamRoutes(app: FastifyInstance) {
  /**
   * Server-sent progress for one scan.
   *
   * A read-only view of what `GET /scans/:id` already exposes — no new
   * disclosure. The one genuinely new surface is the Valkey channel name, hence
   * the UUID check before the id is used.
   *
   * Note: behind Zerops' shared L7 balancer this response is buffered until the
   * stream ends (measured at 40–66s), so the browser prefers the WebSocket
   * route and falls back to polling. SSE is kept because it is correct and
   * works behind any proxy that does not buffer.
   */
  app.get("/scans/:id/stream", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "invalid scan id" });
    if (!(await scanExists(id))) return reply.code(404).send({ error: "scan not found" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.hijack();

    let heartbeat: NodeJS.Timeout | undefined;
    let deadline: NodeJS.Timeout | undefined;
    let feedStop: (() => void) | undefined;
    let closed = false;

    const finish = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (deadline) clearTimeout(deadline);
      feedStop?.();
      reply.raw.end();
    };

    // Client navigated away or the socket died: release the subscription so the
    // ref count in pubsub.ts can drop the channel.
    req.raw.on("close", finish);

    try {
      const feed = await openScanFeed(id, {
        send: (event) => write(reply, event),
        close: finish,
      });
      feedStop = feed.stop;
    } catch (err) {
      req.log.error({ err, id }, "failed to open scan feed");
      write(reply, { phase: "stream_error", message: "progress unavailable" });
      finish();
      return;
    }

    if (closed) return;

    heartbeat = setInterval(() => {
      // A comment frame keeps proxies from reaping an idle connection during a
      // long clone.
      if (!reply.raw.writableEnded) reply.raw.write(": ping\n\n");
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
