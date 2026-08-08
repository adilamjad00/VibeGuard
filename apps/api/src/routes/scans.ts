import type { FastifyInstance } from "fastify";
import type { NormalizedFinding, ScanStatus, Verdict } from "@vibeguard/core";
import { getPool } from "../db.js";
import { enqueueScan } from "../queue.js";
import { validateRepoUrl } from "../repo-url.js";
import { presignReport, REPORT_URL_TTL_SECONDS } from "../s3.js";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID.test(value);
}
