import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchScan, type Finding, type Scan } from "@/lib/api";
import { LiveProgress } from "./LiveProgress";

export const dynamic = "force-dynamic";

const IN_PROGRESS = new Set(["queued", "cloning", "scanning", "analyzing"]);

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let scan: Scan | null;
  try {
    scan = await fetchScan(id);
  } catch (err) {
    return (
      <main>
        <Back />
        <h1 className="brand">Scan unavailable</h1>
        <p className="tagline">
          Could not load this scan: {err instanceof Error ? err.message : String(err)}
        </p>
      </main>
    );
  }
  if (!scan) notFound();

  if (scan.status === "failed") {
    return (
      <main>
        <Back />
        <h1 className="brand">Scan failed</h1>
        <p className="tagline">
          <code>{scan.repoUrl}</code> could not be scanned. The repository may be private, missing,
          or larger than the scan limit.
        </p>
      </main>
    );
  }

  if (IN_PROGRESS.has(scan.status)) {
    // Rendered on the server so the page is never blank, then handed to a
    // client component that streams live phases over SSE.
    return (
      <main>
        <Back />
        <h1 className="brand">Scanning…</h1>
        <p className="tagline">
          Reading <code>{scan.repoUrl}</code> as text in a disposable sandbox. Nothing in it is
          executed.
        </p>
        <LiveProgress scanId={scan.id} initialStatus={scan.status} />
      </main>
    );
  }

  const summary = scan.summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const failed = scan.summary?.failedScanners ?? [];

  return (
    <main>
      <Back />
      <h1 className="brand">Ship Readiness</h1>
      <p className="tagline">
        <code>{scan.repoUrl}</code>
        {scan.commitSha ? ` @ ${scan.commitSha.slice(0, 7)}` : null}
      </p>

      {failed.length > 0 ? (
        <div className="panel warn-panel">
          <h2>Partial scan</h2>
          <p className="finding-body">
            {failed.join(", ")} did not run, so this score reflects fewer checks than usual. Treat
            it as a floor, not a clean bill of health.
          </p>
        </div>
      ) : null}

      <div className="panel score-panel">
        <div className={`score verdict-${scan.verdict}`}>{scan.score}</div>
        <div>
          <div className={`verdict-label verdict-${scan.verdict}`}>{scan.verdict}</div>
          <div className="hint">out of 100</div>
        </div>
        <div className="breakdown">
          {(["critical", "high", "medium", "low", "info"] as const).map((sev) => (
            <div key={sev} className="breakdown-row">
              <span className={`sev sev-${sev}`}>{sev}</span>
              <span>{summary[sev] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>
          {scan.findings.length} finding{scan.findings.length === 1 ? "" : "s"}
        </h2>
        {scan.findings.length === 0 ? (
          <p className="hint">
            No issues found by the scanners that ran. That is not a proof of safety — it means these
            specific checks came back clean.
          </p>
        ) : (
          <div className="findings">
            {scan.findings.map((f, i) => (
              <FindingCard key={f.fingerprint || i} finding={f} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="finding">
      <header>
        <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
        <span className="finding-title">{finding.title}</span>
        <span className="finding-source">{finding.source}</span>
      </header>
      {finding.filePath ? (
        <p className="finding-loc">
          {finding.filePath}
          {finding.lineStart ? `:${finding.lineStart}` : ""}
        </p>
      ) : null}
      {finding.snippet ? <pre className="snippet">{finding.snippet}</pre> : null}
      {finding.explanation ? <p className="finding-body">{finding.explanation}</p> : null}
      {finding.recommendedFix ? (
        <div className="fix">
          <span className="fix-label">Fix</span>
          <p className="finding-body">{finding.recommendedFix}</p>
        </div>
      ) : null}
    </article>
  );
}

function Back() {
  return (
    <p className="hint">
      <Link href="/">← New scan</Link>
    </p>
  );
}

