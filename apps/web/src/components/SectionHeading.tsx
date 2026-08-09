/**
 * The reference's section header: heavy uppercase title with a thick rule
 * struck under it, and a muted line of subtitle beneath.
 *
 * The rule is a brand *fill*, not brand text — which is what keeps it legible
 * on the light bands, where brand orange as text would fall below AA.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  id?: string;
}) {
  const centered = align === "center";
  return (
    <header className={`mb-12 ${centered ? "text-center" : ""}`}>
      {eyebrow ? (
        <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
          {eyebrow}
        </p>
      ) : null}

      <h2 id={id} className="display-heading inline-block text-2xl text-fg sm:text-3xl">
        {title}
        <span aria-hidden className="mt-2.5 block h-1.25 w-full bg-brand" />
      </h2>

      {subtitle ? (
        <p
          className={`mt-5 text-[15px] leading-relaxed text-fg-muted ${centered ? "mx-auto max-w-2xl" : "max-w-2xl"}`}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

/**
 * Small solid squares in the corner of a card — the reference uses these as
 * decorative punctuation. Purely ornamental, so hidden from assistive tech.
 */
export function CornerMarks({ color = "bg-brand" }: { color?: string }) {
  return (
    <>
      <span aria-hidden className={`absolute -left-1.5 -top-1.5 h-2.5 w-2.5 ${color}`} />
      <span aria-hidden className={`absolute -right-1.5 -bottom-1.5 h-2.5 w-2.5 ${color}`} />
    </>
  );
}
