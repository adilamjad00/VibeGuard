import Link from "next/link";
import type { ScanListItem } from "@/lib/api";
import { VERDICT_CHIP, VERDICT_COPY, VERDICT_TEXT } from "@/lib/ui";

/**
 * A compact card for the most recent completed scan on this deployment.
 *
 * Real data or nothing. There is no illustrative mock-up here: a security
 * product showing an invented report as if it were output is exactly the kind
 * of thing this product exists to catch.
 */
export function ReportPreview({ scan }: { scan: ScanListItem | null }) {
  if (!scan || scan.verdict === null || scan.score === null) {
    return (
      <div className="brut border-2 border-line-strong p-8 text-center">
        <p className="display-heading text-lg text-fg">No completed scans yet</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-muted">
          This deployment has not finished a scan yet, so there is nothing real to show here — and a
          mocked-up report would be the wrong thing to put on a security product.
        </p>
        <Link href="/scan" className="brut-btn mt-6 px-5 py-2.5 text-xs no-underline">
          Run the first scan
        </Link>
      </div>
    );
  }

  const copy = VERDICT_COPY[scan.verdict];

  return (
    <Link
      href={`/scan/${scan.id}`}
      className="brut brut-hover group block border-2 border-line-strong p-6 no-underline sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`chip ${VERDICT_CHIP[scan.verdict]}`}>{scan.verdict}</span>
        <span className="font-mono text-xs text-fg-muted">
          {scan.repoUrl.replace(/^https:\/\/github\.com\//, "")}
        </span>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-fg-muted">
          Most recent scan
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <div className={`display-heading text-6xl tabular-nums ${VERDICT_TEXT[scan.verdict]}`}>
            {scan.score}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted">
            Ship readiness / 100
          </div>
        </div>

        <p className="max-w-md flex-1 text-sm leading-relaxed text-fg-muted">
          <strong className="font-semibold text-fg">{copy.headline}.</strong> {copy.body}
        </p>
      </div>

      <span className="mt-6 inline-block font-display text-xs font-bold uppercase tracking-[0.12em] text-fg-muted group-hover:text-brand">
        Open the full report →
      </span>
    </Link>
  );
}
