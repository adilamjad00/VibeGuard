/**
 * One horizontal band of a marketing page.
 *
 * `light` applies the `surface-light` token override, which re-points the
 * ground-level colour variables for everything inside it — cards, chips,
 * borders, muted text all adapt with no per-component work. `brand` is the
 * full-bleed accent band used once per page for the closing call to action.
 *
 * Bands own the vertical rhythm (`section`) and the horizontal measure
 * (`shell`) so no page has to re-derive either.
 */
const TONE = {
  dark: "",
  light: "surface-light border-y-2 border-ink",
  brand: "bg-brand text-ink border-y-2 border-ink",
} as const;

export function Band({
  tone = "dark",
  id,
  labelledBy,
  tight = false,
  children,
}: {
  tone?: keyof typeof TONE;
  id?: string;
  labelledBy?: string;
  tight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${tight ? "section-tight" : "section"} ${TONE[tone]} ${id ? "scroll-mt-24" : ""}`}
    >
      <div className="shell">{children}</div>
    </section>
  );
}
