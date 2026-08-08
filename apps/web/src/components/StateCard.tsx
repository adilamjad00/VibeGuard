const TONE = {
  block: { border: "border-block", chip: "bg-block", title: "text-block" },
  high: { border: "border-high", chip: "bg-high", title: "text-high" },
  neutral: { border: "border-line-strong", chip: "bg-fg-muted", title: "text-fg" },
} as const;

/**
 * The shared shape for every non-report state: error, failure, not-found.
 *
 * Each one names what happened, says what it means, and offers the next
 * action — an empty page with a sad face is not a state, it is a dead end.
 */
export function StateCard({
  tone = "neutral",
  badge,
  title,
  body,
  children,
}: {
  tone?: keyof typeof TONE;
  badge: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const style = TONE[tone];
  return (
    <section role="alert" className={`brut border-2 ${style.border} p-6 sm:p-8`}>
      <span className={`chip ${style.chip}`}>{badge}</span>
      <h1 className={`display-heading mt-4 text-2xl ${style.title}`}>{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">{body}</p>
      {children ? <div className="mt-6 flex flex-wrap gap-3">{children}</div> : null}
    </section>
  );
}
