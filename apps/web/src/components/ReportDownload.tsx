"use client";

import { useState } from "react";

/**
 * Fetches a short-lived presigned link to the archived report in object
 * storage and opens it.
 *
 * The bucket is private and stays private — this asks the API to mint a
 * time-limited URL rather than making the object readable. Both outcomes are
 * shown: a scan whose archive upload failed reports that instead of silently
 * doing nothing.
 */
export function ReportDownload({ scanId }: { scanId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function open() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/report`, { cache: "no-store" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setState("error");
        setMessage(data.error ?? `Could not get a report link (${res.status}).`);
        return;
      }
      setState("idle");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setState("error");
      setMessage("Could not reach the API.");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={open}
        disabled={state === "loading"}
        className="brut-btn-ghost px-3 py-1.5 text-[11px]"
      >
        {state === "loading" ? "Signing…" : "Raw JSON report"}
      </button>
      {message ? (
        <span role="status" className="font-mono text-[11px] text-high">
          {message}
        </span>
      ) : null}
    </span>
  );
}
