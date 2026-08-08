import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countBySeverity,
  countBySource,
  fixClipboardText,
  locationOf,
  severityRank,
  sortBySeverity,
} from "./findings.js";
import type { NormalizedFinding, Severity } from "./types.js";

function finding(over: Partial<NormalizedFinding> = {}): NormalizedFinding {
  return {
    source: "semgrep",
    category: "injection",
    severity: "high",
    title: "Command injection",
    fingerprint: "fp",
    ...over,
  };
}

test("severityRank orders worst first", () => {
  const ranks = (["critical", "high", "medium", "low", "info"] as Severity[]).map(severityRank);
  assert.deepEqual(ranks, [0, 1, 2, 3, 4]);
});

test("severityRank sorts an unknown severity last, not first", () => {
  // A scanner adding a severity we do not model must not jump the queue ahead
  // of a real critical.
  assert.ok(severityRank("catastrophic") > severityRank("info"));
});

test("sortBySeverity puts criticals first", () => {
  const sorted = sortBySeverity([
    finding({ severity: "low", title: "l" }),
    finding({ severity: "critical", title: "c" }),
    finding({ severity: "medium", title: "m" }),
  ]);
  assert.deepEqual(
    sorted.map((f) => f.severity),
    ["critical", "medium", "low"],
  );
});

test("sortBySeverity breaks ties by file then line", () => {
  const sorted = sortBySeverity([
    finding({ filePath: "b.js", lineStart: 1 }),
    finding({ filePath: "a.js", lineStart: 20 }),
    finding({ filePath: "a.js", lineStart: 3 }),
  ]);
  assert.deepEqual(
    sorted.map((f) => `${f.filePath}:${f.lineStart}`),
    ["a.js:3", "a.js:20", "b.js:1"],
  );
});

test("sortBySeverity sorts findings without a file after located ones", () => {
  // Dependency findings have no path; they should not lead the section when
  // something in the source tree has the same severity.
  const sorted = sortBySeverity([
    finding({ category: "dependency", filePath: undefined }),
    finding({ filePath: "src/app.js", lineStart: 9 }),
  ]);
  assert.equal(sorted[0]!.filePath, "src/app.js");
});

test("sortBySeverity does not mutate its input", () => {
  const input = [finding({ severity: "low" }), finding({ severity: "critical" })];
  sortBySeverity(input);
  assert.equal(input[0]!.severity, "low");
});

test("countBySeverity reports every severity including zeroes", () => {
  const counts = countBySeverity([
    finding({ severity: "critical" }),
    finding({ severity: "critical" }),
    finding({ severity: "low" }),
  ]);
  assert.deepEqual(counts, { critical: 2, high: 0, medium: 0, low: 1, info: 0 });
});

test("countBySource counts only sources that produced findings", () => {
  const counts = countBySource([
    finding({ source: "gitleaks" }),
    finding({ source: "gitleaks" }),
    finding({ source: "osv" }),
  ]);
  assert.deepEqual(counts, { gitleaks: 2, osv: 1 });
});

test("locationOf renders file:line, path-only, or null", () => {
  assert.equal(locationOf(finding({ filePath: "src/a.js", lineStart: 12 })), "src/a.js:12");
  assert.equal(locationOf(finding({ filePath: "src/a.js" })), "src/a.js");
  assert.equal(locationOf(finding({ filePath: undefined })), null);
});

test("fixClipboardText includes severity, location, source and fix", () => {
  const text = fixClipboardText(
    finding({
      severity: "critical",
      title: "Hardcoded AWS key",
      source: "gitleaks",
      filePath: ".env",
      lineStart: 3,
      explanation: "Anyone with the repo can use this key.",
      recommendedFix: "Rotate the key and load it from an env var.",
    }),
  );
  assert.match(text, /^\[CRITICAL] Hardcoded AWS key/);
  assert.match(text, /Location: \.env:3/);
  assert.match(text, /Detected by: gitleaks/);
  assert.match(text, /Rotate the key/);
});

test("fixClipboardText omits sections the scan does not have", () => {
  // An unexplained finding must not paste as a template with empty headings.
  const text = fixClipboardText(finding({ explanation: undefined, recommendedFix: undefined }));
  assert.doesNotMatch(text, /Recommended fix/);
  assert.doesNotMatch(text, /Why it matters/);
});
