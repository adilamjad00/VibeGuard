import Link from "next/link";
import { REPO_URL, ZEROPS_URL } from "@/lib/links";
import { Logo } from "./Brand";
import { PRIMARY_NAV } from "@/lib/nav";
import { DOC_SECTIONS } from "@/lib/docs";

/** The six services, and what each one is actually doing in the pipeline. */
const SERVICES = [
  { name: "web", role: "Next.js UI", accent: "bg-brand" },
  { name: "api", role: "Fastify REST + WS", accent: "bg-cyan" },
  { name: "worker", role: "scanners + LLM", accent: "bg-violet" },
  { name: "db", role: "PostgreSQL", accent: "bg-lime" },
  { name: "valkey", role: "queue + pub/sub", accent: "bg-high" },
  { name: "storage", role: "S3 reports", accent: "bg-low" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line-strong bg-ink-2">
      <div className="shell py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="display-heading text-base">VibeGuard</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-fg-muted">
              A security and quality gate for AI-generated apps. Real scanners, a deterministic
              score, and an LLM that explains findings rather than inventing them.
            </p>
          </div>

          <FooterColumn title="Product">
            {PRIMARY_NAV.filter((item) => item.href !== "/").map((item) => (
              <FooterLink key={item.href} href={item.href}>
                {item.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Documentation">
            {DOC_SECTIONS.slice(0, 4).map((section) => (
              <FooterLink key={section.slug} href={`/docs/${section.slug}`}>
                {section.title}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Running on Zerops">
            <ul className="grid gap-2">
              {SERVICES.map((service) => (
                <li key={service.name} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className={`h-2 w-2 shrink-0 ${service.accent}`} />
                  <span className="font-mono text-fg">{service.name}</span>
                  <span className="text-xs text-fg-muted">{service.role}</span>
                </li>
              ))}
            </ul>
          </FooterColumn>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t-2 border-line pt-6 text-xs text-fg-muted">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-fg-muted hover:text-brand"
          >
            Source
          </a>
          <a
            href={ZEROPS_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-fg-muted hover:text-brand"
          >
            Zerops
          </a>
          <span className="ml-auto">
            Built with Claude Code for the Zerops Challenge. MIT licensed.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-fg-muted">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block py-1 text-sm text-fg no-underline transition-colors hover:text-brand"
    >
      {children}
    </Link>
  );
}
