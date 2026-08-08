import type { NormalizedFinding, ScanSummary, Verdict } from "./types.js";

const WEIGHTS = { critical: 25, high: 10, medium: 4, low: 1, info: 0 } as const;

/**
 * Each repeat of an already-seen rule costs a quarter of the first hit, and a
 * single rule can never cost more than twice its base weight.
 *
 * Without this the score saturates. Four secrets in one config file is 4x25 =
 * 100 penalty, so the repo scores 0 — and so does a repo with forty. Once every
 * bad repo reads 0 the number stops carrying information and a fix can no
 * longer move it, which is the opposite of what a readiness score is for.
 *
 * The judgement encoded here is that four keys committed in one file is one
 * mistake ("this config was never meant to be in git"), not four independent
 * ones. Severity weights are deliberately untouched: nothing below downgrades
 * how bad a critical is, it only stops the same critical being charged twice.
 */
const REPEAT_FACTOR = 0.25;
const MAX_RULE_MULTIPLIER = 2;

export function summarize(findings: NormalizedFinding[]): ScanSummary {
  const s: ScanSummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) s[f.severity]++;
  return s;
}

/**
 * Identity of the *rule*, not of the finding. Two hits from the same detector
 * with the same title are the same rule firing twice; the file path is not part
 * of it, so a secret repeated across three files still damps.
 */
function ruleKey(f: NormalizedFinding): string {
  return `${f.source}|${f.category}|${f.severity}|${f.title}`;
}

/** 100 minus damped weighted severity, clamped to [0,100]. Deterministic. */
export function shipReadinessScore(findings: NormalizedFinding[]): number {
  const counts = new Map<string, number>();
  for (const f of findings) {
    const key = ruleKey(f);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let penalty = 0;
  for (const [key, count] of counts) {
    const severity = key.split("|")[2] as keyof typeof WEIGHTS;
    const weight = WEIGHTS[severity] ?? 0;
    const multiplier = Math.min(1 + REPEAT_FACTOR * (count - 1), MAX_RULE_MULTIPLIER);
    penalty += weight * multiplier;
  }

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function verdictFor(score: number): Verdict {
  if (score >= 80) return "pass";
  if (score >= 50) return "review";
  return "block";
}
