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
 * Rulesets, resolved from local files baked into the runtime image by
 * `zerops.yaml` — deliberately not `p/…` registry references.
 *
 * Two measured reasons. Coverage: `p/owasp-top-ten` + `p/secrets` ran 108 rules
 * over the demo repo and found nothing, on code containing a textbook
 * `exec("ping -c 1 " + req.query.host)` — the Node sinks live in
 * `p/security-audit` and `p/javascript`. Reliability: registry-backed configs
 * worked for the first few scans and then failed persistently, which is what an
 * anonymous rate limit looks like.
 *
 * A scanner that fetches its rules over the network at scan time is a scanner
 * that stops working mid-demo, and "no rules loaded" is indistinguishable from
 * "clean repository" unless you look — so the rule and file counts are logged
 * on every run, and scanning zero files is treated as a failure.
 */
const CONFIGS = (
  process.env.SEMGREP_CONFIGS ??
  "/opt/semgrep-rules/security-audit.yaml,/opt/semgrep-rules/javascript.yaml,/opt/semgrep-rules/secrets.yaml"
)
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

/**
 * Runs semgrep, retrying once on a *fatal* exit.
 *
 * Observed in production: an identical invocation succeeded twice and then
 * failed with "semgrep-core rule validation failed … RPC subprocess exited with
 * code 1" — a transient crash of the OCaml core, not a bad configuration.
 * Losing an entire scanner to that is worse than paying for one retry.
 *
 * This does not hide failures. Exit 1 (findings) returns immediately, and if the
 * retry also fails the error propagates and the scan is marked partial.
 */
async function runWithRetry(
  args: string[],
  options: { timeout: number; maxBuffer: number },
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await run("semgrep", args, options);
  } catch (err) {
    if (isSemgrepSuccess(exitCode(err))) throw err;   // findings — caller handles
    console.warn(`[semgrep] retrying after: ${errorText(err)}`);
    return await run("semgrep", args, options);
  }
}

export const semgrepAdapter: ScannerAdapter = {
  name: "semgrep",
  async run(ctx: ScanContext): Promise<NormalizedFinding[]> {
    const report = join(tmpdir(), `semgrep-${randomUUID()}.json`);

    let stderr = "";
    try {
      const result = await runWithRetry(
        [
          "scan",
          ...CONFIGS.flatMap((c) => ["--config", c]),
          "--json",
          "--output", report,
          // Caps memory per rule-per-file. Without it semgrep-core is killed
          // outright under pressure ("RPC subprocess exited with code 1") and
          // the whole scanner is lost; with it, semgrep skips the offending
          // target, reports the skip, and still returns everything else.
          "--max-memory", process.env.SEMGREP_MAX_MEMORY_MB ?? "768",
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
      stderr = result.stderr ?? "";
    } catch (err) {
      const code = exitCode(err);
      if (!isSemgrepSuccess(code)) {
        throw new Error(`semgrep failed (exit ${code ?? "?"}): ${errorText(err)}`);
      }
      stderr = (err as { stderr?: string }).stderr ?? "";
    }

    let parsed: any;
    try {
      parsed = JSON.parse(await readFile(report, "utf8"));
    } catch (err) {
      // An unreadable report after an accepted exit code is a failure, not an
      // empty result.
      throw new Error(`semgrep report unreadable: ${errorText(err)}`);
    }

    // A scanner that loads no rules, or scans no files, reports zero findings
    // and exits 0 — indistinguishable from a clean repo unless we look. That is
    // the false-clean failure mode, so it is checked explicitly and raised.
    const scanned = Array.isArray(parsed?.paths?.scanned) ? parsed.paths.scanned.length : 0;
    const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
    if (errors.length > 0) {
      console.error(`[semgrep] reported ${errors.length} error(s): ${summarizeErrors(errors)}`);
    }
    if (stderr.trim()) {
      console.error(`[semgrep] stderr: ${stderr.trim().split("\n").slice(-4).join(" | ").slice(0, 500)}`);
    }
    console.log(`[semgrep] scanned ${scanned} file(s)`);
    if (scanned === 0) {
      throw new Error(
        `semgrep scanned 0 files (${errors.length} error(s): ${summarizeErrors(errors)}) — ` +
          `reporting this as "no findings" would be a false clean result`,
      );
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

function summarizeErrors(errors: any[]): string {
  return (
    errors
      .slice(0, 3)
      .map((e) => String(e?.long_msg ?? e?.message ?? e?.type ?? "unknown"))
      .join("; ")
      .slice(0, 300) || "none"
  );
}

export function exitCode(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "number") return code;
  }
  return undefined;
}

/**
 * Pulls the actual error out of a CLI failure.
 *
 * Naively taking the last few lines of stderr is wrong for semgrep: it prints a
 * rule-count table *after* the error, so the tail is a wall of numbers and the
 * real message is lost — which cost a diagnostic round-trip. Lines that look
 * like errors are preferred, with the tail only as a fallback.
 */
export function errorText(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { killed?: boolean; stderr?: string; stdout?: string; message?: string };
    if (e.killed) return "timed out";

    const output = `${e.stderr ?? ""}\n${e.stdout ?? ""}`;
    const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);

    const errorLines = lines.filter((l) => /error|fatal|failed|exception|traceback/i.test(l));
    if (errorLines.length) return errorLines.slice(0, 3).join(" | ").slice(0, 400);
    if (lines.length) return lines.slice(-3).join(" | ").slice(0, 400);
    if (e.message) return e.message.slice(0, 300);
  }
  return String(err).slice(0, 300);
}
