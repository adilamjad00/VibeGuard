import type { Metadata } from "next";
import { Band } from "@/components/Band";
import { CtaBand } from "@/components/CtaBand";
import { SectionHeading } from "@/components/SectionHeading";
import { PricingCard, type Plan } from "@/components/PricingCard";

export const metadata: Metadata = {
  title: "Pricing — VibeGuard",
  description:
    "VibeGuard is free to use today. Paid tiers are planned; there is no payment system yet.",
};

const PLANS: readonly Plan[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Everything VibeGuard does today. This is not a trial and it does not expire.",
    status: "available",
    features: [
      "Public repository scanning",
      "Ship Readiness Score and verdict",
      "All three scanners — gitleaks, semgrep, osv-scanner",
      "AI explanation and a fix for every finding",
      "Live scan progress",
      "Downloadable JSON report",
    ],
    cta: { href: "/scan", label: "Start scanning" },
  },
  {
    name: "Pro",
    price: "$9",
    cadence: "/ month",
    tagline: "For someone shipping regularly who wants history and higher throughput.",
    status: "planned",
    featured: true,
    features: [
      "Everything in Free",
      "Private repository scanning",
      "Scan history and score trend over time",
      "Re-scan diff — what a fix actually changed",
      "Higher rate limits and priority queueing",
      "Markdown and PDF report export",
    ],
    cta: { label: "Coming soon" },
  },
  {
    name: "Team",
    price: "$19",
    cadence: "/ month",
    tagline: "For a team that wants the gate in the pipeline rather than in a browser tab.",
    status: "planned",
    features: [
      "Everything in Pro",
      "Shared workspace and scan history",
      "CI gate — fail a build below a score threshold",
      "Webhook on push",
      "Per-repository rule configuration and suppressions",
      "Highest limits",
    ],
    cta: { label: "Coming soon" },
  },
] as const;

export default function PricingPage() {
  return (
    <main>
      <Band tone="light">
        <div className="mx-auto max-w-3xl text-center">
          <span className="chip bg-brand">Pricing</span>
          <h1 className="display-heading mt-7 text-4xl leading-[1.05] sm:text-5xl">
            Free while it is useful
            <span aria-hidden className="mx-auto mt-5 block h-1.25 w-32 bg-brand" />
          </h1>
          <p className="mt-8 text-base leading-relaxed text-fg-muted">
            Everything on this site works right now, at no cost and without an account. The paid tiers
            below are a plan, not a product — they exist here so the direction is visible, and none of
            them can be bought yet.
          </p>
        </div>

        {/* Stated before the cards, not after, so nobody reaches a price
            expecting a checkout. */}
        <div
          role="note"
          className="brut mx-auto mt-10 max-w-3xl border-2 border-high bg-high/10 p-5 text-center"
        >
          <p className="text-sm leading-relaxed text-fg">
            <strong className="font-semibold">There is no payment system.</strong> No checkout, no
            billing, no card details collected anywhere. The Pro and Team buttons are disabled because
            those tiers do not exist yet.
          </p>
        </div>
      </Band>

      <Band labelledBy="plans-heading">
        <SectionHeading
          id="plans-heading"
          eyebrow="Plans"
          title="What is here and what is planned"
          subtitle="One tier you can use today, and two that describe where this is going if it turns out to be worth building."
        />

        <ul className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <li key={plan.name}>
              <PricingCard plan={plan} />
            </li>
          ))}
        </ul>
      </Band>

      <Band tone="light" labelledBy="faq-heading">
        <SectionHeading
          id="faq-heading"
          eyebrow="Questions"
          title="About the free tier"
          subtitle="The honest answers, since &quot;free&quot; usually comes with something attached."
        />

        <div className="mx-auto grid max-w-3xl gap-4">
          <Faq q="Is the free tier a trial?">
            No. It is the product as it exists. There is no expiry, no scan quota beyond a per-IP rate
            limit that exists to stop the queue being flooded, and no feature held back.
          </Faq>
          <Faq q="Do you sell or train on my code?">
            No. Only public repositories can be scanned, the clone is deleted when the scan ends, and
            what persists is the findings and the archived report. Snippets are sent to Anthropic&apos;s
            API for the explanation step, with detected secret values masked first.
          </Faq>
          <Faq q="Why show prices for things that do not exist?">
            Because the alternative is pretending there is no plan. The tiers name what would justify
            charging — private repositories, history, a CI gate — so it is clear what is deliberately
            missing today rather than merely unfinished.
          </Faq>
          <Faq q="What happens to free when the paid tiers ship?">
            Public repository scanning with all three scanners, the score and the explanations stay
            free. That is the part that is useful to someone checking a weekend project, and it is the
            reason this exists.
          </Faq>
        </div>
      </Band>

      <CtaBand
        title="Start with the free tier"
        body="It is the whole product. Paste a repository URL and see what comes back."
        secondary={{ href: "/docs/getting-started", label: "Getting started" }}
      />
    </main>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="brut group border-2 border-line-strong">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex-1 font-display text-sm font-bold text-fg">{q}</span>
        <span
          aria-hidden
          className="shrink-0 font-mono text-xs text-fg-muted transition-transform group-open:rotate-90"
        >
          ▶
        </span>
      </summary>
      <p className="border-t-2 border-line p-5 text-sm leading-relaxed text-fg-muted">{children}</p>
    </details>
  );
}
