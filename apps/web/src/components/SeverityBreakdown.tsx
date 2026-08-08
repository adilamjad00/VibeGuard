import { SEVERITY_ORDER, type Severity } from "@vibeguard/core";
import { SEVERITY_CHIP, SEVERITY_TEXT } from "@/lib/ui";

/**
 * Counts by severity, worst first, always showing all five.
 *
 * Zeroes are rendered dimmed rather than dropped: "0 critical" is a result, and
 * hiding it would make an empty row indistinguishable from a missing check.
 */
export function SeverityBreakdown({
  counts,
  total,
}: {
  counts: Record<Severity, number>;
  total: number;
}) {
  return (
    <div>
      <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted">
        Severity breakdown
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {SEVERITY_ORDER.map((severity) => {
          const count = counts[severity] ?? 0;
          const empty = count === 0;
          return (
            <li key={severity}>
              <span
                className={`chip ${empty ? "border-line bg-transparent text-fg-muted" : SEVERITY_CHIP[severity]}`}
              >
                <span className="tabular-nums">{count}</span>
                {severity}
              </span>
            </li>
          );
        })}
      </ul>

      {total > 0 ? (
        <div className="mt-3">
          {/* A single proportional bar: how the findings are distributed, which
              is faster to read than five numbers when the counts are large. */}
          <div
            className="flex h-2.5 w-full overflow-hidden border-2 border-line-strong"
            role="img"
            aria-label={SEVERITY_ORDER.filter((s) => (counts[s] ?? 0) > 0)
              .map((s) => `${counts[s]} ${s}`)
              .join(", ")}
          >
            {SEVERITY_ORDER.map((severity) => {
              const count = counts[severity] ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={severity}
                  className={SEVERITY_CHIP[severity]}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Compact inline counts, for list rows where a full breakdown is too heavy. */
export function SeverityInline({ counts }: { counts: Record<Severity, number> }) {
  const present = SEVERITY_ORDER.filter((severity) => (counts[severity] ?? 0) > 0);
  if (present.length === 0) return <span className="text-xs text-fg-muted">no findings</span>;

  return (
    <span className="flex flex-wrap items-center gap-2 font-mono text-xs">
      {present.map((severity) => (
        <span key={severity} className={SEVERITY_TEXT[severity]}>
          {counts[severity]} {severity}
        </span>
      ))}
    </span>
  );
}
