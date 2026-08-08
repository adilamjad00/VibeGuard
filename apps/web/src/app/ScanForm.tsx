"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Posts to the API through the same-origin /api proxy, so the browser never
 * needs the API's public hostname and there is no CORS surface.
 */
export function ScanForm() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        // The API's rejection reason is the useful message here — it names the
        // exact rule that failed rather than a generic "invalid input".
        setError(data.error ?? `request failed (${res.status})`);
        return;
      }
      router.push(`/scan/${data.id}`);
    } catch {
      setError("Could not reach the API. Check the backend status below.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="field" onSubmit={onSubmit}>
        <input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/user/repo"
          aria-label="Repository URL"
          required
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || repoUrl.trim().length === 0}>
          {submitting ? "Queueing…" : "Scan"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <p className="hint">
        Public GitHub repositories only. The repository is cloned into a disposable sandbox and read
        as text — nothing in it is ever executed.
      </p>
      <p className="hint">
        Try the demo target:{" "}
        <button
          type="button"
          className="linklike"
          onClick={() => setRepoUrl("https://github.com/adilamjad00/vibeguard-demo-app")}
        >
          vibeguard-demo-app
        </button>
      </p>
    </>
  );
}
