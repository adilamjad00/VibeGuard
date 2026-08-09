"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Brand";
import { MobileNav } from "./MobileNav";
import { PRIMARY_NAV, isActive } from "@/lib/nav";
import { REPO_URL } from "@/lib/links";

/**
 * The header stays dark on every page, including the light marketing bands: it
 * is sticky, so a header that re-themed as bands scrolled underneath it would
 * flicker the whole way down the page.
 *
 * Home is the wordmark on desktop and an explicit item in the mobile panel.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const desktopNav = PRIMARY_NAV.filter((item) => item.href !== "/");

  return (
    <header className="sticky top-0 z-50 border-b-2 border-line-strong bg-ink/95 backdrop-blur">
      <div className="shell relative flex items-center gap-4 py-3.5">
        <Wordmark />

        <nav aria-label="Main" className="ml-auto hidden items-center gap-7 md:flex">
          {desktopNav.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`font-display text-xs font-bold uppercase tracking-[0.12em] no-underline transition-colors ${
                  active ? "text-brand" : "text-fg-muted hover:text-fg"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:ml-7">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="brut-btn-ghost hidden whitespace-nowrap px-3 py-1.5 text-xs no-underline lg:inline-flex"
          >
            GitHub
          </a>
          <Link
            href="/scan"
            className="brut-btn hidden whitespace-nowrap px-3.5 py-1.5 text-xs no-underline sm:inline-flex"
          >
            Scan a repo
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
