import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, shipReadinessScore, verdictFor } from "./score.js";
import type { NormalizedFinding, Severity } from "./types.js";

/** Findings only ever matter to the score via their severity. */
function findings(...severities: Severity[]): NormalizedFinding[] {
  return severities.map((severity, i) => ({
    source: "semgrep",
    category: "other",
    severity,
    title: `finding ${i}`,
    fingerprint: `test:${i}`,
  }));
}

test("a clean repo scores 100 and passes", () => {
  assert.equal(shipReadinessScore([]), 100);
  assert.equal(verdictFor(100), "pass");
});

test("summarize counts every severity bucket", () => {
  const s = summarize(findings("critical", "critical", "high", "medium", "low", "info"));
  assert.deepEqual(s, { critical: 2, high: 1, medium: 1, low: 1, info: 1 });
});

test("each severity applies its documented weight", () => {
  assert.equal(shipReadinessScore(findings("critical")), 75);
  assert.equal(shipReadinessScore(findings("high")), 90);
  assert.equal(shipReadinessScore(findings("medium")), 96);
  assert.equal(shipReadinessScore(findings("low")), 99);
});

test("info findings are reported but never cost points", () => {
  assert.equal(shipReadinessScore(findings("info", "info", "info")), 100);
});

test("the score clamps at 0 instead of going negative", () => {
  // 5 criticals = 125 penalty, which would otherwise be -25.
  assert.equal(shipReadinessScore(findings("critical", "critical", "critical", "critical", "critical")), 0);
  assert.equal(verdictFor(0), "block");
});

test("verdict boundaries are inclusive at 80 and 50", () => {
  assert.equal(verdictFor(80), "pass");
  assert.equal(verdictFor(79), "review");
  assert.equal(verdictFor(50), "review");
  assert.equal(verdictFor(49), "block");
});

test("scoring is order independent", () => {
  const a = shipReadinessScore(findings("critical", "low", "high"));
  const b = shipReadinessScore(findings("high", "critical", "low"));
  assert.equal(a, b);
});

test("the demo repo profile lands in the block band", () => {
  // Seed repo: hardcoded secret + jwt secret (critical), SQL injection +
  // command injection (high), missing authz (medium). Must read as "do not ship".
  const score = shipReadinessScore(findings("critical", "critical", "high", "high", "medium"));
  assert.equal(score, 26);
  assert.equal(verdictFor(score), "block");
});
