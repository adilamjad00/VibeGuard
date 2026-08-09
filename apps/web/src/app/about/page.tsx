import Link from "next/link";
import type { Metadata } from "next";
import { Band } from "@/components/Band";
import { CtaBand } from "@/components/CtaBand";
import { SectionHeading } from "@/components/SectionHeading";
import { REPO_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "About — VibeGuard",
  description:
    "Why VibeGuard exists, the problem it addresses, how it approaches security, and the principles behind it.",
};

const STACK = [
  {
    layer: "Frontend",
    detail: "Next.js App Router, server components, Tailwind v4. No client-side data fetching except the live progress socket.",
  },
  {
    layer: "API",
    detail: "Fastify. REST plus a WebSocket and an SSE endpoint sharing one feed implementation. URL validation and Valkey-backed rate limiting live here.",
  },
  {
    layer: "Worker",
    detail: "Node with gitleaks, semgrep and osv-scanner installed into the image. Pulls jobs from BullMQ; no public ingress.",
  },
  {
    layer: "Data",
    detail: "PostgreSQL for scans, findings and progress events. Valkey for the queue and pub/sub. A private S3 bucket for archived reports.",
  },
  {
    layer: "Model",
    detail: "Claude, called once per scan for explanations and fixes — after the score is already fixed.",
  },
] as const;

const PRINCIPLES = [
  {
    title: "Real tools produce the findings",
    body: "The detection is done by gitleaks, semgrep and osv-scanner — tools with years of rules behind them. Asking a language model to find vulnerabilities directly gets you confident prose about problems that are not there, and silence about ones that are.",
  },
  {
    title: "The model explains, and only explains",
    body: "The score is computed before the model is called, by a pure function it has no access to. That is an ordering, not a policy — which is why a repository putting instructions in its own comments does not get anywhere.",
  },
  {
    title: "Failure is never silence",
    body: "A crashed scanner is reported as failed, never as zero findings. If every scanner fails, no score is shown at all. Reporting 100/pass because nothing ran would be the single worst thing this product could do.",
  },
  {
    title: "Say what you do not know",
    body: "A pass means the checks that ran came back clean, and the interface says exactly that rather than implying a clean bill of health. The limits are documented as prominently as the features.",
  },
] as const;

export default function AboutPage() {
  return (
    <main>
      <Band tone="light">
        <div className="max-w-3xl">
          <span className="chip bg-brand">About</span>
          <h1 className="display-heading mt-7 text-4xl leading-[1.05] sm:text-5xl">
            A security gate for code
            <br />
            nobody fully read
            <span aria-hidden className="mt-5 block h-1.25 w-32 bg-brand" />
          </h1>
          <p className="mt-8 text-base leading-relaxed text-fg-muted sm:text-lg">
            VibeGuard scans a repository with several independent security tools, normalises their
            findings, and turns the results into one report with a score and actionable explanations.
            It exists because the step between &quot;the AI wrote it and it works&quot; and &quot;this
            is on the internet&quot; is usually nothing at all.
          </p>
        </div>
      </Band>

      <Band labelledBy="problem-heading">
        <SectionHeading
          id="problem-heading"
          align="left"
          eyebrow="The problem"
          title="Generated code fails review differently"
          subtitle="It is not that AI-written code is worse. It is that it is fluent, and fluency hides a specific set of mistakes."
        />

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-5 text-[15px] leading-relaxed text-fg-muted">
            <p>
              Code review is calibrated for human mistakes — the half-finished thought, the variable
              that does not quite make sense, the function that is obviously doing too much. Generated
              code has none of those tells. It is consistent, plausibly named and well formatted, and
              it slides past a skim.
            </p>
            <p>
              What it does contain, reliably: a config file with a real-looking API key, because the
              example needed one. A shell command assembled from a request parameter, because that was
              the shortest way to express it. A package version remembered from training data with an
              advisory published since.
            </p>
            <p>
              None of that needs a clever detector. Existing tools find all of it in seconds. The
              missing piece is that nobody runs them on a weekend project, because setting three
              scanners up is more work than the project was.
            </p>
          </div>

          <div className="brut border-2 border-line-strong p-6 sm:p-8">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted">
              What VibeGuard reduces that to
            </h3>
            <ol className="mt-5 grid gap-4 text-sm text-fg-muted">
              <li className="flex gap-3">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 bg-brand" />
                <span>Paste a public GitHub URL.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 bg-cyan" />
                <span>Wait about thirty seconds.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 bg-lime" />
                <span>
                  Read a score, a verdict and a ranked list of findings — each with a file, a line and
                  a fix you can copy.
                </span>
              </li>
            </ol>
            <p className="mt-6 text-sm leading-relaxed text-fg-muted">
              No account, no install, no configuration file, no CI integration required.
            </p>
          </div>
        </div>
      </Band>

      <Band tone="light" labelledBy="principles-heading">
        <SectionHeading
          id="principles-heading"
          eyebrow="Approach"
          title="Design principles"
          subtitle="Four decisions that shaped the architecture more than any feature did."
        />

        <ul className="grid gap-5 lg:grid-cols-2">
          {PRINCIPLES.map((principle, index) => (
            <li key={principle.title} className="brut border-2 border-line-strong p-6 sm:p-7">
              <span className="font-mono text-xs tabular-nums text-fg-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-display text-base font-bold text-fg">{principle.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{principle.body}</p>
            </li>
          ))}
        </ul>
      </Band>

      <Band labelledBy="stack-heading">
        <SectionHeading
          id="stack-heading"
          eyebrow="Technology"
          title="How it is built"
          subtitle="Six services on one private network, deployed on Zerops. The whole thing is open source."
        />

        <ul className="grid gap-4">
          {STACK.map((item) => (
            <li
              key={item.layer}
              className="brut grid gap-2 border-2 border-line-strong p-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6 sm:p-6"
            >
              <span className="font-display text-sm font-bold uppercase tracking-[0.1em] text-brand">
                {item.layer}
              </span>
              <span className="text-sm leading-relaxed text-fg-muted">{item.detail}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="brut-btn-ghost px-6 py-3 text-xs no-underline"
          >
            Read the source
          </a>
          <Link href="/docs/how-it-works" className="brut-btn-ghost px-6 py-3 text-xs no-underline">
            Architecture in detail
          </Link>
        </div>
      </Band>

      <Band tone="light" labelledBy="honest-heading">
        <SectionHeading
          id="honest-heading"
          eyebrow="Limits"
          title="What this is not"
          subtitle="Stated here rather than buried, because a security tool that oversells itself is worse than no tool."
        />

        <div className="brut mx-auto max-w-3xl border-2 border-line-strong p-6 sm:p-8">
          <ul className="grid gap-4 text-sm leading-relaxed text-fg-muted">
            <li>
              <strong className="text-fg">Not a penetration test.</strong> Nothing is executed and
              nothing is probed at runtime.
            </li>
            <li>
              <strong className="text-fg">Not a compliance certification.</strong> No attestation, no
              standard, no audit trail.
            </li>
            <li>
              <strong className="text-fg">Not complete coverage.</strong> Business logic, access
              control between users, race conditions and infrastructure configuration are outside what
              these scanners see.
            </li>
            <li>
              <strong className="text-fg">Not free of false positives.</strong> A fake key in a test
              fixture is still a hardcoded secret to a scanner.
            </li>
          </ul>
          <p className="mt-6 text-sm text-fg-muted">
            <Link href="/docs/introduction#what-it-does-not-claim" className="text-fg hover:text-brand-deep">
              The full list, in the docs →
            </Link>
          </p>
        </div>
      </Band>

      <CtaBand
        title="See what your repo is actually shipping"
        body="One URL, about thirty seconds, and a report you can act on."
        secondary={{ href: "/docs", label: "Read the docs" }}
      />
    </main>
  );
}
