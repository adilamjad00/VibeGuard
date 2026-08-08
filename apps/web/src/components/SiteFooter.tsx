import { REPO_URL, ZEROPS_URL } from "@/lib/links";
import { Logo } from "./Brand";

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
    <footer className="mt-20 border-t-2 border-line-strong bg-ink-2">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="display-heading text-base">VibeGuard</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">
              A security and quality gate for AI-generated apps. Real scanners, a deterministic
              score, and an LLM that explains findings rather than inventing them.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-fg-muted">
              Running on Zerops
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {SERVICES.map((service) => (
                <li key={service.name} className="flex items-center gap-2">
                  <span aria-hidden className={`h-2 w-2 shrink-0 ${service.accent}`} />
                  <span className="font-mono text-fg">{service.name}</span>
                  <span className="text-xs text-fg-muted">{service.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-line pt-5 text-xs text-fg-muted">
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="text-fg-muted hover:text-brand">
            Source
          </a>
          <a href={ZEROPS_URL} target="_blank" rel="noreferrer noopener" className="text-fg-muted hover:text-brand">
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
