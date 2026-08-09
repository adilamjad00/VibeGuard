import Link from 'next/link';
import { fetchRecentScans } from '@/lib/api';
import { Band } from '@/components/Band';
import { CtaBand } from '@/components/CtaBand';
import { RecentScans } from '@/components/RecentScans';
import { ReportPreview } from '@/components/ReportPreview';
import { CornerMarks, SectionHeading } from '@/components/SectionHeading';
import {
  SEVERITY_CHIP,
  SOURCE_META,
  SOURCE_ORDER,
  VERDICT_CHIP,
} from '@/lib/ui';
import { SEVERITY_ORDER } from '@vibeguard/core';

// The status strip and the recent-scan list must reflect the backend right
// now; a cached "healthy" badge would be worse than no badge.
export const dynamic = 'force-dynamic';

/**
 * Facts about the system, not marketing numbers.
 *
 * The accent is a marker square rather than the numeral's colour: these sit on
 * the light hero band, where cyan and lime as text fall below AA. Accents are
 * fills on light, always.
 */
const STATS = [
  { value: '3', label: 'Real scanners', accent: 'bg-brand' },
  { value: '0–100', label: 'Ship readiness score', accent: 'bg-cyan' },
  { value: '6', label: 'Zerops services', accent: 'bg-lime' },
  { value: '~30s', label: 'Typical scan', accent: 'bg-violet' },
] as const;

const CAPABILITIES = [
  {
    title: 'Finds committed secrets',
    body: 'API keys, tokens and database passwords left in source or buried in git history — the single most common thing an AI-assisted build ships by accident.',
    accent: 'bg-brand',
  },
  {
    title: 'Finds injectable code',
    body: 'Shell execution built from request data, SQL assembled by concatenation, unsafe deserialisation, weak crypto. Real static analysis, not a model guessing.',
    accent: 'bg-cyan',
  },
  {
    title: 'Finds vulnerable dependencies',
    body: 'Known CVEs matched against the exact versions in your lockfile, not the ranges in your manifest.',
    accent: 'bg-lime',
  },
  {
    title: 'Explains every one of them',
    body: 'Each finding gets why it matters in this codebase and a concrete fix you can copy. The explanations come after the score, and cannot change it.',
    accent: 'bg-violet',
  },
] as const;

const PIPELINE = [
  {
    step: '01',
    title: 'Submit',
    body: 'The URL is checked against an allowlist before anything is stored. Only public github.com repository roots get past it — this is the SSRF boundary.',
    accent: 'bg-brand',
  },
  {
    step: '02',
    title: 'Queue',
    body: 'The scan is enqueued in Valkey via BullMQ and the request returns immediately. The API never blocks on a scan, so a slow repo cannot take the site down.',
    accent: 'bg-cyan',
  },
  {
    step: '03',
    title: 'Clone',
    body: 'A private worker with no public ingress shallow-clones the repository into a disposable sandbox. It is read as text; nothing in it is ever executed.',
    accent: 'bg-violet',
  },
  {
    step: '04',
    title: 'Scan',
    body: 'gitleaks, semgrep and osv-scanner run independently. One crashing does not blank the others — it is reported as a failed scanner, never as zero findings.',
    accent: 'bg-lime',
  },
  {
    step: '05',
    title: 'Score & explain',
    body: 'A deterministic score is computed from the scanner output first. Only then does Claude explain each finding. The LLM can never change the verdict.',
    accent: 'bg-high',
  },
] as const;

const VERDICT_BANDS = [
  {
    verdict: 'pass' as const,
    range: '85 – 100',
    meaning: 'Nothing blocking from the checks that ran.',
  },
  {
    verdict: 'review' as const,
    range: '50 – 84',
    meaning: 'Real issues, not immediately exploitable. Read them first.',
  },
  {
    verdict: 'block' as const,
    range: '0 – 49',
    meaning: 'At least one finding is exploitable as-is.',
  },
];

const PRINCIPLES = [
  {
    title: 'Your code is never executed',
    body: 'No install, no build, no lifecycle scripts. The repository is cloned into a disposable sandbox and read as text, then deleted.',
  },
  {
    title: 'A broken scanner is never a clean result',
    body: 'If a scanner fails, the report says so and marks the scan partial. Silently reporting zero findings from a tool that crashed is the failure mode that matters most.',
  },
  {
    title: 'The score cannot be talked down',
    body: 'It is computed from scanner output before the LLM sees a single line, by a pure function. No repository can argue its way to a better number.',
  },
  {
    title: 'Secrets are masked before they travel',
    body: 'Detected secret values are masked before any snippet leaves the worker for the model, and the archived report holds the redacted findings — never raw scanner output.',
  },
] as const;

export default async function Home() {
  const scans = await fetchRecentScans();
  const latestComplete =
    scans.find((scan) => scan.status === 'done' && scan.verdict !== null) ??
    null;

  return (
    <main>
      {/* ── 1 · LIGHT — hero ────────────────────────────────────────────── */}
      <Band tone='light'>
        <div className='max-w-4xl'>
          <span className='chip bg-brand'>AI security &amp; quality gate</span>

          <h1 className='display-heading mt-7 text-4xl leading-[1.02] sm:text-6xl'>
            Ship readiness for
            <br />
            <span className='relative inline-block'>
              AI-generated code
              <span
                aria-hidden
                className='absolute -bottom-1 left-0 h-1.5 w-full bg-brand'
              />
            </span>
          </h1>

          <p className='mt-8 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg'>
            AI writes code faster than anyone can review it. VibeGuard runs
            three real security scanners over a public GitHub repo, scores it
            0–100, and explains every finding in plain language with a fix you
            can paste straight back into your editor.
          </p>

          <div className='mt-10 flex flex-wrap gap-4'>
            <Link
              href='/scan'
              className='brut-btn px-7 py-3.5 text-sm no-underline'
            >
              Scan a repository
            </Link>
            <Link
              href='/docs/introduction'
              className='brut-btn-ghost px-7 py-3.5 text-sm no-underline'
            >
              Read the docs
            </Link>
          </div>
        </div>

        <ul className='mt-20 grid grid-cols-2 gap-4 lg:grid-cols-4'>
          {STATS.map((stat) => (
            <li
              key={stat.label}
              className='brut border-2 border-line-strong p-5'
            >
              <span aria-hidden className={`block h-2.5 w-8 ${stat.accent}`} />
              <div className='display-heading mt-3.5 text-3xl text-fg'>
                {stat.value}
              </div>
              <div className='mt-2 font-mono text-[11px] uppercase tracking-wider text-fg-muted'>
                {stat.label}
              </div>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── 2 · DARK — what it does / why it matters ────────────────────── */}
      <Band labelledBy='capabilities-heading'>
        <SectionHeading
          id='capabilities-heading'
          eyebrow='What VibeGuard does'
          title='Four checks, one answer'
          subtitle='Generated code compiles and passes review far more easily than it passes a scanner. These are the four things that actually go wrong, and VibeGuard checks all of them on every scan.'
        />

        <ul className='grid gap-5 lg:grid-cols-2'>
          {CAPABILITIES.map((item) => (
            <li
              key={item.title}
              className='brut brut-hover border-2 border-line-strong p-6 sm:p-7'
            >
              <span
                aria-hidden
                className={`block h-8 w-8 border-2 border-ink ${item.accent}`}
              />
              <h3 className='mt-5 font-display text-lg font-bold text-fg'>
                {item.title}
              </h3>
              <p className='mt-3 text-sm leading-relaxed text-fg-muted'>
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── 3 · LIGHT — how a scan runs ─────────────────────────────────── */}
      <Band tone='light' id='pipeline' labelledBy='pipeline-heading'>
        <SectionHeading
          id='pipeline-heading'
          eyebrow='How it works'
          title='How a scan runs'
          subtitle='Six services on one private Zerops network. The browser only ever talks to the web service; the worker that clones your repository has no public ingress at all.'
        />

        <ol className='relative ml-3 border-l-2 border-line-strong pl-7 sm:ml-4 sm:pl-9'>
          {PIPELINE.map((stage) => (
            <li key={stage.step} className='relative pb-6 last:pb-0'>
              <span
                aria-hidden
                className={`absolute -left-9.25 top-5 h-3.5 w-3.5 border-2 border-ink sm:-left-11.25 ${stage.accent}`}
              />
              <div className='brut border-2 border-line-strong p-6'>
                <div className='flex items-baseline gap-3'>
                  <span className='font-mono text-xs tabular-nums text-fg-muted'>
                    {stage.step}
                  </span>
                  <h3 className='display-heading text-base text-fg'>
                    {stage.title}
                  </h3>
                </div>
                <p className='mt-3 text-sm leading-relaxed text-fg-muted'>
                  {stage.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Band>

      {/* ── 4 · DARK — scanner architecture ─────────────────────────────── */}
      <Band id='scanners' labelledBy='scanners-heading'>
        <SectionHeading
          id='scanners-heading'
          eyebrow='Scanner architecture'
          title='What actually runs'
          subtitle='Not a model guessing at your code. Three industry scanners produce the findings and the score; the LLM only explains what they found.'
        />

        <ul className='grid gap-5 sm:grid-cols-2'>
          {SOURCE_ORDER.map((source) => (
            <li
              key={source}
              className='brut brut-hover border-2 border-line-strong p-6 sm:p-7'
            >
              <span
                aria-hidden
                className={`block h-8 w-8 border-2 border-ink ${SOURCE_META[source].accent}`}
              />
              <h3 className='mt-5 font-mono text-base font-semibold text-fg'>
                {SOURCE_META[source].label}
              </h3>
              <p className='mt-3 text-sm leading-relaxed text-fg-muted'>
                {SOURCE_META[source].role}
              </p>
            </li>
          ))}
        </ul>

        <p className='mt-10 text-center text-sm text-fg-muted'>
          <Link
            href='/docs/how-it-works#scanner-architecture'
            className='text-fg hover:text-brand'
          >
            How the scanners are wired together →
          </Link>
        </p>
      </Band>

      {/* ── 5 · LIGHT — score & verdict ─────────────────────────────────── */}
      <Band tone='light' labelledBy='score-heading'>
        <SectionHeading
          id='score-heading'
          eyebrow='Scoring'
          title='What the number means'
          subtitle='The score is deterministic: the same findings always produce the same number. It starts at 100 and subtracts a weight per finding, with repeats of the same rule damped so one noisy rule cannot bury everything else.'
        />

        <div className='grid gap-6 lg:grid-cols-2'>
          <div className='brut border-2 border-line-strong p-6 sm:p-7'>
            <h3 className='font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted'>
              Verdict bands
            </h3>
            <ul className='mt-5 grid gap-4'>
              {VERDICT_BANDS.map((band) => (
                <li
                  key={band.verdict}
                  className='flex flex-wrap items-baseline gap-x-4 gap-y-1'
                >
                  <span className={`chip ${VERDICT_CHIP[band.verdict]}`}>
                    {band.verdict}
                  </span>
                  <span className='font-mono text-sm tabular-nums text-fg'>
                    {band.range}
                  </span>
                  <span className='w-full text-sm text-fg-muted sm:w-auto sm:flex-1'>
                    {band.meaning}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className='brut border-2 border-line-strong p-6 sm:p-7'>
            <h3 className='font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted'>
              Severity weights
            </h3>
            <ul className='mt-5 flex flex-wrap gap-2.5'>
              {SEVERITY_ORDER.map((severity) => (
                <li key={severity}>
                  <span className={`chip ${SEVERITY_CHIP[severity]}`}>
                    {severity}
                  </span>
                </li>
              ))}
            </ul>
            <p className='mt-5 text-sm leading-relaxed text-fg-muted'>
              A critical costs far more than a low, and four instances of the
              same rule cost less than four different criticals — otherwise one
              repeated pattern would saturate the score and hide everything
              underneath it.
            </p>
            <Link
              href='/docs/results#understanding-your-score'
              className='mt-5 inline-block font-display text-xs font-bold uppercase tracking-[0.12em] text-fg no-underline hover:text-brand-deep'
            >
              Full scoring model →
            </Link>
          </div>
        </div>
      </Band>

      {/* ── 6 · DARK — real report preview ──────────────────────────────── */}
      <Band labelledBy='preview-heading'>
        <SectionHeading
          id='preview-heading'
          eyebrow='Live from this deployment'
          title='A real report'
          subtitle='Not a screenshot. This is the most recent scan that finished on this instance, straight from the database.'
        />

        <ReportPreview scan={latestComplete} />

        {scans.length > 0 ? (
          <div className='mt-12'>
            <h3 className='mb-5 font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted'>
              Recent scans
            </h3>
            <RecentScans scans={scans.slice(0, 5)} />
          </div>
        ) : null}
      </Band>

      {/* ── 7 · LIGHT — trust & safety ──────────────────────────────────── */}
      <Band tone='light' labelledBy='trust-heading'>
        <SectionHeading
          id='trust-heading'
          eyebrow='Trust &amp; safety'
          title='How your code is handled'
          subtitle='You are handing a security tool a repository. These are the guarantees that come with that, and they are enforced in the pipeline rather than promised in a policy.'
        />

        <ul className='grid gap-5 lg:grid-cols-2'>
          {PRINCIPLES.map((principle) => (
            <li
              key={principle.title}
              className='brut relative border-2 border-line-strong p-6 sm:p-7'
            >
              <CornerMarks />
              <h3 className='font-display text-base font-bold text-fg'>
                {principle.title}
              </h3>
              <p className='mt-3 text-sm leading-relaxed text-fg-muted'>
                {principle.body}
              </p>
            </li>
          ))}
        </ul>

        <p className='mt-10 text-center text-sm text-fg-muted'>
          <Link href='/docs/security' className='text-fg hover:text-brand-deep'>
            Read the security documentation →
          </Link>
        </p>
      </Band>

      {/* ── 8 · BRAND — closing CTA ─────────────────────────────────────── */}
      <CtaBand
        secondary={{ href: '/docs/getting-started', label: 'Getting started' }}
      />
    </main>
  );
}
