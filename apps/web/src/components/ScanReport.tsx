import {
  countBySeverity,
  countBySource,
  isAdvisory,
  sortBySeverity,
} from "@vibeguard/core";
import type { Scan, ScanDiffPayload } from "@/lib/api";
import { ScanDiff } from "./ScanDiff";
import { RescanButton } from "./RescanButton";
import { AdvisoryFindings } from "./AdvisoryFindings";
import { MarkdownExport } from "./MarkdownExport";
import { VERDICT_CHIP, VERDICT_COPY, VERDICT_TEXT } from "@/lib/ui";
import { ScoreGauge } from "./ScoreGauge";
import { SeverityBreakdown } from "./SeverityBreakdown";
import { PartialScanBanner, ScannerCoverage } from "./ScannerCoverage";
import { FindingCard } from "./FindingCard";
import { ReportDownload } from "./ReportDownload";
import { SectionHeading } from "./SectionHeading";

/**
 * The completed report.
 *
 * Order is deliberate: verdict, then score, then what was checked, then the
 * findings. A judge or a developer should be able to stop reading after the
 * first screen and still have the answer they came for.
 */
export function ScanReport({ scan, diff }: { scan: Scan; diff: ScanDiffPayload | null }) {
  // The score, the breakdown and the findings list are scanner output only.
  // Advisory observations are shown, but in their own section and never mixed
  // into the numbers the verdict is built from.
  const scanner = scan.findings.filter((f) => !isAdvisory(f));
  const advisory = sortBySeverity(scan.findings.filter(isAdvisory));

  const findings = sortBySeverity(scanner);
  const counts = countBySeverity(scanner);
  const bySource = countBySource(scanner);
  const failedScanners = scan.summary?.failedScanners ?? [];

  // A scan can only reach `done` with a score and verdict, but the column is
  // nullable, so this renders something sane rather than "null / 100".
  const verdict = scan.verdict ?? "review";
  const score = scan.score ?? 0;
  const copy = VERDICT_COPY[verdict];

  return (
    <div className="space-y-8">
      {failedScanners.length > 0 ? <PartialScanBanner failedScanners={failedScanners} /> : null}

      {/* ── Verdict + score ─────────────────────────────────────────────── */}
      <section aria-labelledby="verdict-heading" className="brut border-2 border-line-strong relative p-6 sm:p-8">
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <ScoreGauge score={score} verdict={verdict} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${VERDICT_CHIP[verdict]} px-2.5 py-1 text-sm`}>{verdict}</span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">
                Ship readiness
              </span>
            </div>

            <h2 id="verdict-heading" className={`display-heading mt-3 text-2xl ${VERDICT_TEXT[verdict]}`}>
              {copy.headline}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{copy.body}</p>

            <p className="mt-4 max-w-2xl border-l-2 border-line-strong pl-3 text-xs leading-relaxed text-fg-muted">
              The score is deterministic — the same findings always produce the same number. It
              starts at 100 and subtracts a weight per finding, with repeats of the same rule damped
              so one noisy rule cannot bury everything else.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 border-t-2 border-line pt-6 lg:grid-cols-2">
          <SeverityBreakdown counts={counts} total={scanner.length} />
          <ScannerCoverage
            counts={bySource}
            failedScanners={failedScanners}
            advisoryCount={advisory.length}
          />
        </div>
      </section>

      {diff ? <ScanDiff diff={diff} /> : null}

      {/* ── Findings ────────────────────────────────────────────────────── */}
      <section aria-labelledby="findings-heading">
        <SectionHeading
          id="findings-heading"
          align="left"
          title={`${findings.length} finding${findings.length === 1 ? "" : "s"}`}
          subtitle={
            findings.length > 0
              ? "Worst first. Criticals are expanded by default; every card carries the file, the line, why it matters and a fix you can copy."
              : undefined
          }
        />

        {findings.length === 0 ? (
          <div className="brut border-2 border-line-strong p-8 text-center">
            <p className="display-heading text-lg text-pass">Nothing found</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-fg-muted">
              None of the scanners that ran reported an issue. That is not a proof of safety — it
              means these specific checks came back clean.
            </p>
          </div>
        ) : (
          <ol className="grid gap-4">
            {findings.map((finding, index) => (
              <li key={finding.fingerprint || `${finding.title}-${index}`}>
                <FindingCard finding={finding} index={index} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <AdvisoryFindings findings={advisory} />

      <div className="flex flex-wrap items-center gap-3 border-t-2 border-line pt-5">
        <MarkdownExport
          report={{
            repoUrl: scan.repoUrl,
            commitSha: scan.commitSha,
            score,
            verdict,
            summary: scan.summary,
            failedScanners,
            findings: scan.findings,
            generatedAt: scan.completedAt ?? scan.createdAt,
          }}
        />
        <ReportDownload scanId={scan.id} />
        <RescanButton repoUrl={scan.repoUrl} />
        <span className="font-mono text-[11px] text-fg-muted">
          {diff
            ? "Re-scanning compares against this run"
            : "First scan of this repository — re-scan to see a diff"}
        </span>
      </div>
    </div>
  );
}
