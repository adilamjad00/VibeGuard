"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** The phases a user sees, in order. Per-scanner ticks nest under "scanning". */
const PHASES = [
  { key: "cloning", label: "Cloning repository" },
  { key: "scanning", label: "Running scanners" },
  { key: "analyzing", label: "Explaining findings" },
] as const;

const TERMINAL = new Set(["done", "failed"]);

/**
 * How long to wait for the first frame before falling back to polling. Replayed
 * history arrives immediately on connect, so a healthy socket always beats this.
 */
const STALL_TIMEOUT_MS = 4000;
const POLL_INTERVAL_MS = 3000;

interface Event {
  phase: string;
  message?: string | null;
}

/**
 * Live scan progress over a WebSocket, falling back to polling.
 *
 * WebSocket rather than SSE, for a measured reason: Zerops' shared L7 balancer
 * has `proxy_buffering on` and it is not configurable for a *.zerops.app
 * subdomain (the routing entries are `isEditable: false` and the platform API
 * exposes no buffering setting at any scope). That holds an SSE response until
 * the stream ends — measured at 40–66s, i.e. the entire scan. An upgraded
 * WebSocket is a tunnel rather than a buffered response body, so it is not
 * subject to that setting. Measured over the same scan: frames at +16.7s,
 * +17.3s, +32.9s, +41.5s instead of all at once on close.
 *
 * The SSE endpoint still exists and is still correct; it is simply the wrong
 * transport for this particular proxy.
 */
export function LiveProgress({ scanId, initialStatus }: { scanId: string; initialStatus: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState(initialStatus);
  const [log, setLog] = useState<Event[]>([]);
  const [live, setLive] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    // router.refresh() re-runs the server component, which then renders the
    // finished report in place of this component.
    const complete = () => {
      if (finished.current) return;
      finished.current = true;
      router.refresh();
    };

    let poll: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        try {
          const res = await fetch(`/api/scans/${scanId}`, { cache: "no-store" });
          if (!res.ok) return;
          const scan = (await res.json()) as { status: string };
          setPhase(scan.status);
          if (TERMINAL.has(scan.status)) {
            clearInterval(poll);
            complete();
          }
        } catch {
          // Transient network errors are not a reason to stop polling.
        }
      }, POLL_INTERVAL_MS);
    };

    // A buffering proxy does not raise an error — it accepts the connection and
    // goes silent — so silence has to be treated as failure too. Without this
    // the page would sit frozen on "Cloning" until the scan finished.
    const stall = setTimeout(startPolling, STALL_TIMEOUT_MS);

    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${window.location.host}/api/scans/${scanId}/ws`);

    socket.onopen = () => setLive(true);

    socket.onmessage = (message) => {
      clearTimeout(stall);
      setLive(true);
      let event: Event;
      try {
        event = JSON.parse(message.data as string) as Event;
      } catch {
        return;
      }
      setPhase(event.phase);
      setLog((entries) => [...entries, event]);
      if (TERMINAL.has(event.phase)) {
        socket.close();
        complete();
      }
    };

    const degrade = () => {
      setLive(false);
      // If the socket closed before a terminal event, the scan is still running
      // and something ate the connection — poll instead of stranding the user.
      if (!finished.current) startPolling();
    };
    socket.onerror = degrade;
    socket.onclose = degrade;

    return () => {
      clearTimeout(stall);
      if (poll) clearInterval(poll);
      socket.close();
    };
  }, [scanId, router]);

  const reachedIndex = indexOf(phase);

  return (
    <>
      <div className="panel">
        <h2>Progress {live ? <span className="live-dot" aria-hidden /> : null}</h2>
        <ol className="checks" aria-live="polite">
          {PHASES.map((p, i) => {
            const state = reachedIndex > i ? "done" : reachedIndex === i ? "active" : "pending";
            return (
              <li className="check" key={p.key}>
                <span className={`dot ${state === "pending" ? "" : "ok"}`} />
                <span className={`name phase-${state}`}>{p.label}</span>
                {state === "active" ? <span className="hint">in progress…</span> : null}
              </li>
            );
          })}
        </ol>
      </div>

      {log.length > 0 ? (
        <div className="panel">
          <h2>Activity</h2>
          <div className="checks">
            {log.map((entry, i) => (
              <div className="check" key={`${entry.phase}-${i}`}>
                <span className="name">{entry.phase}</span>
                <span className="value">{entry.message ?? ""}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** `scanning:semgrep` counts as having reached `scanning`. */
function indexOf(phase: string): number {
  if (TERMINAL.has(phase)) return PHASES.length;
  const base = phase.split(":")[0]!;
  const found = PHASES.findIndex((p) => p.key === base);
  return found === -1 ? 0 : found;
}
