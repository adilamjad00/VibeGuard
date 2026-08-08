import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ScannerAdapter, ScanContext, NormalizedFinding, Severity } from "@vibeguard/core";
import { exitCode, errorText } from "./semgrep.js";

const run = promisify(execFile);

const TIMEOUT_MS = Number(process.env.OSV_TIMEOUT_MS ?? 180_000);

/**
 * osv-scanner exit codes (v2):
 *   0   packages scanned, nothing vulnerable
 *   1   vulnerabilities found
 *   127 the scanner itself failed
 *   128 no packages found
 *
 * 128 is the interesting one: it means "this repo has no lockfile I understand",
 * which is a perfectly ordinary result for the many repos that do not commit
 * one. Treating it as a failure would mark those scans partial forever and
 * train users to ignore the warning.
 */
const OK_EXIT_CODES = new Set([0, 1, 128]);

export const osvAdapter: ScannerAdapter = {
  name: "osv",
  async run(ctx: ScanContext): Promise<NormalizedFinding[]> {
    const report = join(tmpdir(), `osv-${randomUUID()}.json`);

    try {
      await run(
        "osv-scanner",
        ["scan", "source", "--format", "json", "--output", report, "-r", ctx.repoPath],
        { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (err) {
      const code = exitCode(err);
      if (!isOsvSuccess(code)) {
        throw new Error(`osv-scanner failed (exit ${code ?? "?"}): ${errorText(err)}`);
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(report, "utf8"));
    } catch {
      // With exit 128 osv-scanner may not write a report at all. That is the
      // documented "nothing to scan" case, not a malformed one, so it yields an
      // empty result rather than a thrown failure.
      return [];
    }

    return mapOsvResults(parsed);
  },
};

export function isOsvSuccess(code: number | undefined): boolean {
  return code !== undefined && OK_EXIT_CODES.has(code);
}

/** Exported for tests: the mapping is the part worth pinning. */
export function mapOsvResults(parsed: unknown): NormalizedFinding[] {
  const results = (parsed as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];

  const findings: NormalizedFinding[] = [];
  for (const result of results as any[]) {
    const lockfile = typeof result?.source?.path === "string" ? result.source.path : undefined;

    for (const pkg of asArray(result?.packages)) {
      const name = String(pkg?.package?.name ?? "unknown");
      const version = String(pkg?.package?.version ?? "");
      const severityByVulnId = severityIndex(pkg?.groups);

      for (const vuln of asArray(pkg?.vulnerabilities)) {
        const id = String(vuln?.id ?? "UNKNOWN");
        findings.push({
          source: "osv",
          category: "dependency",
          severity: severityByVulnId.get(id) ?? severityFromDatabase(vuln) ?? "medium",
          title: `${name}@${version}: ${id}`,
          filePath: lockfile,
          // A vulnerable dependency is a property of the manifest, not of a
          // line in it, so no line number is invented here.
          snippet: summaryOf(vuln),
          fingerprint: `osv:${lockfile ?? ""}:${name}:${id}`,
        });
      }
    }
  }
  return findings;
}

/**
 * osv-scanner groups aliased advisories together and reports `max_severity` as
 * a CVSS base score on the group. That is a far more reliable severity source
 * than parsing a raw CVSS vector string, so it is preferred where present.
 */
function severityIndex(groups: unknown): Map<string, Severity> {
  const index = new Map<string, Severity>();
  for (const group of asArray(groups)) {
    const score = Number((group as any)?.max_severity);
    if (!Number.isFinite(score)) continue;
    const severity = severityFromCvss(score);
    for (const id of asArray((group as any)?.ids)) index.set(String(id), severity);
    for (const alias of asArray((group as any)?.aliases)) index.set(String(alias), severity);
  }
  return index;
}

/** Standard CVSS v3 qualitative bands. */
function severityFromCvss(score: number): Severity {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  if (score > 0) return "low";
  return "info";
}

/** GitHub-sourced advisories carry a qualitative label instead of a score. */
function severityFromDatabase(vuln: unknown): Severity | undefined {
  const raw = (vuln as any)?.database_specific?.severity;
  switch (String(raw ?? "").toUpperCase()) {
    case "CRITICAL": return "critical";
    case "HIGH": return "high";
    case "MODERATE":
    case "MEDIUM": return "medium";
    case "LOW": return "low";
    default: return undefined;
  }
}

function summaryOf(vuln: unknown): string | undefined {
  const summary = (vuln as any)?.summary;
  return typeof summary === "string" && summary.trim() ? summary.trim().slice(0, 300) : undefined;
}

/** Scanner JSON is untyped by nature; every access below is guarded. */
function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}
