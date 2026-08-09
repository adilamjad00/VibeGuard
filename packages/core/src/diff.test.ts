import { test } from "node:test";
import assert from "node:assert/strict";
import { diffFindings, diffScans } from "./diff.js";
import type { NormalizedFinding } from "./types.js";

function finding(over: Partial<NormalizedFinding> = {}): NormalizedFinding {
  const filePath = over.filePath ?? "src/config.js";
  const lineStart = over.lineStart ?? 19;
  const title = over.title ?? "Hardcoded secret: generic-api-key";
  return {
    source: "gitleaks",
    category: "secret",
    severity: "critical",
    title,
    filePath,
    lineStart,
    // Mirrors the real adapters, which embed the line in the fingerprint.
    fingerprint: `gitleaks:${filePath}:${lineStart}:generic-api-key`,
    ...over,
  };
}

test("an untouched scan reports everything unchanged", () => {
  const findings = [finding({ lineStart: 19 }), finding({ lineStart: 20 })];
  const diff = diffFindings(findings, findings);
  assert.equal(diff.unchanged.length, 2);
  assert.deepEqual([diff.fixed, diff.introduced, diff.moved], [[], [], []]);
});

test("a removed finding is fixed", () => {
  const diff = diffFindings([finding({ lineStart: 19 }), finding({ lineStart: 20 })], [
    finding({ lineStart: 19 }),
  ]);
  assert.equal(diff.fixed.length, 1);
  assert.equal(diff.fixed[0]!.lineStart, 20);
  assert.equal(diff.introduced.length, 0);
});

test("a new finding is introduced", () => {
  const diff = diffFindings(
    [finding()],
    [finding(), finding({ source: "semgrep", category: "injection", title: "Detect child process", filePath: "src/server.js", lineStart: 7 })],
  );
  assert.equal(diff.introduced.length, 1);
  assert.equal(diff.introduced[0]!.source, "semgrep");
  assert.equal(diff.fixed.length, 0);
});

test("a finding that only shifted lines is moved, not fixed-and-reintroduced", () => {
  // The regression this whole two-pass design exists for: delete an import at
  // the top of a file and every finding below it gets a new fingerprint.
  const before = [finding({ lineStart: 19 })];
  const after = [finding({ lineStart: 12 })];
  const diff = diffFindings(before, after);

  assert.equal(diff.moved.length, 1);
  assert.equal(diff.moved[0]!.lineStart, 12);
  assert.equal(diff.fixed.length, 0, "a shifted finding was reported as fixed");
  assert.equal(diff.introduced.length, 0, "a shifted finding was reported as new");
});

test("two instances of one rule cannot both match a single survivor", () => {
  // Two secrets in a file, one genuinely removed and one shifted: exactly one
  // fixed, exactly one moved.
  const before = [finding({ lineStart: 19 }), finding({ lineStart: 20 })];
  const after = [finding({ lineStart: 15 })];
  const diff = diffFindings(before, after);

  assert.equal(diff.moved.length, 1);
  assert.equal(diff.fixed.length, 1);
  assert.equal(diff.introduced.length, 0);
});

test("the same rule in a different file is not a move", () => {
  const before = [finding({ filePath: "src/config.js" })];
  const after = [finding({ filePath: "src/other.js" })];
  const diff = diffFindings(before, after);

  assert.equal(diff.fixed.length, 1);
  assert.equal(diff.introduced.length, 1);
  assert.equal(diff.moved.length, 0);
});

test("advisory findings are excluded from every side of the diff", () => {
  // LLM output is not reproducible, so including it would manufacture phantom
  // fixes and regressions on every re-scan.
  const advisory = finding({
    source: "llm",
    category: "authz",
    severity: "medium",
    title: "No ownership check on the update route",
    fingerprint: "llm:src/server.js:31:no-ownership-check",
  });
  const diff = diffFindings([advisory], [finding()]);

  assert.equal(diff.fixed.length, 0);
  assert.equal(diff.introduced.length, 1);
  assert.equal(diff.introduced[0]!.source, "gitleaks");
});

test("findings without a fingerprint fall back to source, path, line and title", () => {
  const bare = finding({ fingerprint: "" });
  assert.equal(diffFindings([bare], [bare]).unchanged.length, 1);
  assert.equal(diffFindings([bare], []).fixed.length, 1);
});

test("diffScans reports the score delta and verdict change", () => {
  const diff = diffScans(
    { score: 36, verdict: "block", commitSha: "aaaaaaa", findings: [finding()], failedScanners: [] },
    { score: 80, verdict: "pass", commitSha: "bbbbbbb", findings: [], failedScanners: [] },
  );
  assert.equal(diff.scoreDelta, 44);
  assert.equal(diff.verdictChanged, true);
  assert.equal(diff.previousVerdict, "block");
  assert.equal(diff.currentVerdict, "pass");
  assert.equal(diff.fixed.length, 1);
  assert.equal(diff.sameCommit, false);
});

test("a regression produces a negative delta", () => {
  const diff = diffScans(
    { score: 80, verdict: "pass", commitSha: "aaa", findings: [], failedScanners: [] },
    { score: 36, verdict: "block", commitSha: "bbb", findings: [finding()], failedScanners: [] },
  );
  assert.equal(diff.scoreDelta, -44);
  assert.equal(diff.introduced.length, 1);
});

test("re-scanning the same commit is flagged as such", () => {
  const side = { score: 36, verdict: "block" as const, commitSha: "01bc96b", findings: [finding()], failedScanners: [] };
  const diff = diffScans(side, side);
  assert.equal(diff.sameCommit, true);
  assert.equal(diff.scoreDelta, 0);
  assert.equal(diff.unchanged.length, 1);
});

test("a scanner that failed this run does not make its findings look fixed", () => {
  // Caught on the live deployment: two scans of the same commit, semgrep
  // crashed on the second, and the diff read "+10, 1 fixed" — a broken scanner
  // presented as progress, which is the one thing this product must never do.
  const semgrep = finding({
    source: "semgrep",
    category: "injection",
    severity: "high",
    title: "Detect child process",
    filePath: "src/server.js",
    lineStart: 7,
  });

  const diff = diffScans(
    { score: 36, verdict: "block", commitSha: "01bc96b", findings: [finding(), semgrep], failedScanners: [] },
    { score: 46, verdict: "block", commitSha: "01bc96b", findings: [finding()], failedScanners: ["semgrep"] },
  );

  assert.equal(diff.fixed.length, 0, "a finding from a failed scanner was reported as fixed");
  assert.equal(diff.unknown.length, 1);
  assert.equal(diff.unknown[0]!.source, "semgrep");
  assert.equal(diff.comparable, false);
  assert.deepEqual(diff.coverageGap, ["semgrep"]);
});

test("a scanner that failed last run does not make its findings look new", () => {
  const semgrep = finding({ source: "semgrep", category: "injection", title: "Detect child process" });

  const diff = diffScans(
    { score: 46, verdict: "block", commitSha: "aaa", findings: [], failedScanners: ["semgrep"] },
    { score: 36, verdict: "block", commitSha: "aaa", findings: [semgrep], failedScanners: [] },
  );

  assert.equal(diff.introduced.length, 0, "a newly-visible finding was reported as introduced");
  assert.equal(diff.unknown.length, 1);
  assert.equal(diff.comparable, false);
});

test("the same scanner failing on both sides is still comparable", () => {
  // Coverage is reduced but identical, so the delta still measures the code.
  const diff = diffScans(
    { score: 46, verdict: "block", commitSha: "aaa", findings: [finding()], failedScanners: ["semgrep"] },
    { score: 71, verdict: "review", commitSha: "bbb", findings: [], failedScanners: ["semgrep"] },
  );
  assert.equal(diff.comparable, true);
  assert.deepEqual(diff.coverageGap, []);
  assert.equal(diff.fixed.length, 1);
});

test("full coverage on both sides is comparable", () => {
  const diff = diffScans(
    { score: 36, verdict: "block", commitSha: "aaa", findings: [finding()], failedScanners: [] },
    { score: 80, verdict: "pass", commitSha: "bbb", findings: [], failedScanners: [] },
  );
  assert.equal(diff.comparable, true);
  assert.equal(diff.unknown.length, 0);
});

test("two unknown commits are not treated as the same commit", () => {
  const diff = diffScans(
    { score: 50, verdict: "review", commitSha: null, findings: [], failedScanners: [] },
    { score: 50, verdict: "review", commitSha: null, findings: [], failedScanners: [] },
  );
  assert.equal(diff.sameCommit, false);
});
