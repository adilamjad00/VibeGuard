"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { DEMO_REPO_URL } from "@/lib/links";

/**
 * The product's one action.
 *
 * Client-side validation here is a UX affordance only — it catches the obvious
 * mistakes without a round trip. The authoritative check is
 * `validateRepoUrl()` on the API, which is VibeGuard's SSRF boundary; this
 * function must never be treated as a substitute for it, and a URL that slips
 * past it is still rejected server-side.
 */
function localHint(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "That is not a full URL — include https://";
  }
  if (url.protocol !== "https:") return "Use an https:// URL.";
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) {
    return "Public github.com repositories only.";
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return "Link the repository root: https://github.com/<owner>/<repo>";
  }
  return null;
}

export function RepoInput() {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();

  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hint = localHint(repoUrl);
  const blocked = submitting || repoUrl.trim().length === 0 || hint !== null;
  const message = error ?? hint;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The API's rejection reason names the exact rule that failed, which is
        // far more useful than a generic "invalid input".
        setError(data.error ?? `Request failed (${res.status}).`);
        return;
      }
      router.push(`/scan/${data.id}`);
    } catch {
      setError("Could not reach the API. Check the service status in the bar above.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor={inputId} className="sr-only">
            Public GitHub repository URL
          </label>
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={repoUrl}
            onChange={(event) => {
              setRepoUrl(event.target.value);
              setError(null);
            }}
            placeholder="https://github.com/owner/repo"
            aria-invalid={message !== null}
            aria-describedby={message ? errorId : undefined}
            disabled={submitting}
            required
            className="w-full border-2 border-line-strong bg-ink px-4 py-3 font-mono text-sm text-fg placeholder:text-fg-muted/70 focus:border-brand focus:outline-none disabled:opacity-50"
          />
        </div>
        <button type="submit" disabled={blocked} className="brut-btn shrink-0 px-6 py-3 text-sm">
          {submitting ? "Queueing…" : "Scan repo"}
        </button>
      </form>

      {/* Assertive: this replaces the action the user just attempted. */}
      <p id={errorId} role="alert" aria-live="assertive" className="min-h-5 pt-2 text-sm text-critical">
        {message ?? ""}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted">
        <span>
          Cloned into a disposable sandbox and read as text —{" "}
          <strong className="font-semibold text-fg">nothing in it is executed.</strong>
        </span>
        <button
          type="button"
          onClick={() => {
            setRepoUrl(DEMO_REPO_URL);
            setError(null);
          }}
          className="chip-ghost hover:border-brand hover:text-brand"
        >
          Try the demo repo
        </button>
      </div>
    </div>
  );
}
