import { fixClipboardText, locationOf, type NormalizedFinding } from "@vibeguard/core";
import { CATEGORY_LABEL, SEVERITY_BORDER, SEVERITY_CHIP } from "@/lib/ui";
import { CopyButton } from "./CopyButton";

/**
 * One finding, expandable.
 *
 * Built on native `<details>`/`<summary>`: keyboard operable, announced as a
 * disclosure, and findable by the browser's in-page search even while
 * collapsed — none of which a div-based accordion gets for free.
 *
 * Criticals are open by default. Anything that severe should not need a click
 * before you can see what it is.
 */
export function FindingCard({ finding, index }: { finding: NormalizedFinding; index: number }) {
  const location = locationOf(finding);
  const explained = Boolean(finding.explanation || finding.recommendedFix);

  return (
    <details
      open={finding.severity === "critical"}
      className={`brut group border-2 border-line-strong border-l-[6px] ${SEVERITY_BORDER[finding.severity]} [&[open]>summary]:border-b-2 [&[open]>summary]:border-line`}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="mt-0.5 font-mono text-xs tabular-nums text-fg-muted">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${SEVERITY_CHIP[finding.severity]}`}>{finding.severity}</span>
            <span className="chip-ghost">{finding.source}</span>
            <span className="chip-ghost">
              {CATEGORY_LABEL[finding.category] ?? finding.category}
            </span>
            {!explained ? <span className="chip-ghost">unexplained</span> : null}
          </div>

          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-fg">{finding.title}</h3>

          {location ? (
            <p className="mt-1 break-all font-mono text-xs text-fg-muted">{location}</p>
          ) : null}
        </div>

        <span
          aria-hidden
          className="mt-1 shrink-0 font-mono text-xs text-fg-muted transition-transform group-open:rotate-90"
        >
          ▶
        </span>
      </summary>

      <div className="space-y-4 p-4">
        {finding.snippet ? (
          <div>
            <Label>Code</Label>
            <pre className="mt-1.5 overflow-x-auto border-2 border-line bg-ink p-3 font-mono text-xs leading-relaxed text-high">
              <code>{finding.snippet.trim()}</code>
            </pre>
          </div>
        ) : null}

        {finding.explanation ? (
          <div>
            <Label>Why it matters</Label>
            <p className="mt-1.5 text-sm leading-relaxed text-fg">{finding.explanation}</p>
          </div>
        ) : null}

        {finding.recommendedFix ? (
          <div className="border-2 border-pass/40 bg-pass/[0.06] p-3">
            <Label tone="text-pass">Recommended fix</Label>
            <p className="mt-1.5 text-sm leading-relaxed text-fg">{finding.recommendedFix}</p>
          </div>
        ) : null}

        {!explained ? (
          <p className="text-sm leading-relaxed text-fg-muted">
            The scanner reported this finding but the explanation pass did not cover it. The
            detection itself is unaffected — scanner findings are authoritative, the LLM only adds
            context.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CopyButton text={fixClipboardText(finding)} label="Copy finding + fix" />
          <span className="font-mono text-[11px] text-fg-muted">
            fingerprint {finding.fingerprint.slice(0, 12) || "n/a"}
          </span>
        </div>
      </div>
    </details>
  );
}

function Label({ children, tone = "text-fg-muted" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={`font-display text-[10px] font-extrabold uppercase tracking-[0.16em] ${tone}`}
    >
      {children}
    </span>
  );
}
