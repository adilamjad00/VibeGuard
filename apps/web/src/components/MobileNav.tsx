"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { PRIMARY_NAV, isActive } from "@/lib/nav";
import { REPO_URL } from "@/lib/links";

/**
 * The small-screen navigation panel.
 *
 * Hand-rolled rather than pulled from a library, but it does the four things a
 * disclosure has to do: `aria-expanded`/`aria-controls` so it is announced,
 * Escape to dismiss, focus returned to the trigger on close, and an automatic
 * close when the route changes — otherwise the panel stays open on top of the
 * page the user just navigated to.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Close on navigation. Focus is not restored here — the user is looking at a
  // new page, and yanking focus back to the menu button would be disorienting.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      // Only pull focus back if this close followed an open, so the trigger is
      // not focused on first render.
      if (wasOpen.current) trigger.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="brut-btn-ghost px-3 py-1.5 text-xs"
      >
        {open ? "Close" : "Menu"}
      </button>

      {/* Rendered unconditionally but hidden, so `aria-controls` always points
          at a real element. */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b-2 border-line-strong bg-ink px-4 pb-6 pt-2 shadow-[0_12px_24px_-12px_rgb(0_0_0/0.8)]"
      >
        <nav aria-label="Main">
          <ul className="grid gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block border-2 px-3 py-2.5 font-display text-sm font-bold uppercase tracking-[0.1em] no-underline ${
                      active
                        ? "border-brand bg-brand text-ink"
                        : "border-line text-fg hover:border-line-strong"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="brut-btn-ghost mt-3 w-full px-3 py-2.5 text-xs no-underline"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}
