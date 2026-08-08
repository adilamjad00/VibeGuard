import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRepoUrl } from "./repo-url.js";

function reject(input: unknown): string {
  const result = validateRepoUrl(input);
  assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(input)}`);
  return (result as { ok: false; reason: string }).reason;
}

function accept(input: string) {
  const result = validateRepoUrl(input);
  assert.equal(result.ok, true, `expected acceptance for ${input}`);
  return result as { ok: true; normalized: string; owner: string; repo: string };
}

test("accepts a plain public GitHub repository", () => {
  const r = accept("https://github.com/adilamjad00/vibeguard-demo-app");
  assert.equal(r.normalized, "https://github.com/adilamjad00/vibeguard-demo-app");
  assert.equal(r.owner, "adilamjad00");
  assert.equal(r.repo, "vibeguard-demo-app");
});

test("strips .git and rebuilds the URL from validated parts", () => {
  // Query and fragment must not survive into the string handed to git.
  assert.equal(
    accept("https://github.com/owner/repo.git?foo=bar#frag").normalized,
    "https://github.com/owner/repo",
  );
});

test("rejects non-https schemes", () => {
  for (const url of [
    "http://github.com/owner/repo",
    "git://github.com/owner/repo",
    "ssh://git@github.com/owner/repo",
    "file:///etc/passwd",
    "ftp://github.com/owner/repo",
  ]) {
    reject(url);
  }
});

test("rejects hosts other than github.com", () => {
  for (const url of [
    "https://gitlab.com/owner/repo",
    "https://localhost/owner/repo",
    "https://127.0.0.1/owner/repo",
    "https://169.254.169.254/owner/repo", // cloud metadata endpoint
    "https://valkey/owner/repo", // internal Zerops hostname
    "https://github.com.evil.test/owner/repo", // suffix trick
    "https://evilgithub.com/owner/repo",
  ]) {
    reject(url);
  }
});

test("rejects embedded credentials", () => {
  reject("https://user:token@github.com/owner/repo");
  reject("https://token@github.com/owner/repo");
});

test("rejects an explicit port", () => {
  reject("https://github.com:22/owner/repo");
});

test("rejects paths that are not exactly owner/repo", () => {
  for (const url of [
    "https://github.com/owner",
    "https://github.com/",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/owner/repo/blob/main/src/config.js",
  ]) {
    reject(url);
  }
});

test("rejects dot segments that survive URL normalisation", () => {
  // `/owner/..` collapses to `/`, leaving too few segments.
  reject("https://github.com/owner/..");
  reject("https://github.com/.hidden/repo");
});

test("traversal attempts collapse to a harmless repo path, still on github.com", () => {
  // WHATWG URL parsing resolves `..` before validation runs, so this arrives as
  // `/etc/passwd` — two ordinary segments. That is safe rather than a bypass:
  // the host is still github.com, the URL is rebuilt from the validated parts,
  // and git resolves it to a 404 rather than anything on the local filesystem.
  assert.equal(
    accept("https://github.com/../etc/passwd").normalized,
    "https://github.com/etc/passwd",
  );
});

test("rejects GitHub's own reserved paths", () => {
  reject("https://github.com/settings/profile");
  reject("https://github.com/orgs/anthropics");
});

test("rejects empty, oversized, and non-string input", () => {
  reject(undefined);
  reject(null);
  reject(42);
  reject("");
  reject("   ");
  reject(`https://github.com/owner/${"a".repeat(400)}`);
});

test("host matching is case insensitive but path validation is not bypassed", () => {
  assert.equal(accept("https://GitHub.com/Owner/Repo").normalized, "https://github.com/Owner/Repo");
  assert.equal(accept("https://www.github.com/owner/repo").normalized, "https://github.com/owner/repo");
});
