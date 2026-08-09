import type { NormalizedFinding } from '@vibeguard/core';
import { locationOf } from '@vibeguard/core';
import { CATEGORY_LABEL } from '@/lib/ui';

/**
 * The AI review: whole-file observations about the classes of problem a static
 * rule cannot express — an operation with no ownership check, untrusted input
 * reaching a model prompt.
 *
 * Rendered as its own section, in the violet the LLM is identified by
 * everywhere else, and captioned as unscored on every card. It is deliberately
 * placed *after* the scanner findings: these are the softer signal, and the
 * layout should say so before anyone reads one.
 */
export function AdvisoryFindings({ findings }: { findings: NormalizedFinding[] }) {
  if (findings.length === 0) return null;

  return (
    <section aria-labelledby='advisory-heading' className='mt-2'>
      <header className='mb-6'>
        <div className='flex flex-wrap items-center gap-3'>
          <h2
            id='advisory-heading'
            className='display-heading text-xl text-fg sm:text-2xl'
          >
            AI review
          </h2>
          <span className='chip bg-violet'>advisory · not scored</span>
        </div>
        <p className='mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted'>
          A language model read the source files looking for weaknesses a
          pattern-matching scanner cannot express — an update route with no
          ownership check, untrusted input reaching a prompt.{' '}
          <strong className='font-semibold text-fg'>
            None of this affects the score.
          </strong>{' '}
          The score was computed from the scanner output before this pass ran,
          and these observations are not reproducible the way a scanner rule is.
          Treat them as leads to check, not as confirmed findings.
        </p>
      </header>

      <ol className='grid gap-4'>
        {findings.map((finding, index) => {
          const location = locationOf(finding);
          return (
            <li
              key={finding.fingerprint || `${finding.title}-${index}`}
              className='brut min-w-0 border-2 border-line-strong border-l-[6px] border-l-violet p-5 sm:p-6'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <span className='chip bg-violet'>{finding.severity}</span>
                <span className='chip-ghost'>claude</span>
                <span className='chip-ghost'>
                  {CATEGORY_LABEL[finding.category] ?? finding.category}
                </span>
              </div>

              <h3 className='mt-3 text-[15px] font-semibold leading-snug text-fg'>
                {finding.title}
              </h3>

              {location ? (
                <p className='mt-1 break-all font-mono text-xs text-fg-muted'>
                  {location}
                </p>
              ) : null}

              {finding.snippet ? (
                <pre className='mt-3 overflow-x-auto border-2 border-line bg-ink p-3 font-mono text-xs leading-relaxed text-violet'>
                  <code>{finding.snippet}</code>
                </pre>
              ) : null}

              {finding.explanation ? (
                <p className='mt-3 text-sm leading-relaxed text-fg-muted'>
                  {finding.explanation}
                </p>
              ) : null}

              {finding.recommendedFix ? (
                <div className='mt-3 border-2 border-violet/40 bg-violet/[0.06] p-3'>
                  <span className='font-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet'>
                    Suggested change
                  </span>
                  <p className='mt-1.5 text-sm leading-relaxed text-fg'>
                    {finding.recommendedFix}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
