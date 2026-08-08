import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ScannerAdapter, ScanContext, NormalizedFinding } from "@vibeguard/core";

const run = promisify(execFile);

const TIMEOUT_MS = Number(process.env.GITLEAKS_TIMEOUT_MS ?? 120_000);

export const gitleaksAdapter: ScannerAdapter = {
  name: "gitleaks",
  async run(ctx: ScanContext): Promise<NormalizedFinding[]> {
    const report = join(tmpdir(), `gitleaks-${randomUUID()}.json`);

    try {
      // `gitleaks dir` scans a working tree. It replaced `detect --source X
      // --no-git`, which v8.19 deprecated and which silently produces nothing
      // on the 8.30 binary we ship.
      //
      // `--exit-code 0` makes gitleaks exit 0 *even when it finds leaks*, which
      // is what makes the error handling below correct: once findings no longer
      // cause a non-zero exit, any thrown error is a genuine failure.
      await run(
        "gitleaks",
        [
          "dir", ctx.repoPath,
          "--report-format", "json",
          "--report-path", report,
          "--exit-code", "0",
          "--no-banner",
        ],
        { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (err) {
      // Deliberately not swallowed. Reporting a failed scanner as "0 findings"
      // is a false clean bill of health — the worst failure mode a security
      // tool has. The pipeline catches this and records a partial-scan event,
      // so the user sees "gitleaks failed" instead of a misleading 100.
      throw new Error(`gitleaks failed: ${errorText(err)}`);
    }

    let raw: any[] = [];
    try {
      raw = JSON.parse(await readFile(report, "utf8"));
    } catch (err) {
      // A missing or malformed report after a successful exit is also a
      // failure, not an empty result.
      throw new Error(`gitleaks report unreadable: ${errorText(err)}`);
    }
    if (!Array.isArray(raw)) return [];

    return raw.map((r): NormalizedFinding => ({
      source: "gitleaks",
      category: "secret",
      severity: "critical",
      title: `Hardcoded secret: ${r.RuleID ?? r.Description ?? "secret"}`,
      filePath: r.File,
      lineStart: r.StartLine,
      lineEnd: r.EndLine,
      snippet: r.Match ? redact(String(r.Match)) : undefined,
      fingerprint: `gitleaks:${r.File}:${r.StartLine}:${r.RuleID}`,
    }));
  },
};

/**
 * The snippet is shown in the UI and stored in Postgres, so the matched secret
 * is masked. Enough context to locate the line, not enough to reuse the
 * credential.
 *
 * Only the value side of the assignment is masked. Masking every long token
 * would also hit the identifier — `databasePassword` is itself 16 characters —
 * which destroys the context that makes the finding readable.
 */
function redact(match: string): string {
  const trimmed = match.trim().slice(0, 200);
  const delimiter = trimmed.search(/[:=]/);
  if (delimiter === -1) return maskToken(trimmed);
  return trimmed.slice(0, delimiter + 1) + maskSecrets(trimmed.slice(delimiter + 1));
}

function maskSecrets(value: string): string {
  return value.replace(/[A-Za-z0-9_\-+/.]{8,}/g, maskToken);
}

function maskToken(token: string): string {
  if (token.length <= 8) return "•".repeat(token.length);
  return `${token.slice(0, 4)}${"•".repeat(Math.min(12, token.length - 8))}${token.slice(-4)}`;
}

function errorText(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { killed?: boolean; stderr?: string; message?: string };
    if (e.killed) return "timed out";
    const stderr = (e.stderr ?? "").trim();
    if (stderr) return stderr.split("\n").slice(-3).join(" ").slice(0, 300);
    if (e.message) return e.message.slice(0, 300);
  }
  return String(err).slice(0, 300);
}
