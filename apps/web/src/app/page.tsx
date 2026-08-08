import { fetchRecentScans } from "@/lib/api";
import { RepoInput } from "@/components/RepoInput";
import { RecentScans } from "@/components/RecentScans";
import { CornerMarks, SectionHeading } from "@/components/SectionHeading";
import { SOURCE_META, SOURCE_ORDER } from "@/lib/ui";

// The health strip and the recent-scan list must reflect the backend right
// now; a cached "healthy" badge would be worse than no badge.
export const dynamic = "force-dynamic";

/** Facts about the system, not marketing numbers. */
const STATS = [
  { value: "3", label: "Real scanners", tone: "text-brand" },
  { value: "0–100", label: "Ship readiness score", tone: "text-cyan" },
  { value: "6", label: "Zerops services", tone: "text-lime" },
  { value: "~30s", label: "Typical scan", tone: "text-violet" },
] as const;

const PIPELINE = [
  {
    step: "01",
    title: "Submit",
    body: "The URL is checked against an allowlist before anything is stored. Only public github.com repository roots get past it — this is the SSRF boundary.",
    accent: "bg-brand",
  },
  {
    step: "02",
    title: "Queue",
    body: "The scan is enqueued in Valkey via BullMQ and the request returns immediately. The API never blocks on a scan, so a slow repo cannot take the site down.",
    accent: "bg-cyan",
  },
  {
    step: "03",
    title: "Clone",
    body: "A private worker with no public ingress shallow-clones the repository into a disposable sandbox. It is read as text; nothing in it is ever executed.",
    accent: "bg-violet",
  },
  {
    step: "04",
    title: "Scan",
    body: "gitleaks, semgrep and osv-scanner run independently. One crashing does not blank the others — it is reported as a failed scanner, never as zero findings.",
    accent: "bg-lime",
  },
  {
    step: "05",
    title: "Score & explain",
    body: "A deterministic score is computed from the scanner output first. Only then does Claude explain each finding. The LLM can never change the verdict.",
    accent: "bg-high",
  },
] as const;

export default async function Home() {
  const scans = await fetchRecentScans();

  return (
    <main>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
        <span className="chip bg-brand">AI security &amp; quality gate</span>

        <h1 className="display-heading mt-5 max-w-4xl text-4xl leading-[1.02] sm:text-6xl">
          Ship readiness for
          <br />
          <span className="relative inline-block">
            AI-generated code
            <span aria-hidden className="absolute -bottom-1 left-0 h-[6px] w-full bg-brand" />
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
          Paste a public GitHub repo. VibeGuard runs real security scanners against it, scores it
          0–100, and explains every finding in plain language with a fix you can paste straight
          back into your editor.
        </p>

        <div id="scan" className="brut border-2 border-line-strong relative mt-9 max-w-3xl scroll-mt-24 p-5 sm:p-6">
          <CornerMarks />
          <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-fg-muted">
            Scan a repository
          </h2>
          <div className="mt-4">
            <RepoInput />
          </div>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((stat) => (
            <li key={stat.label} className="brut border-2 border-line-strong p-4">
              <div className={`display-heading text-3xl ${stat.tone}`}>{stat.value}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-muted">
                {stat.label}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Scanners ───────────────────────────────────────────────────── */}
      <section
        id="scanners"
        aria-labelledby="scanners-heading"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6"
      >
        <SectionHeading
          id="scanners-heading"
          title="What actually runs"
          subtitle="Not a model guessing at your code. Three industry scanners produce the findings and the score; the LLM only explains what they found."
        />

        <ul className="grid gap-4 sm:grid-cols-2">
          {SOURCE_ORDER.map((source) => (
            <li key={source} className="brut brut-hover relative border-2 border-line-strong p-5">
              <span aria-hidden className={`block h-8 w-8 border-2 border-ink ${SOURCE_META[source].accent}`} />
              <h3 className="mt-3.5 font-mono text-base font-semibold text-fg">
                {SOURCE_META[source].label}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{SOURCE_META[source].role}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Pipeline ───────────────────────────────────────────────────── */}
      <section
        id="pipeline"
        aria-labelledby="pipeline-heading"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6"
      >
        <SectionHeading
          id="pipeline-heading"
          title="How a scan runs"
          subtitle="Six services on one private Zerops network. The browser only ever talks to the web service."
        />

        <ol className="relative ml-3 border-l-2 border-line-strong pl-6 sm:ml-4 sm:pl-8">
          {PIPELINE.map((stage) => (
            <li key={stage.step} className="relative pb-5 last:pb-0">
              <span
                aria-hidden
                className={`absolute -left-[33px] top-4 h-3.5 w-3.5 border-2 border-ink sm:-left-[41px] ${stage.accent}`}
              />
              <div className="brut border-2 border-line-strong p-4 sm:p-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs tabular-nums text-fg-muted">{stage.step}</span>
                  <h3 className="display-heading text-base text-fg">{stage.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Recent scans ───────────────────────────────────────────────── */}
      <section aria-labelledby="recent-heading" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionHeading
          id="recent-heading"
          title="Recent scans"
          subtitle="Live from the database on this deployment."
        />
        <RecentScans scans={scans} />
      </section>
    </main>
  );
}
