import Link from "next/link";
import { docPath, findSection, siblings } from "@/lib/docs";
import { DocsSidebar } from "./DocsSidebar";

/**
 * The shell every documentation page renders inside: sidebar, measured content
 * column, on-this-page anchors and a pager.
 *
 * Docs stay on the dark surface rather than joining the marketing pages'
 * alternating bands — a colour change part-way through an article interrupts
 * reading, and code blocks would have to be restyled across the boundary.
 */
export function DocsPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const section = findSection(slug);
  if (!section) throw new Error(`unknown docs section: ${slug}`);
  const { prev, next } = siblings(slug);

  return (
    <main className="shell py-10 sm:py-14">
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        {/* Desktop rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
              Documentation
            </p>
            <DocsSidebar />
          </div>
        </aside>

        {/* Mobile disclosure. Native <details> so it is keyboard operable and
            announced without any JavaScript. */}
        <details className="brut mb-10 border-2 border-line-strong lg:hidden">
          <summary className="cursor-pointer list-none p-4 font-display text-xs font-extrabold uppercase tracking-[0.14em] text-fg marker:hidden [&::-webkit-details-marker]:hidden">
            Documentation menu
          </summary>
          <div className="border-t-2 border-line p-4">
            <DocsSidebar />
          </div>
        </details>

        <div className="min-w-0">
          <article className="max-w-3xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
              <Link href="/docs" className="text-fg-muted no-underline hover:text-brand">
                Docs
              </Link>{" "}
              / {section.title}
            </p>

            <h1 className="display-heading mt-4 text-3xl sm:text-4xl">
              {section.title}
              <span aria-hidden className="mt-3 block h-1.25 w-24 bg-brand" />
            </h1>

            <p className="mt-6 text-[15px] leading-relaxed text-fg-muted">{section.summary}</p>

            {/* On this page — kept inline above the content rather than in a
                second rail, so it works identically at every width. */}
            <nav aria-label="On this page" className="brut mt-10 border-2 border-line p-5">
              <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-fg-muted">
                On this page
              </p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {section.anchors.map((anchor) => (
                  <li key={anchor.id}>
                    <a
                      href={`#${anchor.id}`}
                      className="text-sm text-fg-muted no-underline hover:text-brand"
                    >
                      {anchor.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="prose-vg mt-12">{children}</div>
          </article>

          <nav
            aria-label="Documentation pager"
            className="mt-16 grid gap-4 border-t-2 border-line pt-8 sm:grid-cols-2"
          >
            {prev ? (
              <PagerLink href={docPath(prev.slug)} direction="Previous" title={prev.title} />
            ) : (
              <span />
            )}
            {next ? (
              <PagerLink href={docPath(next.slug)} direction="Next" title={next.title} align="right" />
            ) : null}
          </nav>
        </div>
      </div>
    </main>
  );
}

function PagerLink({
  href,
  direction,
  title,
  align = "left",
}: {
  href: string;
  direction: string;
  title: string;
  align?: "left" | "right";
}) {
  return (
    <Link
      href={href}
      className={`brut brut-hover block border-2 border-line-strong p-4 no-underline ${
        align === "right" ? "sm:text-right" : ""
      }`}
    >
      <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-fg-muted">
        {direction}
      </span>
      <span className="mt-1 block font-display text-sm font-bold uppercase tracking-wide text-fg">
        {title}
      </span>
    </Link>
  );
}
