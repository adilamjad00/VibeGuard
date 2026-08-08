import type { FindingSource, NormalizedFinding, Severity } from "./types.js";

/**
 * Worst first. This is the same order the API's SQL uses to sort findings, and
 * the same order the scorer's weights descend in — keeping it in one place
 * means a new severity cannot be added to one of the three and forgotten in the
 * other two.
 */
export const SEVERITY_ORDER: readonly Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
] as const;

/** Lower rank = more severe. Unknown severities sort last rather than first. */
export function severityRank(severity: string): number {
  const index = SEVERITY_ORDER.indexOf(severity as Severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

/**
 * Criticals first, then a stable secondary order by location so two runs of the
 * same scan render findings in the same sequence. Sorting a copy, because
 * callers pass arrays straight out of the API response.
 */
export function sortBySeverity(findings: NormalizedFinding[]): NormalizedFinding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;

    const byFile = (a.filePath ?? "￿").localeCompare(b.filePath ?? "￿");
    if (byFile !== 0) return byFile;

    return (a.lineStart ?? 0) - (b.lineStart ?? 0);
  });
}

/** Every severity is present, including the zeroes — the UI renders all five. */
export function countBySeverity(findings: NormalizedFinding[]): Record<Severity, number> {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) {
    if (finding.severity in counts) counts[finding.severity] += 1;
  }
  return counts;
}

/**
 * How many findings each scanner contributed. Only sources that actually
 * produced something appear, so a scanner with no findings is distinguishable
 * from one that never ran (that comes from `summary.failedScanners`).
 */
export function countBySource(findings: NormalizedFinding[]): Partial<Record<FindingSource, number>> {
  const counts: Partial<Record<FindingSource, number>> = {};
  for (const finding of findings) {
    counts[finding.source] = (counts[finding.source] ?? 0) + 1;
  }
  return counts;
}

/** `src/db.js:42`, or just the path when the scanner gave no line. */
export function locationOf(finding: NormalizedFinding): string | null {
  if (!finding.filePath) return null;
  return finding.lineStart ? `${finding.filePath}:${finding.lineStart}` : finding.filePath;
}

/**
 * What the finding card's copy button puts on the clipboard: enough context to
 * paste into an editor's AI chat or an issue tracker and act on immediately.
 * Sections the scan does not have are omitted rather than left as empty
 * headings.
 */
export function fixClipboardText(finding: NormalizedFinding): string {
  const lines = [`[${finding.severity.toUpperCase()}] ${finding.title}`];

  const location = locationOf(finding);
  if (location) lines.push(`Location: ${location}`);
  lines.push(`Detected by: ${finding.source}`);

  if (finding.snippet) lines.push("", "Code:", finding.snippet.trim());
  if (finding.explanation) lines.push("", "Why it matters:", finding.explanation.trim());
  if (finding.recommendedFix) lines.push("", "Recommended fix:", finding.recommendedFix.trim());

  return lines.join("\n");
}
