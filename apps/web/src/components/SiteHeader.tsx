import Link from "next/link";
import { Wordmark } from "./Brand";
import { REPO_URL } from "@/lib/links";

/**
 * Every link here goes somewhere real. The section anchors are absolute
 * (`/#scanners`) so they work from the scan page too rather than becoming dead
 * targets once the user leaves the landing page.
 */
const NAV = [
  { href: "/#scanners", label: "Scanners" },
  { href: "/#pipeline", label: "Pipeline" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-line-strong bg-ink/92 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Wordmark />

        <nav aria-label="Sections" className="ml-auto hidden items-center gap-6 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display text-xs font-bold uppercase tracking-[0.12em] text-fg-muted no-underline transition-colors hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Hidden on the narrowest screens: two buttons plus the wordmark
              overflow 390px, and the same link is in the footer. */}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="brut-btn-ghost hidden whitespace-nowrap px-3 py-1.5 text-xs no-underline sm:inline-flex"
          >
            GitHub
          </a>
          <Link
            href="/#scan"
            className="brut-btn whitespace-nowrap px-3.5 py-1.5 text-xs no-underline"
          >
            Scan a repo
          </Link>
        </div>
      </div>
    </header>
  );
}
