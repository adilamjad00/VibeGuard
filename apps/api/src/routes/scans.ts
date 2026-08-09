import type { FastifyInstance } from "fastify";
import type { NormalizedFinding, ScanStatus, Verdict } from "@vibeguard/core";
import { diffScans } from "@vibeguard/core";
import { getPool } from "../db.js";
import { enqueueScan } from "../queue.js";
import { validateRepoUrl } from "../repo-url.js";
import { presignReport, REPORT_URL_TTL_SECONDS } from "../s3.js";
import { isUuid } from "../uuid.js";

interface ScanRow {
  id: string;
  repo_url: string;
  commit_sha: string | null;
  status: ScanStatus;
  score: number | null;
  verdict: Verdict | null;
  summary: unknown;
  report_object_key: string | null;
  created_at: string;
  completed_at: string | null;
}

const SEVERITY_ORDER = "case severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end";

export async function scanRoutes(app: FastifyInstance) {
  /**
   * Submit a repository for scanning.
   *
   * The URL is validated against an allowlist before it is stored, so a
   * rejected URL never reaches the queue, let alone the worker. See repo-url.ts
   * — this is the SSRF boundary.
   */
  app.post("/scans", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const body = req.body as { repoUrl?: unknown } | undefined;
    const validated = validateRepoUrl(body?.repoUrl);
    if (!validated.ok) {
      return reply.code(400).send({ error: validated.reason });
    }

    const { rows } = await getPool().query<{ id: string }>(
      `insert into scans (repo_url, status) values ($1, 'queued') returning id`,
      [validated.normalized],
    );
    const scanId = rows[0]!.id;

    try {
      await enqueueScan(scanId, validated.normalized);
    } catch (err) {
      // A scan row with no job would sit in `queued` forever. Fail it now so
      // the UI can say what happened instead of spinning.
      await getPool().query(`update scans set status = 'failed' where id = $1`, [scanId]);
      req.log.error({ err, scanId }, "failed to enqueue scan");
      return reply.code(503).send({ error: "could not queue scan, please retry" });
    }

    return reply.code(202).send({ id: scanId, status: "queued", repoUrl: validated.normalized });
  });

  /** Full report: the scan row plus its findings, worst severity first. */
  app.get("/scans/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "invalid scan id" });

    const scans = await getPool().query<ScanRow>(`select * from scans where id = $1`, [id]);
    const scan = scans.rows[0];
    if (!scan) return reply.code(404).send({ error: "scan not found" });

    const findings = await getPool().query(
      `select source, category, severity, title, file_path, line_start, line_end,
              snippet, explanation, recommended_fix, fingerprint
         from findings where scan_id = $1
        order by ${SEVERITY_ORDER}, file_path nulls last, line_start nulls last`,
      [id],
    );

    return reply.send({
      id: scan.id,
      repoUrl: scan.repo_url,
      commitSha: scan.commit_sha,
      status: scan.status,
      score: scan.score,
      verdict: scan.verdict,
      summary: scan.summary,
      createdAt: scan.created_at,
      completedAt: scan.completed_at,
      findings: findings.rows.map(toFinding),
    });
  });

  /**
   * A short-lived presigned link to the archived report in object storage.
   *
   * The bucket is private and stays private; this hands out a time-limited URL
   * rather than making the object readable, so the S3 leg of the pipeline is
   * demonstrable without loosening the bucket policy that protects everyone
   * else's reports.
   */
  app.get("/scans/:id/report", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "invalid scan id" });

    const { rows } = await getPool().query<{ report_object_key: string | null }>(
      `select report_object_key from scans where id = $1`,
      [id],
    );
    const scan = rows[0];
    if (!scan) return reply.code(404).send({ error: "scan not found" });
    if (!scan.report_object_key) {
      return reply.code(404).send({ error: "no archived report for this scan" });
    }

    try {
      const url = await presignReport(scan.report_object_key);
      return reply.send({ url, expiresInSeconds: REPORT_URL_TTL_SECONDS });
    } catch (err) {
      req.log.error({ err, id }, "failed to presign report");
      return reply.code(503).send({ error: "could not generate report link" });
    }
  });

  /**
   * How this scan compares with the previous scan of the same repository.
   *
   * The comparison target is chosen server-side rather than accepted as a
   * parameter: a caller-supplied "compare against" id would let anyone splice
   * two unrelated repositories into one report. It is always the most recent
   * earlier completed scan of the same `repo_url`, found through the existing
   * `idx_scans_repo` index.
   *
   * 404 when there is no earlier scan, so the UI can say "first scan of this
   * repository" rather than rendering an empty diff.
   */
  app.get("/scans/:id/diff", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "invalid scan id" });

    const current = await loadScanSide(id);
    if (!current) return reply.code(404).send({ error: "scan not found" });
    if (current.row.status !== "done") {
      return reply.code(409).send({ error: "scan has not finished" });
    }

    const { rows } = await getPool().query<{ id: string }>(
      `select id from scans
        where repo_url = $1 and id <> $2 and status = 'done' and created_at < $3
        order by created_at desc limit 1`,
      [current.row.repo_url, id, current.row.created_at],
    );
    const previousId = rows[0]?.id;
    if (!previousId) {
      return reply.code(404).send({ error: "no earlier scan of this repository" });
    }

    const previous = await loadScanSide(previousId);
    if (!previous) return reply.code(404).send({ error: "no earlier scan of this repository" });

    const diff = diffScans(
      {
        score: previous.row.score ?? 0,
        verdict: previous.row.verdict ?? "review",
        commitSha: previous.row.commit_sha,
        findings: previous.findings,
        failedScanners: failedScannersOf(previous.row),
      },
      {
        score: current.row.score ?? 0,
        verdict: current.row.verdict ?? "review",
        commitSha: current.row.commit_sha,
        findings: current.findings,
        failedScanners: failedScannersOf(current.row),
      },
    );

    return reply.send({
      current: { id, commitSha: current.row.commit_sha, createdAt: current.row.created_at },
      previous: {
        id: previousId,
        commitSha: previous.row.commit_sha,
        createdAt: previous.row.created_at,
      },
      ...diff,
    });
  });

  /** Recent scans, for the landing page. */
  app.get("/scans", async (_req, reply) => {
    const { rows } = await getPool().query<ScanRow>(
      `select id, repo_url, status, score, verdict, created_at
         from scans order by created_at desc limit 10`,
    );
    return reply.send({
      scans: rows.map((s) => ({
        id: s.id,
        repoUrl: s.repo_url,
        status: s.status,
        score: s.score,
        verdict: s.verdict,
        createdAt: s.created_at,
      })),
    });
  });
}

/**
 * Which scanners did not run, from the scan's stored summary.
 *
 * `summary` is a jsonb column, so it is parsed defensively — an older row
 * written before `failedScanners` existed simply reports full coverage, which
 * is what it had.
 */
function failedScannersOf(row: ScanRow): string[] {
  const summary = row.summary as { failedScanners?: unknown } | null;
  const failed = summary?.failedScanners;
  if (!Array.isArray(failed)) return [];
  return failed.filter((name): name is string => typeof name === "string");
}

/** A scan row plus its findings, in the shape the diff wants. */
async function loadScanSide(
  id: string,
): Promise<{ row: ScanRow; findings: NormalizedFinding[] } | null> {
  const scans = await getPool().query<ScanRow>(`select * from scans where id = $1`, [id]);
  const row = scans.rows[0];
  if (!row) return null;

  const findings = await getPool().query(
    `select source, category, severity, title, file_path, line_start, line_end,
            snippet, explanation, recommended_fix, fingerprint
       from findings where scan_id = $1`,
    [id],
  );
  return { row, findings: findings.rows.map(toFinding) };
}

function toFinding(row: Record<string, unknown>): NormalizedFinding {
  return {
    source: row.source as NormalizedFinding["source"],
    category: row.category as NormalizedFinding["category"],
    severity: row.severity as NormalizedFinding["severity"],
    title: row.title as string,
    filePath: (row.file_path as string | null) ?? undefined,
    lineStart: (row.line_start as number | null) ?? undefined,
    lineEnd: (row.line_end as number | null) ?? undefined,
    snippet: (row.snippet as string | null) ?? undefined,
    explanation: (row.explanation as string | null) ?? undefined,
    recommendedFix: (row.recommended_fix as string | null) ?? undefined,
    fingerprint: (row.fingerprint as string | null) ?? "",
  };
}

