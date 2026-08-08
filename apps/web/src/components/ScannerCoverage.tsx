import type { FindingSource } from "@vibeguard/core";
import { SOURCE_META, SOURCE_ORDER } from "@/lib/ui";

/**
 * What actually ran, and what it found.
 *
 * This is the panel that makes a partial scan honest: a scanner that failed is
 * shown as FAILED, not as a clean zero. "0 findings" and "did not run" are
 * deliberately different states, because conflating them is how a security tool
 * lies to you.
 */
export function ScannerCoverage({
  counts,
  failedScanners,
}: {
  counts: Partial<Record<FindingSource, number>>;
  failedScanners: string[];
}) {
  const failed = new Set(failedScanners);

  return (
    <div>
      <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted">
        Scanner coverage
      </h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {SOURCE_ORDER.map((source) => {
          const didFail = failed.has(source) || failed.has(SOURCE_META[source].label);
          const count = counts[source] ?? 0;
          return (
            <li
              key={source}
              className={`brut-flat flex items-center gap-2.5 px-3 py-2 ${
                didFail ? "border-block/60" : ""
              }`}
            >
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 ${SOURCE_META[source].accent}`} />
              <span className="font-mono text-sm text-fg">{SOURCE_META[source].label}</span>
              <span
                className={`ml-auto font-mono text-xs uppercase tracking-wider ${
                  didFail ? "text-block" : "text-fg-muted"
                }`}
              >
                {didFail ? "failed" : count === 0 ? "0 findings" : `${count} found`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The banner above a partial report. Loud on purpose. */
export function PartialScanBanner({ failedScanners }: { failedScanners: string[] }) {
  return (
    <div role="alert" className="brut relative border-2 border-high bg-high/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-high">Partial scan</span>
        <span className="font-mono text-xs text-fg-muted">
          {failedScanners.join(", ")} did not run
        </span>
      </div>
      <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-fg">
        This score reflects fewer checks than a full scan, so treat it as a{" "}
        <strong className="text-high">floor, not a clean bill of health</strong>. The findings below
        are still real — there are simply whole categories nobody looked at.
      </p>
    </div>
  );
}
