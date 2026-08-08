import { test } from "node:test";
import assert from "node:assert/strict";
import type { NormalizedFinding } from "@vibeguard/core";
import { dedupe } from "./pipeline.js";

function finding(partial: Partial<NormalizedFinding>): NormalizedFinding {
  return {
    source: "semgrep",
    category: "secret",
    severity: "critical",
    title: "finding",
    fingerprint: Math.random().toString(36),
    ...partial,
  };
}

test("one secret found by two scanners counts once", () => {
  // The regression this guards: gitleaks and semgrep's p/secrets both flag the
  // same committed key, with different fingerprints. Keying on fingerprint
  // alone stored it twice and charged the score twice.
  const deduped = dedupe([
    finding({ source: "gitleaks", filePath: "src/config.js", lineStart: 19, fingerprint: "gitleaks:src/config.js:19:generic-api-key" }),
    finding({ source: "semgrep", filePath: "src/config.js", lineStart: 19, fingerprint: "semgrep:src/config.js:19:detected-generic-api-key" }),
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]!.source, "gitleaks", "the more specific scanner should win");
});

test("distinct lines in one file stay distinct", () => {
  const deduped = dedupe([
    finding({ filePath: "src/config.js", lineStart: 19 }),
    finding({ filePath: "src/config.js", lineStart: 20 }),
    finding({ filePath: "src/config.js", lineStart: 21 }),
  ]);
  assert.equal(deduped.length, 3);
});

test("different problems on the same line stay distinct", () => {
  const deduped = dedupe([
    finding({ filePath: "src/db.js", lineStart: 12, category: "injection" }),
    finding({ filePath: "src/db.js", lineStart: 12, category: "secret" }),
  ]);
  assert.equal(deduped.length, 2);
});

test("several CVEs against one lockfile are not collapsed", () => {
  // Dependency findings share a file and have no line, so the location rule
  // would flatten a whole advisory list into a single finding.
  const deduped = dedupe([
    finding({ source: "osv", category: "dependency", filePath: "package-lock.json", title: "lodash: GHSA-1" }),
    finding({ source: "osv", category: "dependency", filePath: "package-lock.json", title: "lodash: GHSA-2" }),
  ]);
  assert.equal(deduped.length, 2);
});

test("an exact repeat from one scanner is still collapsed by fingerprint", () => {
  const deduped = dedupe([
    finding({ filePath: "src/a.js", lineStart: 1, fingerprint: "same" }),
    finding({ filePath: "src/a.js", lineStart: 1, fingerprint: "same" }),
  ]);
  assert.equal(deduped.length, 1);
});
