import { fetchHealth } from "@/lib/api";

/**
 * The reference's announcement strip, carrying real data instead of marketing:
 * a live read of every backing service over the Zerops private network. It is
 * the first thing on the page and it is checked on every request, so a
 * degraded dependency is visible before a user submits anything.
 *
 * The bar itself is the status indicator. Brand orange when everything is up,
 * red when it is not — which is louder than a colour-changing dot, and it also
 * sidesteps a contrast problem: a green "ok" dot on an orange bar is close to
 * unreadable. On the bar, dots are drawn in the contrast ink.
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
    <div className={`border-b-2 border-ink ${allOk ? "bg-brand" : "bg-block"} text-ink`}>
      <div className="shell flex flex-wrap items-center gap-x-6 gap-y-1.5 py-2 text-[11px]">
        <span className="font-display font-extrabold uppercase tracking-[0.16em]">
          {allOk ? "All systems operational" : "Degraded"}
        </span>

        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {services.map((service) => {
            const ok = service.state === "ok";
            return (
              <li key={service.name} className="flex items-center gap-1.5 font-mono">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 bg-ink ${ok ? "live-pulse" : ""}`}
                />
                <span className="font-semibold uppercase tracking-wider">{service.name}</span>
                {/* "ok" is carried by the bar's colour, so it is announced but
                    not printed. A failure prints its reason. */}
                <span className={ok ? "sr-only" : "font-semibold"}>
                  {ok ? "ok" : service.state}
                </span>
              </li>
            );
          })}
        </ul>

        <span className="ml-auto hidden font-mono font-semibold uppercase tracking-[0.16em] sm:inline">
          6 services · Zerops · prg1
        </span>
      </div>
    </div>
  );
}
