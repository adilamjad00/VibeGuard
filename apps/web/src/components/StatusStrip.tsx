import { fetchHealth } from "@/lib/api";

/**
 * The reference's announcement strip, carrying real data instead of marketing:
 * a live read of every backing service over the Zerops private network. It is
 * the first thing on the page and it is checked on every request, so a
 * degraded dependency is visible before a user submits anything.
 */
export async function StatusStrip() {
  const probe = await fetchHealth();

  const services: Array<{ name: string; state: string }> = probe.reachable
    ? [
        { name: "api", state: "ok" },
        { name: "postgres", state: probe.report.db },
        { name: "valkey", state: probe.report.valkey },
        { name: "storage", state: probe.report.s3 },
      ]
    : [{ name: "api", state: probe.error }];

  const allOk = probe.reachable && probe.report.status === "ok";

  return (
    <div className="border-b-2 border-line bg-ink-2">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-1.5 text-[11px] sm:px-6">
        <span className="font-mono font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {allOk ? "All systems live" : "Degraded"}
        </span>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {services.map((service) => {
            const ok = service.state === "ok";
            return (
              <li key={service.name} className="flex items-center gap-1.5 font-mono">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 ${ok ? "bg-pass live-pulse" : "bg-block"}`}
                />
                <span className="uppercase tracking-wider text-fg-muted">{service.name}</span>
                <span className={ok ? "sr-only" : "text-block"}>
                  {ok ? "ok" : service.state}
                </span>
              </li>
            );
          })}
        </ul>
        <span className="ml-auto hidden font-mono uppercase tracking-[0.14em] text-fg-muted sm:inline">
          6 services · Zerops · prg1
        </span>
      </div>
    </div>
  );
}
