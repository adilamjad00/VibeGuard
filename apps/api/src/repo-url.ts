/**
 * Validation for user-submitted repository URLs.
 *
 * This is VibeGuard's SSRF boundary. Whatever this function accepts, a private
 * worker inside the project network will later fetch — so it is an allowlist,
 * not a sanitiser. Anything not positively recognised as a public GitHub
 * repository is rejected.
 */

const ALLOWED_HOSTS = new Set(["github.com", "www.github.com"]);

/** GitHub's own rule: alphanumerics, hyphen, underscore, dot; no leading dot. */
const SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

/** Reserved GitHub paths that are not user repositories. */
const RESERVED_OWNERS = new Set([
  "settings", "orgs", "organizations", "notifications", "explore",
  "marketplace", "sponsors", "collections", "topics", "trending",
  "features", "enterprise", "pricing", "login", "join", "sessions",
  "apps", "users", "site", "about", "security", "codespaces",
]);

export type RepoUrlResult =
  | { ok: true; normalized: string; owner: string; repo: string }
  | { ok: false; reason: string };

export function validateRepoUrl(input: unknown): RepoUrlResult {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { ok: false, reason: "repoUrl is required" };
  }
  const raw = input.trim();
  if (raw.length > 300) return { ok: false, reason: "repoUrl is too long" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "repoUrl is not a valid URL" };
  }

  // Only https. http:// would be downgradeable, and git://, ssh://, file://
  // and git+ext:// are all remote-code or local-file reads in disguise.
  if (url.protocol !== "https:") {
    return { ok: false, reason: "repoUrl must use https" };
  }
  // Credentials in the URL would be forwarded to the host by git.
  if (url.username || url.password) {
    return { ok: false, reason: "repoUrl must not contain credentials" };
  }
  if (url.port) {
    return { ok: false, reason: "repoUrl must not specify a port" };
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, reason: "only public github.com repositories are supported" };
  }

  // Exactly two path segments: /<owner>/<repo>. Anything deeper is a
  // sub-page (tree/blob/issues), not something to clone.
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return { ok: false, reason: "repoUrl must be of the form https://github.com/<owner>/<repo>" };
  }

  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/i, "");

  for (const segment of [owner, repo]) {
    if (!SEGMENT.test(segment) || segment.startsWith(".") || segment === "..") {
      return { ok: false, reason: "repoUrl contains an invalid owner or repository name" };
    }
  }
  if (RESERVED_OWNERS.has(owner.toLowerCase())) {
    return { ok: false, reason: "repoUrl does not point at a repository" };
  }

  // Rebuilt from validated parts rather than echoed back, so nothing the user
  // supplied (query string, fragment, casing tricks) survives into the clone.
  return {
    ok: true,
    normalized: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
  };
}
