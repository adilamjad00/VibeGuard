import Link from "next/link";
import type { Metadata } from "next";
import { RepoInput } from "@/components/RepoInput";
import { CornerMarks } from "@/components/SectionHeading";
import { PIPELINE_STEPS } from "@/lib/pipeline";

export const metadata: Metadata = {
  title: "Scan a repository — VibeGuard",
  description:
    "Paste a public GitHub repository URL and get a Ship Readiness Score with ranked, explained, fixable security findings.",
};

/**
 * The one action, on its own page.
 *
 * Kept dark and deliberately quiet — this is the operator surface, not a
 * marketing band. The only things on it are the input, what will happen next,
 * and what the scanner will not do to your code.
 */
export default function ScanPage() {
  return (
    <main className="shell section-tight max-w-3xl">
      <header>
        <h1 className="display-heading text-3xl sm:text-4xl">
          Scan a repository
          <span aria-hidden className="mt-3 block h-1.25 w-24 bg-brand" />
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-fg-muted">
          Paste a public GitHub repository URL. The scan takes about thirty seconds and needs no
          signup, no install and no configuration.
        </p>
      </header>

      <div className="brut relative mt-10 border-2 border-line-strong p-6 sm:p-8">
        <CornerMarks />
        <RepoInput />
      </div>

      <section aria-labelledby="next-heading" className="mt-14">
        <h2
          id="next-heading"
          className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted"
        >
          What happens next
        </h2>

        <ol className="relative mt-6 ml-2 border-l-2 border-line-strong pl-7">
          {PIPELINE_STEPS.map((step, index) => (
            <li key={step.key} className="relative pb-6 last:pb-0">
              <span
                aria-hidden
                className="absolute -left-[35px] top-1 grid h-4 w-4 place-items-center border-2 border-ink bg-line-strong font-mono text-[9px] text-fg"
              >
                {index + 1}
              </span>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-fg">
                {step.label}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-12 border-t-2 border-line pt-6 text-sm leading-relaxed text-fg-muted">
        <p>
          <strong className="font-semibold text-fg">Supported:</strong> public repositories on
          github.com. Private repos, other hosts and archive uploads are not supported.
        </p>
        <p className="mt-3">
          Your code is cloned into a disposable sandbox and read as text — nothing in it is ever
          executed.{" "}
          <Link href="/docs/security" className="text-fg hover:text-brand">
            How your code is handled →
          </Link>
        </p>
      </div>
    </main>
  );
}
