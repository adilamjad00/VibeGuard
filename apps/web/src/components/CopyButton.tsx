"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard with a confirmed state.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can be denied by
 * permissions policy, so failure is reported rather than silently swallowed —
 * a button that looks like it worked but did not is worse than no button.
 */
export function CopyButton({
  text,
  label = "Copy fix",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`brut-btn-ghost px-2.5 py-1 text-[11px] ${className}`}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
      {/* Politely announced so keyboard and screen-reader users get the same
          confirmation the visual state gives everyone else. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed" : ""}
      </span>
    </button>
  );
}
