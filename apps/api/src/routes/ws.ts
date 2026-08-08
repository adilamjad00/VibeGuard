import type { FastifyInstance } from "fastify";
import { openScanFeed, scanExists } from "../scan-feed.js";
import { isUuid } from "../uuid.js";

const HEARTBEAT_MS = 20_000;
const MAX_STREAM_MS = 10 * 60_000;

export async function wsRoutes(app: FastifyInstance) {
  /**
   * The same progress feed as /stream, over a WebSocket.
   *
   * Why this exists at all: Zerops' shared L7 balancer buffers ordinary
   * responses (`proxy_buffering on`, not configurable for a *.zerops.app
   * subdomain — the routing entries are `isEditable: false` and the platform
   * API exposes no buffering setting at any scope). Once a connection is
   * upgraded to a WebSocket it is a tunnel rather than a buffered response
   * body, so it is not subject to that setting.
   *
   * Identical semantics to SSE — same replay, same ordering, same terminal
   * close — because both share openScanFeed(). Only the framing differs.
   */
  app.get("/scans/:id/ws", { websocket: true }, async (socket, req) => {
    const { id } = req.params as { id: string };

    // Same guard as the SSE route: the id is interpolated into a Valkey channel
    // name, so it is validated before use.
    if (!isUuid(id)) {
      socket.send(JSON.stringify({ phase: "error", message: "invalid scan id" }));
      socket.close();
      return;
    }
    if (!(await scanExists(id))) {
      socket.send(JSON.stringify({ phase: "error", message: "scan not found" }));
      socket.close();
      return;
    }

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
      try {
        socket.close();
      } catch {
        // Already closing; nothing to recover.
      }
    };

    socket.on("close", finish);
    socket.on("error", finish);

    try {
      const feed = await openScanFeed(id, {
        send: (event) => {
          if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
        },
        close: finish,
      });
      feedStop = feed.stop;
    } catch (err) {
      req.log.error({ err, id }, "failed to open scan feed over websocket");
      finish();
      return;
    }

    if (closed) return;

    heartbeat = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping();
    }, HEARTBEAT_MS);

    deadline = setTimeout(finish, MAX_STREAM_MS);
  });
}
