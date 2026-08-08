import { test } from "node:test";
import assert from "node:assert/strict";
import { mapSemgrepResults, isSemgrepSuccess } from "./semgrep.js";
import { mapOsvResults, isOsvSuccess } from "./osv.js";

/**
 * These cover the two things that actually go wrong in an adapter: reading the
 * exit code backwards, and mis-mapping the report. Both are pure functions so
 * the tests need no subprocess. The spawn itself is verified against the real
 * binaries on the deployed worker.
 */

const SEMGREP_REPORT = {
  results: [
    {
      check_id: "javascript.express.security.injection.tainted-sql-string",
      path: "/repo/src/db.js",
      start: { line: 12 },
      end: { line: 12 },
      extra: { severity: "ERROR", lines: 'const q = "SELECT * FROM users WHERE id = " + req.params.id;' },
    },
    {
      check_id: "generic.secrets.security.detected-generic-api-key",
      path: "/repo/src/config.js",
      start: { line: 19 },
      end: { line: 19 },
      extra: { severity: "WARNING", lines: 'apiKey: "Xq7vR2mK9pL4wN8sT5yB3zC6hJ1dF0gA"' },
    },
  ],
};

test("semgrep exit 1 means findings, exit 0 means clean, both are success", () => {
  // The inversion trap: gitleaks-style "non-zero is failure" would report every
  // successful scan of a vulnerable repo as a broken scanner.
  assert.equal(isSemgrepSuccess(0), true);
  assert.equal(isSemgrepSuccess(1), true);
});

test("semgrep exit 2 and above are real failures", () => {
  assert.equal(isSemgrepSuccess(2), false);   // fatal
  assert.equal(isSemgrepSuccess(7), false);   // missing config
  assert.equal(isSemgrepSuccess(undefined), false);
});

test("semgrep maps severity, category and title from the rule id", () => {
  const [sqli, secret] = mapSemgrepResults(SEMGREP_REPORT);

  assert.equal(sqli!.severity, "high");        // ERROR
  assert.equal(sqli!.category, "injection");
  assert.equal(sqli!.title, "Tainted sql string");
  assert.equal(sqli!.lineStart, 12);
  assert.equal(sqli!.source, "semgrep");

  assert.equal(secret!.severity, "medium");    // WARNING
  assert.equal(secret!.category, "secret");
});

test("semgrep masks the credential it just found", () => {
  const secret = mapSemgrepResults(SEMGREP_REPORT).find((f) => f.category === "secret")!;
  assert.ok(
    !secret.snippet?.includes("Xq7vR2mK9pL4wN8sT5yB3zC6hJ1dF0gA"),
    "the raw secret must never reach the snippet that gets stored and displayed",
  );
  assert.ok(secret.snippet?.includes("apiKey"), "the identifier should stay readable");
});

test("semgrep tolerates a report with no results array", () => {
  assert.deepEqual(mapSemgrepResults({}), []);
  assert.deepEqual(mapSemgrepResults(null), []);
});

const OSV_REPORT = {
  results: [
    {
      source: { path: "/repo/package-lock.json" },
      packages: [
        {
          package: { name: "lodash", version: "4.17.11" },
          groups: [{ ids: ["GHSA-jf85-cpcp-j695"], max_severity: "9.1" }],
          vulnerabilities: [
            { id: "GHSA-jf85-cpcp-j695", summary: "Prototype pollution in lodash" },
            { id: "GHSA-x5rq-j2xg-h7qm", database_specific: { severity: "MODERATE" }, summary: "ReDoS" },
          ],
        },
      ],
    },
  ],
};

test("osv exit 1 means vulnerabilities found, which is success", () => {
  assert.equal(isOsvSuccess(0), true);
  assert.equal(isOsvSuccess(1), true);
});

test("osv exit 128 means no lockfile — a clean result, not an error", () => {
  // The common case for repos that do not commit a lockfile. Treating it as a
  // failure would mark most real scans partial forever and train users to
  // ignore the partial-scan warning.
  assert.equal(isOsvSuccess(128), true);
});

test("osv exit 127 is a real failure", () => {
  assert.equal(isOsvSuccess(127), false);
  assert.equal(isOsvSuccess(undefined), false);
});

test("osv maps package, id and lockfile path", () => {
  const findings = mapOsvResults(OSV_REPORT);
  assert.equal(findings.length, 2);
  assert.equal(findings[0]!.category, "dependency");
  assert.equal(findings[0]!.title, "lodash@4.17.11: GHSA-jf85-cpcp-j695");
  assert.equal(findings[0]!.filePath, "/repo/package-lock.json");
  assert.equal(findings[0]!.lineStart, undefined, "a dependency has no line number to invent");
});

test("osv severity comes from the CVSS group score, then the database label", () => {
  const findings = mapOsvResults(OSV_REPORT);
  assert.equal(findings[0]!.severity, "critical");  // max_severity 9.1
  assert.equal(findings[1]!.severity, "medium");    // MODERATE
});

test("osv tolerates an empty or malformed report", () => {
  assert.deepEqual(mapOsvResults({ results: [] }), []);
  assert.deepEqual(mapOsvResults({}), []);
});
