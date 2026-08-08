import Link from "next/link";

/**
 * The logo mark: a solid brand square with a shield glyph, per the reference.
 *
 * Drawn as an inline SVG rather than the 🛡 emoji — emoji render differently on
 * every platform (and as a hollow outline on Windows), which is not something
 * to discover on a projector during a demo.
 */
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <span
      aria-hidden
      className={`${box} grid shrink-0 place-items-center border-2 border-ink bg-brand shadow-[3px_3px_0_0_#1a1a26]`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <path d="M12 2.5 4.5 5.6v6.2c0 4.6 3.2 8.5 7.5 9.7 4.3-1.2 7.5-5.1 7.5-9.7V5.6L12 2.5Z" fill="#08080d" />
        <path d="m8.4 12.1 2.6 2.6 5-5.2" stroke="#ff6a1f" strokeWidth="2.2" strokeLinecap="square" />
      </svg>
    </span>
  );
}

export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 no-underline">
      <Logo size={size} />
      <span
        className={`display-heading ${size === "sm" ? "text-base" : "text-xl"} tracking-tight text-fg transition-colors group-hover:text-brand`}
      >
        Vibe<span className="text-brand group-hover:text-fg">Guard</span>
      </span>
    </Link>
  );
}
