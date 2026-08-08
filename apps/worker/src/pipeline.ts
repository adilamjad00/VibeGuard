import type { NormalizedFinding, ScanStatus } from "@vibeguard/core";
import { shipReadinessScore, summarize, verdictFor } from "@vibeguard/core";
import { gitleaksAdapter } from "./adapters/gitleaks.js";
import { semgrepAdapter } from "./adapters/semgrep.js";
import { osvAdapter } from "./adapters/osv.js";
import { cloneRepo } from "./clone.js";
import { getPool } from "./db.js";
import { enrichFindings } from "./llm.js";
import { storeReport } from "./storage.js";

/** Adding a scanner means adding to this list; they run concurrently. */
const ADAPTERS = [gitleaksAdapter, semgrepAdapter, osvAdapter];

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

    // allSettled, deliberately not Promise.all. Promise.all rejects the whole
    // batch the moment one scanner throws, discarding the results of the two
    // that succeeded — which would turn one broken tool into a failed scan and
    // break the partial-report guarantee below.
    const settled = await Promise.allSettled(
      ADAPTERS.map(async (adapter) => {
        const started = Date.now();
        const found = await adapter.run({ repoPath: repo.path, scanId });
        return { adapter, found, ms: Date.now() - started };
      }),
    );

    for (const [i, outcome] of settled.entries()) {
      const adapter = ADAPTERS[i]!;
      if (outcome.status === "fulfilled") {
        findings.push(...outcome.value.found);
        console.log(
          `[scan ${scanId}] ${adapter.name}: ${outcome.value.found.length} findings in ${outcome.value.ms}ms`,
        );
      } else {
        // One broken scanner degrades coverage; it does not fail the scan.
        // A partial report is worth more than no report — but the gap is
        // recorded and surfaced, never presented as a clean result.
        failedScanners.push(adapter.name);
        console.error(`[scan ${scanId}] ${adapter.name} failed:`, message(outcome.reason));
        await recordEvent(scanId, "scanning", `${adapter.name} failed: ${message(outcome.reason)}`);
      }
    }

    // If nothing ran, we know nothing. Reporting 100/pass here would be a false
    // clean bill of health, which is worse than admitting the scan failed.
    if (failedScanners.length === ADAPTERS.length) {
      throw new Error(`every scanner failed (${failedScanners.join(", ")})`);
    }

    const deduped = dedupe(findings.map((f) => relativize(f, repo.path)));

    // The score is computed from the static findings only, by the pure function
    // in packages/core, and it is computed BEFORE the LLM ever sees the code.
    // Deriving it here makes it structurally impossible for the enrichment pass
    // to influence the verdict — a repo cannot talk its way to a better score.
    const score = shipReadinessScore(deduped);
    const verdict = verdictFor(score);
    const summary = { ...summarize(deduped), failedScanners };

    await setStatus(scanId, "analyzing");
    const { enriched } = await enrichFindings(deduped, repo.path);

    await persistFindings(scanId, enriched);

    // Archived after the findings are safely in Postgres, so a storage outage
    // costs the archive and nothing else.
    const reportKey = await storeReport({
      scanId,
      repoUrl,
      commitSha: repo.commitSha,
      score,
      verdict,
      summary: summarize(deduped),
      failedScanners,
      findings: enriched,
      generatedAt: new Date().toISOString(),
    });

    await getPool().query(
      `update scans
          set status = 'done', score = $1, verdict = $2, summary = $3,
              report_object_key = $4, completed_at = now()
        where id = $5`,
      [score, verdict, JSON.stringify(summary), reportKey, scanId],
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

/** Lower wins when two scanners report the same problem. */
const SOURCE_PRIORITY: Record<string, number> = { gitleaks: 0, semgrep: 1, osv: 2, llm: 3 };

/**
 * Collapses duplicate findings.
 *
 * Two passes, because scanners duplicate each other in two different ways.
 * Within one scanner the fingerprint is authoritative. *Across* scanners it is
 * useless — gitleaks and semgrep's `p/secrets` flag the same committed key and
 * produce completely different fingerprints, so keying on fingerprint alone
 * stores that one secret twice and charges the score for it twice.
 *
 * The second pass therefore treats (file, line, category) as the identity of a
 * problem, and keeps the report from the more specific tool. Dependency
 * findings are exempt: they have no line, so several CVEs against one lockfile
 * would otherwise collapse into one.
 */
export function dedupe(findings: NormalizedFinding[]): NormalizedFinding[] {
  const byFingerprint = new Map<string, NormalizedFinding>();
  for (const f of findings) {
    const key = f.fingerprint || `${f.source}:${f.filePath}:${f.lineStart}:${f.title}`;
    if (!byFingerprint.has(key)) byFingerprint.set(key, f);
  }

  const byLocation = new Map<string, NormalizedFinding>();
  const unlocated: NormalizedFinding[] = [];
  for (const f of byFingerprint.values()) {
    if (!f.filePath || f.lineStart === undefined || f.category === "dependency") {
      unlocated.push(f);
      continue;
    }
    const key = `${f.filePath}:${f.lineStart}:${f.category}`;
    const existing = byLocation.get(key);
    if (!existing || priority(f) < priority(existing)) byLocation.set(key, f);
  }

  return [...byLocation.values(), ...unlocated];
}

function priority(f: NormalizedFinding): number {
  return SOURCE_PRIORITY[f.source] ?? 99;
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
