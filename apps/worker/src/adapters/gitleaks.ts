import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ScannerAdapter, ScanContext, NormalizedFinding } from "@vibeguard/core";

const run = promisify(execFile);

export const gitleaksAdapter: ScannerAdapter = {
  name: "gitleaks",
  async run(ctx: ScanContext): Promise<NormalizedFinding[]> {
    const report = join(tmpdir(), `gitleaks-${randomUUID()}.json`);
    try {
      // scans the working tree (no git history). Flags vary by version — confirm with `gitleaks --help`.
      await run("gitleaks", [
        "detect", "--source", ctx.repoPath, "--no-git",
        "--report-format", "json", "--report-path", report, "--exit-code", "0",
      ]);
    } catch {
      /* gitleaks exits non-zero when it finds leaks; report file is still written */
    }
    let raw: any[] = [];
    try { raw = JSON.parse(await readFile(report, "utf8")); } catch { raw = []; }
    return raw.map((r): NormalizedFinding => ({
      source: "gitleaks",
      category: "secret",
      severity: "critical",
      title: `Hardcoded secret: ${r.RuleID ?? r.Description ?? "secret"}`,
      filePath: r.File,
      lineStart: r.StartLine,
      lineEnd: r.EndLine,
      snippet: r.Match ? String(r.Match).slice(0, 200) : undefined,
      fingerprint: `gitleaks:${r.File}:${r.StartLine}:${r.RuleID}`,
    }));
  },
};
