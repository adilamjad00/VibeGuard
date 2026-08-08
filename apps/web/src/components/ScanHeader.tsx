import Link from "next/link";
import type { Scan } from "@/lib/api";

/** What was scanned, at which commit, and when — the report's provenance line. */
export function ScanHeader({ scan }: { scan: Scan }) {
  const slug = scan.repoUrl.replace(/^https:\/\/github\.com\//, "");

  return (
    <header>
      <Link
        href="/"
        className="font-display text-xs font-bold uppercase tracking-[0.12em] text-fg-muted no-underline hover:text-brand"
      >
        ← New scan
      </Link>

      {/* Not uppercased: GitHub owner and repository names are case-sensitive,
          and a display transform would misrepresent what was scanned. */}
      <h1 className="mt-3 break-all font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        <a
          href={scan.repoUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-fg no-underline hover:text-brand"
        >
          {slug}
        </a>
      </h1>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {scan.commitSha ? (
          <span className="chip-ghost">commit {scan.commitSha.slice(0, 7)}</span>
        ) : null}
        <span className="chip-ghost">{scan.status}</span>
        {/* Rendered as an ISO instant rather than a locale string: the server
            and the browser are in different time zones, and a mismatch is a
            hydration error. */}
        <time dateTime={scan.createdAt} className="font-mono text-[11px] text-fg-muted">
          {scan.createdAt.replace("T", " ").slice(0, 19)} UTC
        </time>
      </div>
    </header>
  );
}
