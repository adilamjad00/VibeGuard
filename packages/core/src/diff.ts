import type { NormalizedFinding, Verdict } from "./types.js";

/**
 * Comparing two scans of the same repository.
 *
 * The point of this is to answer "did my fix work?", so the bar is that a
 * finding must only be reported as *fixed* when it genuinely stopped being
 * reported — not when it merely moved.
 */

export interface ScanDiff {
  /** Present in the previous scan, gone from this one. */
  fixed: NormalizedFinding[];
  /** New in this scan. */
  introduced: NormalizedFinding[];
  /** Same problem, different line — the code around it shifted. */
  moved: NormalizedFinding[];
  /** Identical fingerprint in both scans. */
  unchanged: NormalizedFinding[];
  /**
   * Findings from a scanner that failed on one side of the comparison. Nothing
   * can be concluded about them — see `comparable`.
   */
  unknown: NormalizedFinding[];
  /**
   * False when the two scans did not run the same set of scanners. The score
   * delta is then not a measure of the code changing, and must not be
   * presented as progress.
   */
  comparable: boolean;
  /** Scanners that ran on one side and failed on the other. */
  coverageGap: string[];
  previousScore: number;
  currentScore: number;
  /** Positive means the repository improved. */
  scoreDelta: number;
  previousVerdict: Verdict;
  currentVerdict: Verdict;
  verdictChanged: boolean;
  /** Both scans read the same commit, so any difference would be a bug. */
  sameCommit: boolean;
}

/**
 * Advisory findings are excluded from every side of the diff.
 *
 * They come from a language model, so they are not reproducible run to run.
 * Including them would mean every re-scan reported a handful of phantom fixes
 * and phantom regressions, which would make the real numbers untrustworthy.
 */
function isScannerFinding(finding: NormalizedFinding): boolean {
  return finding.source !== "llm";
}

/**
 * Identity of the underlying problem, deliberately without the line number.
 *
 * The scanners build fingerprints that embed the line — `gitleaks:file:12:rule`,
 * `semgrep:path:7:check-id` — which is right for de-duplication and wrong for
 * diffing: deleting an import at the top of a file shifts every finding below
 * it, and a fingerprint-only diff would report all of them as fixed and then
 * immediately re-introduced. On a security tool that reads as progress when
 * nothing was fixed.
 */
function ruleIdentity(finding: NormalizedFinding): string {
  return `${finding.source}|${finding.category}|${finding.filePath ?? ""}|${finding.title}`;
}

/** Falls back the same way `dedupe()` does when a scanner omits a fingerprint. */
function keyOf(finding: NormalizedFinding): string {
  return (
    finding.fingerprint ||
    `${finding.source}:${finding.filePath ?? ""}:${finding.lineStart ?? ""}:${finding.title}`
  );
}

/**
 * Two passes, mirroring the two-pass de-duplication in the worker: exact
 * fingerprint first, then rule identity for whatever is left over.
 *
 * `previousFailed` / `currentFailed` are the scanners that did not run on each
 * side. They matter more than they look: if semgrep crashed on the second scan,
 * every semgrep finding from the first would otherwise be reported as *fixed*
 * and the score would appear to improve — a broken scanner reading as progress,
 * which is the exact failure mode the rest of the product is built to avoid.
 * Those findings go to `unknown` instead, and the diff is marked incomparable.
 */
export function diffFindings(
  previous: NormalizedFinding[],
  current: NormalizedFinding[],
  previousFailed: readonly string[] = [],
  currentFailed: readonly string[] = [],
): Pick<ScanDiff, "fixed" | "introduced" | "moved" | "unchanged" | "unknown"> {
  const prevFailed = new Set(previousFailed);
  const currFailed = new Set(currentFailed);

  const unknown: NormalizedFinding[] = [];

  // A previous finding whose scanner failed this time cannot be called fixed;
  // a current finding whose scanner failed last time cannot be called new.
  const before = previous.filter((f) => {
    if (!isScannerFinding(f)) return false;
    if (currFailed.has(f.source)) {
      unknown.push(f);
      return false;
    }
    return true;
  });
  const after = current.filter((f) => {
    if (!isScannerFinding(f)) return false;
    if (prevFailed.has(f.source)) {
      unknown.push(f);
      return false;
    }
    return true;
  });

  const beforeByKey = new Map(before.map((f) => [keyOf(f), f]));
  const afterByKey = new Map(after.map((f) => [keyOf(f), f]));

  const unchanged: NormalizedFinding[] = [];
  const beforeRemaining: NormalizedFinding[] = [];
  const afterRemaining: NormalizedFinding[] = [];

  for (const finding of after) {
    if (beforeByKey.has(keyOf(finding))) unchanged.push(finding);
    else afterRemaining.push(finding);
  }
  for (const finding of before) {
    if (!afterByKey.has(keyOf(finding))) beforeRemaining.push(finding);
  }

  // Pass two: same rule, same file, different line. Matched pairwise so that
  // two instances of one rule in a file cannot both match a single survivor.
  const movedTargets = new Map<string, NormalizedFinding[]>();
  for (const finding of afterRemaining) {
    const identity = ruleIdentity(finding);
    const bucket = movedTargets.get(identity);
    if (bucket) bucket.push(finding);
    else movedTargets.set(identity, [finding]);
  }

  const moved: NormalizedFinding[] = [];
  const fixed: NormalizedFinding[] = [];

  for (const finding of beforeRemaining) {
    const bucket = movedTargets.get(ruleIdentity(finding));
    const match = bucket?.shift();
    if (match) moved.push(match);
    else fixed.push(finding);
  }

  const claimed = new Set(moved.map(keyOf));
  const introduced = afterRemaining.filter((f) => !claimed.has(keyOf(f)));

  return { fixed, introduced, moved, unchanged, unknown };
}

/** Scanners that succeeded on one side and failed on the other. */
export function coverageGap(
  previousFailed: readonly string[],
  currentFailed: readonly string[],
): string[] {
  const symmetric = new Set<string>();
  for (const name of previousFailed) if (!currentFailed.includes(name)) symmetric.add(name);
  for (const name of currentFailed) if (!previousFailed.includes(name)) symmetric.add(name);
  return [...symmetric].sort();
}

export interface ScanSide {
  score: number;
  verdict: Verdict;
  commitSha: string | null;
  findings: NormalizedFinding[];
  /** Scanner names that did not run, from the scan's stored summary. */
  failedScanners: readonly string[];
}

export function diffScans(previous: ScanSide, current: ScanSide): ScanDiff {
  const gap = coverageGap(previous.failedScanners, current.failedScanners);
  return {
    ...diffFindings(
      previous.findings,
      current.findings,
      previous.failedScanners,
      current.failedScanners,
    ),
    comparable: gap.length === 0,
    coverageGap: gap,
    previousScore: previous.score,
    currentScore: current.score,
    scoreDelta: current.score - previous.score,
    previousVerdict: previous.verdict,
    currentVerdict: current.verdict,
    verdictChanged: previous.verdict !== current.verdict,
    // Two nulls are not a match: an unknown commit twice tells us nothing.
    sameCommit:
      previous.commitSha !== null &&
      current.commitSha !== null &&
      previous.commitSha === current.commitSha,
  };
}
