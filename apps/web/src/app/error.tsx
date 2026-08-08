"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StateCard } from "@/components/StateCard";

/**
 * The last line of defence: anything a page throws that it did not handle
 * itself lands here rather than showing the framework's default screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console and in the Zerops runtime log for a
    // server-side throw. Never swallowed silently.
    console.error("unhandled page error", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <StateCard
        tone="block"
        badge="Error"
        title="Something broke on this page"
        body={`The page failed to render${error.digest ? ` (digest ${error.digest})` : ""}. This is a bug in VibeGuard, not in the repository you scanned.`}
      >
        <button type="button" onClick={reset} className="brut-btn px-4 py-2 text-xs">
          Try again
        </button>
        <Link href="/" className="brut-btn-ghost px-4 py-2 text-xs no-underline">
          Back to start
        </Link>
      </StateCard>
    </main>
  );
}
