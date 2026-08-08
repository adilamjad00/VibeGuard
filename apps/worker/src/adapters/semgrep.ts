import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ScannerAdapter, ScanContext, NormalizedFinding } from "@vibeguard/core";
import type { FindingCategory, Severity } from "@vibeguard/core";

const run = promisify(execFile);

const TIMEOUT_MS = Number(process.env.SEMGREP_TIMEOUT_MS ?? 300_000);

/**
 * Two registry rulesets. `p/owasp-top-ten` is the injection/authz coverage and
 * `p/secrets` overlaps gitleaks deliberately — two independent detectors on the
 * same class of bug is the point, and the pipeline collapses the overlap.
 */
const CONFIGS = ["p/owasp-top-ten", "p/secrets"];

export const semgrepAdapter: ScannerAdapter = {
  name: "semgrep",
  async run(ctx: ScanContext): Promise<NormalizedFinding[]> {
    const report = join(tmpdir(), `semgrep-${randomUUID()}.json`);

    try {
      await run(
        "semgrep",
        [
          "scan",
          ...CONFIGS.flatMap((c) => ["--config", c]),
          "--json",
          "--output", report,
          // semgrep reports usage back to its registry by default. VibeGuard
          // scans *other people's* repositories, so telling a third party what
          // we scanned is not acceptable in a security tool.
          "--metrics=off",
          // The worker's memory floor is 1 GB and semgrep is the heaviest thing
          // that runs here; parallel workers multiply peak RSS.
          "--jobs", "1",
          "--timeout", "60",       // per-rule, so one pathological file cannot stall the scan
          "--disable-version-check",
          ctx.repoPath,
        ],
        { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (err) {
      const code = exitCode(err);
      if (!isSemgrepSuccess(code)) {
        throw new Error(`semgrep failed (exit ${code ?? "?"}): ${errorText(err)}`);
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(report, "utf8"));
    } catch (err) {
      // An unreadable report after an accepted exit code is a failure, not an
      // empty result.
      throw new Error(`semgrep report unreadable: ${errorText(err)}`);
    }

    return mapSemgrepResults(parsed);
  },
};

/**
 * THE TRAP: semgrep's exit codes are inverted relative to gitleaks. It exits 1
 * precisely *because* it found something, and >=2 on a real error. Treating
 * non-zero as failure — the shape the gitleaks adapter uses — would report
 * every successful scan of a vulnerable repo as a broken scanner, which is
 * exactly the false-clean failure mode this project exists to eliminate.
 */
export function isSemgrepSuccess(code: number | undefined): boolean {
  return code === 0 || code === 1;
}

/** Exported for tests: the mapping is the part worth pinning. */
export function mapSemgrepResults(parsed: unknown): NormalizedFinding[] {
  const results = (parsed as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];

  return results.map((r: any): NormalizedFinding => {
    const checkId = String(r.check_id ?? "semgrep-rule");
    const line = numberOr(r.start?.line);
    return {
      source: "semgrep",
      category: categoryFor(checkId),
      severity: severityFor(r.extra?.severity),
      title: titleFor(checkId),
      filePath: typeof r.path === "string" ? r.path : undefined,
      lineStart: line,
      lineEnd: numberOr(r.end?.line) ?? line,
      snippet: snippetFor(r.extra?.lines),
      fingerprint: `semgrep:${r.path}:${line ?? 0}:${checkId}`,
    };
  });
}

/**
 * Rule ids are namespaced paths like
 * `javascript.express.security.injection.tainted-sql-string`. The last segment
 * is the human-meaningful part; the full path is kept out of the title because
 * it reads as noise in the UI.
 */
function titleFor(checkId: string): string {
  const leaf = checkId.split(".").pop() ?? checkId;
  const words = leaf.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** semgrep grades ERROR/WARNING/INFO; map onto our severity ladder. */
function severityFor(value: unknown): Severity {
  switch (String(value ?? "").toUpperCase()) {
    case "ERROR": return "high";
    case "WARNING": return "medium";
    case "INFO": return "low";
    default: return "medium";
  }
}

/**
 * Derived from the rule id, which encodes the taxonomy far more reliably than
 * the message text does. Order matters: `sql-injection` must reach the
 * injection branch before the generic auth check sees the word "auth" in a
 * longer id.
 */
function categoryFor(checkId: string): FindingCategory {
  const id = checkId.toLowerCase();
  if (id.includes("secret") || id.includes("hardcoded") || id.includes("credential")) return "secret";
  if (id.includes("sql") || id.includes("injection") || id.includes("command") || id.includes("exec")) return "injection";
  if (id.includes("authz") || id.includes("authorization") || id.includes("access-control")) return "authz";
  if (id.includes("crypto") || id.includes("hash") || id.includes("cipher")) return "crypto";
  return "smell";
}

/**
 * `extra.lines` is the matched source. It is shown in the UI and stored, and a
 * `p/secrets` hit means the matched text *is* a credential — so the same
 * value-side masking gitleaks uses is applied here rather than trusting the
 * ruleset to be harmless.
 */
function snippetFor(lines: unknown): string | undefined {
  if (typeof lines !== "string") return undefined;
  const trimmed = lines.trim().slice(0, 200);
  if (!trimmed) return undefined;
  const delimiter = trimmed.search(/[:=]/);
  if (delimiter === -1) return trimmed;
  return trimmed.slice(0, delimiter + 1) + maskSecrets(trimmed.slice(delimiter + 1));
}

function maskSecrets(value: string): string {
  return value.replace(/[A-Za-z0-9_\-+/.]{16,}/g, (token) =>
    `${token.slice(0, 4)}${"•".repeat(Math.min(12, token.length - 8))}${token.slice(-4)}`,
  );
}

function numberOr(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function exitCode(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "number") return code;
  }
  return undefined;
}

export function errorText(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { killed?: boolean; stderr?: string; message?: string };
    if (e.killed) return "timed out";
    const stderr = (e.stderr ?? "").trim();
    if (stderr) return stderr.split("\n").slice(-3).join(" ").slice(0, 300);
    if (e.message) return e.message.slice(0, 300);
  }
  return String(err).slice(0, 300);
}
