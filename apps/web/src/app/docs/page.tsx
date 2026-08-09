import Link from "next/link";
import type { Metadata } from "next";
import { DOC_SECTIONS, docPath } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation — VibeGuard",
  description:
    "How VibeGuard scans a repository, how the score is computed, how findings are explained, and how your code is handled.",
};

export default function DocsIndex() {
  return (
    <main className="shell section-tight">
      <header className="max-w-3xl">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
          Documentation
        </p>
        <h1 className="display-heading mt-4 text-3xl sm:text-5xl">
          How VibeGuard works
          <span aria-hidden className="mt-4 block h-1.25 w-32 bg-brand" />
        </h1>
        <p className="mt-7 text-base leading-relaxed text-fg-muted">
          VibeGuard scans a repository with several independent security tools, normalises their
          findings, and turns the results into one report with a score and actionable explanations.
          These pages describe how that works end to end — including what happens when part of it
          fails, and what the score does not tell you.
        </p>

        <div className="mt-9 flex flex-wrap gap-4">
          <Link
            href="/docs/getting-started"
            className="brut-btn px-6 py-3 text-xs no-underline"
          >
            Quick start
          </Link>
          <Link href="/scan" className="brut-btn-ghost px-6 py-3 text-xs no-underline">
            Scan a repository
          </Link>
        </div>
      </header>

      <ul className="mt-16 grid gap-5 lg:grid-cols-2">
        {DOC_SECTIONS.map((section, index) => (
          <li key={section.slug}>
            <Link
              href={docPath(section.slug)}
              className="brut brut-hover flex h-full flex-col border-2 border-line-strong p-6 no-underline sm:p-7"
            >
              <span className="font-mono text-xs tabular-nums text-fg-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-3 display-heading text-lg text-fg">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{section.summary}</p>

              <ul className="mt-5 flex flex-wrap gap-2">
                {section.anchors.slice(0, 4).map((anchor) => (
                  <li key={anchor.id} className="chip-ghost">
                    {anchor.title}
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
