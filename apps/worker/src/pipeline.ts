import type { NormalizedFinding, ScanStatus } from "@vibeguard/core";
import { shipReadinessScore, summarize, verdictFor } from "@vibeguard/core";
import { gitleaksAdapter } from "./adapters/gitleaks.js";
import { cloneRepo } from "./clone.js";
import { getPool } from "./db.js";

/** Adapters run in order; adding a scanner means adding to this list. */
const ADAPTERS = [gitleaksAdapter];

export interface ScanJob {
  scanId: string;
  repoUrl: string;
}

export async function runScan(job: ScanJob): Promise<void> {
  const { scanId, repoUrl } = job;
  console.log(`[scan ${scanId}] starting ${repoUrl}`);

  let cleanup: (() => Promise<void>) | undefined;
  try {
    await setStatus(scanId, "cloning");
    const repo = await cloneRepo(repoUrl);
    cleanup = repo.cleanup;
    if (repo.commitSha) {
      await getPool().query(`update scans set commit_sha = $1 where id = $2`, [repo.commitSha, scanId]);
    }

    await setStatus(scanId, "scanning");
    const findings: NormalizedFinding[] = [];
    const failedScanners: string[] = [];
    for (const adapter of ADAPTERS) {
      const started = Date.now();
      try {
        const found = await adapter.run({ repoPath: repo.path, scanId });
        findings.push(...found);
        console.log(`[scan ${scanId}] ${adapter.name}: ${found.length} findings in ${Date.now() - started}ms`);
      } catch (err) {
        // One broken scanner degrades coverage; it does not fail the scan.
        // A partial report is worth more than no report — but the gap is
        // recorded and surfaced, never presented as a clean result.
        failedScanners.push(adapter.name);
        console.error(`[scan ${scanId}] ${adapter.name} failed:`, message(err));
        await recordEvent(scanId, "scanning", `${adapter.name} failed: ${message(err)}`);
      }
    }

    // If nothing ran, we know nothing. Reporting 100/pass here would be a false
    // clean bill of health, which is worse than admitting the scan failed.
    if (failedScanners.length === ADAPTERS.length) {
      throw new Error(`every scanner failed (${failedScanners.join(", ")})`);
    }

    const deduped = dedupe(findings.map((f) => relativize(f, repo.path)));
    await persistFindings(scanId, deduped);

    // The score is computed from the static findings only, by the pure function
    // in packages/core. Nothing downstream — including the LLM pass added in
    // Phase 3 — is allowed to move it.
    const score = shipReadinessScore(deduped);
    const verdict = verdictFor(score);
    const summary = { ...summarize(deduped), failedScanners };

    await getPool().query(
      `update scans
          set status = 'done', score = $1, verdict = $2, summary = $3, completed_at = now()
        where id = $4`,
      [score, verdict, JSON.stringify(summary), scanId],
    );
    console.log(
      `[scan ${scanId}] done: score=${score} verdict=${verdict} findings=${deduped.length}` +
        (failedScanners.length ? ` (partial: ${failedScanners.join(", ")} failed)` : ""),
    );
  } catch (err) {
    // Any unhandled failure must land the scan in `failed` with a reason.
    // A scan stuck in `queued` tells the user nothing and never resolves.
    const reason = message(err);
    console.error(`[scan ${scanId}] failed:`, reason);
    await recordEvent(scanId, "failed", reason).catch(() => {});
    await getPool()
      .query(`update scans set status = 'failed', completed_at = now() where id = $1`, [scanId])
      .catch(() => {});
    throw err;
  } finally {
    await cleanup?.();
  }
}

/**
 * Scanners report absolute paths inside the throwaway clone directory. Users
 * need the path within their repository, and leaking `/tmp/vibeguard-XXXX/...`
 * exposes worker internals for no benefit. Done centrally so every adapter
 * inherits it rather than each re-implementing the trim.
 */
function relativize(finding: NormalizedFinding, repoPath: string): NormalizedFinding {
  const strip = (value: string) =>
    value.split(repoPath).join("").replace(/^[/\\]+/, "");

  // The fingerprint is documented as a stable id for dedup and diffing, so it
  // must not embed the clone directory — that changes on every scan and would
  // make the same finding look new each time.
  const fingerprint = finding.fingerprint
    ? finding.fingerprint.split(repoPath).join("").replace(/:[/\\]+/g, ":")
    : finding.fingerprint;

  if (!finding.filePath) return { ...finding, fingerprint };
  const filePath = strip(finding.filePath) || finding.filePath;
  return { ...finding, filePath, fingerprint };
}

/** Two scanners can flag the same line; the fingerprint decides identity. */
function dedupe(findings: NormalizedFinding[]): NormalizedFinding[] {
  const seen = new Map<string, NormalizedFinding>();
  for (const f of findings) {
    const key = f.fingerprint || `${f.source}:${f.filePath}:${f.lineStart}:${f.title}`;
    if (!seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

async function persistFindings(scanId: string, findings: NormalizedFinding[]): Promise<void> {
  if (findings.length === 0) return;
  const client = await getPool().connect();
  try {
    await client.query("begin");
    for (const f of findings) {
      await client.query(
        `insert into findings
           (scan_id, source, category, severity, title, file_path, line_start, line_end,
            snippet, explanation, recommended_fix, fingerprint)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          scanId, f.source, f.category, f.severity, f.title,
          f.filePath ?? null, f.lineStart ?? null, f.lineEnd ?? null,
          f.snippet ?? null, f.explanation ?? null, f.recommendedFix ?? null,
          f.fingerprint ?? null,
        ],
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function setStatus(scanId: string, status: ScanStatus): Promise<void> {
  await getPool().query(`update scans set status = $1 where id = $2`, [status, scanId]);
  await recordEvent(scanId, status, null);
}

/** Phase 4 relays these over SSE; persisting them lets a late client replay. */
async function recordEvent(scanId: string, phase: string, msg: string | null): Promise<void> {
  await getPool().query(
    `insert into scan_events (scan_id, phase, message) values ($1, $2, $3)`,
    [scanId, phase, msg],
  );
}

function message(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}
