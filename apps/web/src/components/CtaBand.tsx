import Link from "next/link";
import { Band } from "./Band";

/**
 * The closing call to action. Brand-filled, once per page — it is also what
 * stops the page ending on two dark bands in a row when the footer follows.
 *
 * Buttons invert here: on the brand ground the primary action is ink-filled,
 * because an orange button on orange would disappear.
 */
export function CtaBand({
  title = "Find out what your repo is shipping",
  body = "One URL, about thirty seconds, and a report you can act on. No signup, no install, nothing to configure.",
  primary = { href: "/scan", label: "Scan a repository" },
  secondary,
}: {
  title?: string;
  body?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <Band tone="brand" tight>
      <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="display-heading text-2xl sm:text-4xl">{title}</h2>
          <p className="mt-4 text-[15px] font-medium leading-relaxed">{body}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            href={primary.href}
            className="inline-flex items-center border-2 border-ink bg-ink px-6 py-3 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-brand no-underline shadow-[4px_4px_0_0_rgb(0_0_0/0.35)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
          >
            {primary.label}
          </Link>
          {secondary ? (
            <Link
              href={secondary.href}
              className="inline-flex items-center border-2 border-ink px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink no-underline transition-colors hover:bg-ink/10"
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </Band>
  );
}
