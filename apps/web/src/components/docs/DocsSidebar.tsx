"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_SECTIONS, docPath } from "@/lib/docs";

/**
 * The docs index, rendered twice: as a sticky rail on desktop and inside a
 * `<details>` disclosure on mobile.
 *
 * Anchors for the section you are currently reading are expanded; the rest
 * collapse to a single line, so the rail stays scannable as the docs grow.
 */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation">
      <ul className="grid gap-1">
        {DOC_SECTIONS.map((section) => {
          const href = docPath(section.slug);
          const current = pathname === href;
          return (
            <li key={section.slug}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={`block border-l-2 py-1.5 pl-3 font-display text-xs font-bold uppercase tracking-[0.1em] no-underline transition-colors ${
                  current
                    ? "border-brand text-brand"
                    : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {section.title}
              </Link>

              {current ? (
                <ul className="mb-2 mt-1 grid gap-0.5 border-l-2 border-line pl-3">
                  {section.anchors.map((anchor) => (
                    <li key={anchor.id}>
                      <Link
                        href={docPath(section.slug, anchor.id)}
                        onClick={onNavigate}
                        className="block py-1 pl-3 text-[13px] text-fg-muted no-underline transition-colors hover:text-fg"
                      >
                        {anchor.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
