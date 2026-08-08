import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, shipReadinessScore, verdictFor } from "./score.js";
import type { NormalizedFinding, Severity } from "./types.js";

/**
 * Distinct findings: each gets its own title, so each is a distinct *rule* and
 * none of them damp each other.
 */
function findings(...severities: Severity[]): NormalizedFinding[] {
  return severities.map((severity, i) => ({
    source: "semgrep",
    category: "other",
    severity,
    title: `finding ${i}`,
    fingerprint: `test:${i}`,
  }));
}

/** The same rule firing `count` times — what triggers repetition damping. */
function repeated(severity: Severity, count: number): NormalizedFinding[] {
  return Array.from({ length: count }, (_, i) => ({
    source: "gitleaks" as const,
    category: "secret" as const,
    severity,
    title: "Hardcoded secret: generic-api-key",
    fingerprint: `test:repeat:${i}`,
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

test("repeats of one rule cost less than the first hit", () => {
  // 1 hit = 25. 4 hits = 25 * (1 + 0.25*3) = 43.75, not 100.
  assert.equal(shipReadinessScore(repeated("critical", 1)), 75);
  assert.equal(shipReadinessScore(repeated("critical", 4)), 56);
});

test("a single rule can never cost more than twice its weight", () => {
  // Without the cap, 40 hits of one rule would bury every other signal.
  assert.equal(shipReadinessScore(repeated("critical", 10)), 50);
  assert.equal(shipReadinessScore(repeated("critical", 40)), 50);
});

test("damping applies per rule, so distinct rules still stack fully", () => {
  // Three *different* criticals are three real problems: 75 penalty, not 43.75.
  assert.equal(shipReadinessScore(findings("critical", "critical", "critical")), 25);
});

test("the demo repo profile is off the floor and still blocks", () => {
  // The real seed repo: 4 secrets from one gitleaks rule (43.75 damped, not
  // 100), SQL injection + command injection (10 each), missing authz (4).
  const seed = [
    ...repeated("critical", 4),
    ...findings("high", "high", "medium"),
  ];
  const score = shipReadinessScore(seed);
  assert.equal(score, 32);
  assert.equal(verdictFor(score), "block");

  // The demo beat: removing the committed secrets has to visibly move the
  // number. Pinned at 0 it could not, which is why damping exists.
  const fixed = findings("high", "high", "medium");
  assert.equal(shipReadinessScore(fixed), 76);
  assert.equal(verdictFor(76), "review");
});
