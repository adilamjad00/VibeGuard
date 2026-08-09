import type { NormalizedFinding, Verdict } from '@vibeguard/core';
import { locationOf } from '@vibeguard/core';
import { SEVERITY_CHIP, VERDICT_CHIP } from '@/lib/ui';

export interface ScanDiffPayload {
  previous: { id: string; commitSha: string | null; createdAt: string };
  fixed: NormalizedFinding[];
  introduced: NormalizedFinding[];
  moved: NormalizedFinding[];
  unchanged: NormalizedFinding[];
  unknown: NormalizedFinding[];
  comparable: boolean;
  coverageGap: string[];
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  previousVerdict: Verdict;
  currentVerdict: Verdict;
  verdictChanged: boolean;
  sameCommit: boolean;
}

/**
 * What changed since the last scan of this repository.
 *
 * This is the answer to "did my fix work?", so the framing is the delta rather
 * than the absolute score — which is already directly above it.
 */
export function ScanDiff({ diff }: { diff: ScanDiffPayload }) {
  // A delta is only progress if both scans ran the same scanners. When one
  // crashed, the number moved because coverage moved — so it is rendered
  // neutral and captioned, never green.
  const improved = diff.comparable && diff.scoreDelta > 0;
  const worse = diff.comparable && diff.scoreDelta < 0;

  const tone = !diff.comparable
    ? 'border-high'
    : improved
      ? 'border-pass'
      : worse
        ? 'border-block'
        : 'border-line-strong';
  const deltaColor = improved
    ? 'text-pass'
    : worse
      ? 'text-block'
      : 'text-fg-muted';

  return (
    <section
      aria-labelledby='diff-heading'
      className={`brut border-2 ${tone} p-6 sm:p-8`}
    >
      <div className='flex flex-wrap items-center gap-3'>
        <h2
          id='diff-heading'
          className='font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-fg-muted'
        >
          Since the last scan
        </h2>
        {diff.sameCommit ? <span className='chip-ghost'>same commit</span> : null}
        {!diff.comparable ? (
          <span className='chip bg-high'>coverage changed</span>
        ) : null}
      </div>

      {!diff.comparable ? (
        <p className='mt-4 border-l-2 border-high pl-3 text-sm leading-relaxed text-fg'>
          <strong className='font-semibold'>
            These two scans are not comparable.
          </strong>{' '}
          {diff.coverageGap.join(', ')} ran on one scan and not the other, so
          the score moved because coverage moved — not because the code did.
          Findings from {diff.coverageGap.length === 1 ? 'that scanner' : 'those scanners'}{' '}
          are listed as unknown rather than fixed.
        </p>
      ) : null}

      <div className='mt-5 flex flex-wrap items-end gap-x-8 gap-y-5'>
        <div>
          <div
            className={`display-heading text-4xl tabular-nums ${deltaColor}`}
          >
            {diff.scoreDelta > 0 ? '+' : ''}
            {diff.scoreDelta}
          </div>
          <div className='mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-muted'>
            {diff.previousScore} → {diff.currentScore}
          </div>
        </div>

        {diff.verdictChanged ? (
          <div className='flex items-center gap-2'>
            <span className={`chip ${VERDICT_CHIP[diff.previousVerdict]}`}>
              {diff.previousVerdict}
            </span>
            <span aria-hidden className='font-mono text-fg-muted'>
              →
            </span>
            <span className={`chip ${VERDICT_CHIP[diff.currentVerdict]}`}>
              {diff.currentVerdict}
            </span>
          </div>
        ) : null}

        <dl className='flex flex-wrap gap-x-7 gap-y-2 font-mono text-xs'>
          <Stat label='fixed' value={diff.fixed.length} tone='text-pass' />
          <Stat label='new' value={diff.introduced.length} tone='text-block' />
          <Stat label='moved' value={diff.moved.length} tone='text-fg-muted' />
          <Stat
            label='unchanged'
            value={diff.unchanged.length}
            tone='text-fg-muted'
          />
          {diff.unknown.length > 0 ? (
            <Stat
              label='unknown'
              value={diff.unknown.length}
              tone='text-high'
            />
          ) : null}
        </dl>
      </div>

      {diff.sameCommit ? (
        <p className='mt-5 text-sm leading-relaxed text-fg-muted'>
          Both scans read the same commit and produced the same result. That is
          the expected outcome — scoring is deterministic, so an unchanged
          repository cannot produce a different number.
        </p>
      ) : null}

      {diff.fixed.length > 0 ? (
        <DiffList
          title='Fixed'
          tone='text-pass'
          findings={diff.fixed}
          note='Reported in the previous scan, gone from this one.'
        />
      ) : null}

      {diff.introduced.length > 0 ? (
        <DiffList
          title='New'
          tone='text-block'
          findings={diff.introduced}
          note='Not present in the previous scan.'
        />
      ) : null}

      {diff.unknown.length > 0 ? (
        <DiffList
          title='Unknown'
          tone='text-high'
          findings={diff.unknown}
          note='The scanner that reports these did not run on one of the two scans. Nothing can be concluded about them either way.'
        />
      ) : null}

      {diff.moved.length > 0 ? (
        <p className='mt-5 text-xs leading-relaxed text-fg-muted'>
          {diff.moved.length} finding{diff.moved.length === 1 ? '' : 's'} moved
          to a different line because the surrounding code changed. Moves are
          counted separately from fixes so that shifting a file does not read as
          progress.
        </p>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className='flex items-baseline gap-1.5'>
      <dt className='sr-only'>{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${tone}`}>
        {value}
      </dd>
      <span aria-hidden className='uppercase tracking-wider text-fg-muted'>
        {label}
      </span>
    </div>
  );
}

function DiffList({
  title,
  tone,
  findings,
  note,
}: {
  title: string;
  tone: string;
  findings: NormalizedFinding[];
  note: string;
}) {
  return (
    <div className='mt-6 border-t-2 border-line pt-5'>
      <h3
        className={`font-display text-[11px] font-extrabold uppercase tracking-[0.14em] ${tone}`}
      >
        {title}
      </h3>
      <p className='mt-1 text-xs text-fg-muted'>{note}</p>
      <ul className='mt-3 grid gap-2'>
        {findings.map((finding, index) => {
          const location = locationOf(finding);
          return (
            <li
              key={finding.fingerprint || `${finding.title}-${index}`}
              className='flex flex-wrap items-center gap-x-3 gap-y-1'
            >
              <span className={`chip ${SEVERITY_CHIP[finding.severity]}`}>
                {finding.severity}
              </span>
              <span className='text-sm text-fg'>{finding.title}</span>
              {location ? (
                <span className='break-all font-mono text-xs text-fg-muted'>
                  {location}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
