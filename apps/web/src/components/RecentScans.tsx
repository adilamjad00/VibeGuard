import Link from "next/link";
import type { ScanListItem } from "@/lib/api";
import { VERDICT_CHIP, VERDICT_TEXT } from "@/lib/ui";

const RUNNING = new Set(["queued", "cloning", "scanning", "analyzing"]);

/**
 * The most recent scans. Doubles as the empty state for a fresh deployment —
 * an empty list is a real answer, not a broken panel, so it says so and points
 * back at the one action.
 */
export function RecentScans({ scans }: { scans: ScanListItem[] }) {
  if (scans.length === 0) {
    return (
      <div className="brut border-2 border-line-strong p-8 text-center">
        <p className="display-heading text-lg text-fg">No scans yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-muted">
          Nothing has been scanned on this deployment. Paste a public GitHub repository above and
          the pipeline will run gitleaks, semgrep and osv-scanner against it.
        </p>
        <Link href="#scan" className="brut-btn-ghost mt-5 px-4 py-2 text-xs no-underline">
          Scan the first repo
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-2.5">
      {scans.map((scan) => (
        <li key={scan.id}>
          <Link
            href={`/scan/${scan.id}`}
            className="brut brut-hover flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-line-strong px-4 py-3 no-underline"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">
              {scan.repoUrl.replace(/^https:\/\/github\.com\//, "")}
            </span>

            {RUNNING.has(scan.status) ? (
              <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-fg-muted">
                <span aria-hidden className="live-pulse h-1.5 w-1.5 bg-brand" />
                {scan.status}
              </span>
            ) : scan.status === "failed" ? (
              <span className="chip-ghost border-block/60 text-block">failed</span>
            ) : scan.verdict ? (
              <>
                <span className={`font-display text-lg font-extrabold tabular-nums ${VERDICT_TEXT[scan.verdict]}`}>
                  {scan.score}
                </span>
                <span className={`chip ${VERDICT_CHIP[scan.verdict]}`}>{scan.verdict}</span>
              </>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
