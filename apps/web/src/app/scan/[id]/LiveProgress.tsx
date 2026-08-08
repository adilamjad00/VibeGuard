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
 * How long to wait for the first event before assuming the stream is being
 * buffered somewhere and falling back to polling. Replayed history arrives
 * immediately on connect, so a healthy stream always beats this comfortably.
 */
const STALL_TIMEOUT_MS = 4000;

interface Event {
  phase: string;
  message?: string | null;
}

/**
 * Live scan progress over SSE, with a polling fallback.
 *
 * The fallback is not belt-and-braces: SSE dies quietly behind a buffering
 * proxy, and a progress page that silently stops updating is worse than one
 * that never claimed to be live. If the stream errors or stalls, this reverts
 * to the Phase 3 behaviour — re-checking the report until it is ready.
 */
export function LiveProgress({ scanId, initialStatus }: { scanId: string; initialStatus: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState(initialStatus);
  const [log, setLog] = useState<Event[]>([]);
  const [live, setLive] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    // router.refresh() re-runs the server component, which then renders the
    // finished report instead of this component.
    const complete = () => {
      if (finished.current) return;
      finished.current = true;
      router.refresh();
    };

    const source = new EventSource(`/api/scans/${scanId}/stream`);
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
          // Keep polling; a transient network error is not a reason to give up.
        }
      }, 3000);
    };

    // A buffering reverse proxy does not error — it accepts the connection and
    // holds every byte until the response ends, so `onerror` never fires and
    // the page would sit frozen on "Cloning" until the scan finished. Measured
    // on this deployment: nginx held the whole stream for 66s. So silence is
    // treated as failure too, and polling starts if nothing arrives promptly.
    const stall = setTimeout(startPolling, STALL_TIMEOUT_MS);

    source.onopen = () => setLive(true);

    source.onmessage = (message) => {
      clearTimeout(stall);
      setLive(true);
      let event: Event;
      try {
        event = JSON.parse(message.data) as Event;
      } catch {
        return;
      }
      setPhase(event.phase);
      setLog((entries) => [...entries, event]);
      if (TERMINAL.has(event.phase)) {
        source.close();
        complete();
      }
    };

    source.onerror = () => {
      // EventSource retries on its own, but if the connection never establishes
      // the user would sit on a dead page — so polling takes over regardless.
      setLive(false);
      startPolling();
    };

    return () => {
      clearTimeout(stall);
      source.close();
      if (poll) clearInterval(poll);
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
