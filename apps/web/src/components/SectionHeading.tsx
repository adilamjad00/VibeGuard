/**
 * The reference's section header: heavy uppercase title with a thick rule
 * struck under it, and a muted line of subtitle beneath.
 */
export function SectionHeading({
  title,
  subtitle,
  align = "center",
  id,
}: {
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  id?: string;
}) {
  const centered = align === "center";
  return (
    <header className={`mb-8 ${centered ? "text-center" : ""}`}>
      <h2
        id={id}
        className="display-heading inline-block text-2xl text-fg sm:text-3xl"
      >
        {title}
        <span aria-hidden className="mt-2 block h-[5px] w-full bg-brand" />
      </h2>
      {subtitle ? (
        <p
          className={`mt-3 text-sm leading-relaxed text-fg-muted ${centered ? "mx-auto max-w-2xl" : "max-w-2xl"}`}
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
      <span aria-hidden className={`absolute -left-[6px] -top-[6px] h-2.5 w-2.5 ${color}`} />
      <span aria-hidden className={`absolute -right-[6px] -bottom-[6px] h-2.5 w-2.5 ${color}`} />
    </>
  );
}
