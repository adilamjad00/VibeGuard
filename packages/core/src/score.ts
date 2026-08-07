import type { NormalizedFinding, ScanSummary, Verdict } from "./types.js";

const WEIGHTS = { critical: 25, high: 10, medium: 4, low: 1, info: 0 } as const;

export function summarize(findings: NormalizedFinding[]): ScanSummary {
  const s: ScanSummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) s[f.severity]++;
  return s;
}

/** 100 minus weighted severity, clamped to [0,100]. Deterministic. */
export function shipReadinessScore(findings: NormalizedFinding[]): number {
  const s = summarize(findings);
  const penalty =
    s.critical * WEIGHTS.critical + s.high * WEIGHTS.high +
    s.medium * WEIGHTS.medium + s.low * WEIGHTS.low;
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function verdictFor(score: number): Verdict {
  if (score >= 80) return "pass";
  if (score >= 50) return "review";
  return "block";
}
