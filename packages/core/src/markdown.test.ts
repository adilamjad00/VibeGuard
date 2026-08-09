import { test } from "node:test";
import assert from "node:assert/strict";
import { toMarkdown, type MarkdownReport } from "./markdown.js";
import type { NormalizedFinding } from "./types.js";

function finding(over: Partial<NormalizedFinding> = {}): NormalizedFinding {
  return {
    source: "gitleaks",
    category: "secret",
    severity: "critical",
    title: "Hardcoded secret: generic-api-key",
    filePath: "src/config.js",
    lineStart: 19,
    fingerprint: "gitleaks:src/config.js:19:generic-api-key",
    ...over,
  };
}

function report(over: Partial<MarkdownReport> = {}): MarkdownReport {
  return {
    repoUrl: "https://github.com/adilamjad00/vibeguard-demo-app",
    commitSha: "01bc96b1234567",
    score: 36,
    verdict: "block",
    summary: null,
    failedScanners: [],
    findings: [finding()],
    ...over,
  };
}

test("the headline carries the score, the verdict and the repo", () => {
  const md = toMarkdown(report());
  assert.match(md, /^# VibeGuard report — adilamjad00\/vibeguard-demo-app/);
  assert.match(md, /\*\*36\/100 · BLOCK\*\*/);
  assert.match(md, /Commit: `01bc96b`/);
});

test("a finding renders its location, source, explanation and fix", () => {
  const md = toMarkdown(
    report({
      findings: [
        finding({
          explanation: "Anyone with the repo can use this key.",
          recommendedFix: "Rotate it and load it from an env var.",
          snippet: 'apiKey: "••••REDACTED"',
        }),
      ],
    }),
  );
  assert.match(md, /### 1\. \[CRITICAL] Hardcoded secret/);
  assert.match(md, /Location: `src\/config\.js:19`/);
  assert.match(md, /Detected by: `gitleaks`/);
  assert.match(md, /\*\*Why it matters\.\*\* Anyone with the repo/);
  assert.match(md, /\*\*Fix\.\*\* Rotate it/);
  assert.match(md, /```\napiKey: "••••REDACTED"\n```/);
});

test("findings are ordered worst first", () => {
  const md = toMarkdown(
    report({
      findings: [
        finding({ severity: "low", title: "Low thing" }),
        finding({ severity: "critical", title: "Critical thing" }),
      ],
    }),
  );
  assert.ok(md.indexOf("Critical thing") < md.indexOf("Low thing"));
});

test("a partial scan is called out as a floor", () => {
  const md = toMarkdown(report({ failedScanners: ["semgrep"] }));
  assert.match(md, /\*\*Partial scan\.\*\* semgrep did not run/);
  assert.match(md, /floor, not a clean bill of health/);
});

test("a full scan does not claim to be partial", () => {
  assert.doesNotMatch(toMarkdown(report()), /Partial scan/);
});

test("advisory findings are separated and labelled unscored", () => {
  const advisory = finding({
    source: "llm",
    category: "authz",
    severity: "medium",
    title: "Admin endpoint has no authorization check",
    fingerprint: "llm:src/server.js:11:no-authz",
  });
  const md = toMarkdown(report({ findings: [finding(), advisory] }));

  assert.match(md, /## Findings \(1\)/, "advisory was counted as a scanner finding");
  assert.match(md, /## AI review \(1\) — advisory, not scored/);
  assert.ok(
    md.indexOf("## Findings") < md.indexOf("## AI review"),
    "advisory should follow the scanner findings",
  );
});

test("the AI review section is omitted when there is nothing advisory", () => {
  assert.doesNotMatch(toMarkdown(report()), /AI review/);
});

test("the severity table counts scanner findings only", () => {
  const advisory = finding({ source: "llm", severity: "medium", title: "Advisory" });
  const md = toMarkdown(report({ findings: [finding(), advisory] }));
  assert.match(md, /\| critical \| 1 \|/);
  assert.match(md, /\| medium \| 0 \|/);
});

test("a clean scan says so without claiming safety", () => {
  const md = toMarkdown(report({ score: 100, verdict: "pass", findings: [] }));
  assert.match(md, /## Findings \(0\)/);
  assert.match(md, /not a proof of safety/);
});

test("output is deterministic", () => {
  const input = report({ findings: [finding({ severity: "high", title: "A" }), finding()] });
  assert.equal(toMarkdown(input), toMarkdown(input));
});

test("a finding with no file still renders", () => {
  const md = toMarkdown(
    report({
      findings: [
        finding({
          source: "osv",
          category: "dependency",
          severity: "high",
          title: "node-fetch@2.6.6: GHSA-r683-j2x4-v87g",
          filePath: undefined,
          lineStart: undefined,
        }),
      ],
    }),
  );
  assert.match(md, /### 1\. \[HIGH] node-fetch@2\.6\.6/);
  assert.doesNotMatch(md, /Location:/);
});
