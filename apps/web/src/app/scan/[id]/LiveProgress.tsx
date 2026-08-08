"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** The phases a user sees, in order. Per-scanner ticks nest under "scanning". */
const PHASES = [
  { key: "cloning", label: "Cloning repository", detail: "Shallow clone into a disposable sandbox" },
  { key: "scanning", label: "Running scanners", detail: "gitleaks · semgrep · osv-scanner" },
  { key: "analyzing", label: "Explaining findings", detail: "Claude adds why-it-matters and a fix" },
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
    <div className="space-y-5">
      <section aria-labelledby="progress-heading" className="brut border-2 border-line-strong p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2
            id="progress-heading"
            className="display-heading text-base text-fg"
          >
            Scan in progress
          </h2>
          <span className="chip-ghost">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 ${live ? "live-pulse bg-pass" : "bg-fg-muted"}`}
            />
            {live ? "live · websocket" : "polling"}
          </span>
        </div>

        {/* The single announcement region for the whole pipeline. Polite so it
            does not interrupt, and scoped to the phase list so a screen reader
            hears each step once as it completes. */}
        <ol
          aria-live="polite"
          aria-busy={reachedIndex < PHASES.length}
          className="relative mt-6 ml-2 border-l-2 border-line-strong pl-6"
        >
          {PHASES.map((step, index) => {
            const state =
              reachedIndex > index ? "done" : reachedIndex === index ? "active" : "pending";
            return (
              <li key={step.key} className="relative pb-6 last:pb-0">
                <span
                  aria-hidden
                  className={`absolute -left-7.75 top-1 h-3.5 w-3.5 border-2 border-ink ${
                    state === "done"
                      ? "bg-pass"
                      : state === "active"
                        ? "live-pulse bg-brand"
                        : "bg-line-strong"
                  }`}
                />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`font-display text-sm font-bold uppercase tracking-wide ${
                      state === "pending" ? "text-fg-muted" : "text-fg"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">
                    {state === "done" ? "done" : state === "active" ? "running…" : "waiting"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{step.detail}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {log.length > 0 ? (
        <section aria-labelledby="activity-heading" className="brut border-2 border-line-strong p-5 sm:p-6">
          <h2
            id="activity-heading"
            className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted"
          >
            Activity
          </h2>
          <ul className="mt-3 grid gap-1.5 font-mono text-xs">
            {log.map((entry, index) => (
              <li key={`${entry.phase}-${index}`} className="flex flex-wrap gap-x-3">
                <span className="text-brand">{entry.phase}</span>
                <span className="text-fg-muted">{entry.message ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* What the report will look like once the pipeline finishes. */}
      <ReportSkeleton />
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div aria-hidden className="brut border-2 border-line-strong p-5 sm:p-7">
      <div className="flex flex-col items-start gap-7 sm:flex-row sm:items-center">
        <div className="skeleton h-42 w-42 shrink-0 rounded-full" />
        <div className="w-full flex-1 space-y-3">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-4 w-full max-w-md" />
          <div className="skeleton h-4 w-full max-w-sm" />
        </div>
      </div>
      <div className="mt-7 grid gap-3 border-t-2 border-line pt-6 sm:grid-cols-2">
        <div className="skeleton h-10" />
        <div className="skeleton h-10" />
      </div>
    </div>
  );
}

/** `scanning:semgrep` counts as having reached `scanning`. */
function indexOf(phase: string): number {
  if (TERMINAL.has(phase)) return PHASES.length;
  const base = phase.split(":")[0]!;
  const found = PHASES.findIndex((p) => p.key === base);
  return found === -1 ? 0 : found;
}
