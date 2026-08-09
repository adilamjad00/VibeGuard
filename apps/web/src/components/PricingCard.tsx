import Link from "next/link";

export interface Plan {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: readonly string[];
  /** Available today, or a planned tier that cannot be bought yet. */
  status: "available" | "planned";
  cta: { href: string; label: string } | { label: string };
  featured?: boolean;
}

/**
 * A pricing tier.
 *
 * Planned tiers render a disabled button rather than a link to a checkout that
 * does not exist. A button that looks purchasable and silently does nothing is
 * the dead-button failure this product is otherwise careful to avoid.
 */
export function PricingCard({ plan }: { plan: Plan }) {
  const available = plan.status === "available";

  return (
    <div
      className={`brut relative flex h-full flex-col border-2 p-6 sm:p-8 ${
        plan.featured ? "border-brand" : "border-line-strong"
      }`}
    >
      {plan.featured ? (
        <span className="chip absolute -top-3 left-6 bg-brand">Planned next</span>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="display-heading text-lg text-fg">{plan.name}</h3>
        {available ? (
          <span className="chip bg-pass">Available now</span>
        ) : (
          <span className="chip-ghost">Coming soon</span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{plan.tagline}</p>

      <p className="mt-6 flex items-baseline gap-2">
        <span className="display-heading text-4xl text-fg">{plan.price}</span>
        <span className="font-mono text-xs uppercase tracking-wider text-fg-muted">
          {plan.cadence}
        </span>
      </p>

      <ul className="mt-7 grid flex-1 gap-3 text-sm text-fg-muted">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 ${available ? "bg-pass" : "bg-line-strong"}`}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {"href" in plan.cta ? (
          <Link href={plan.cta.href} className="brut-btn w-full px-5 py-3 text-xs no-underline">
            {plan.cta.label}
          </Link>
        ) : (
          <button type="button" disabled className="brut-btn-ghost w-full px-5 py-3 text-xs">
            {plan.cta.label}
          </button>
        )}
      </div>
    </div>
  );
}
