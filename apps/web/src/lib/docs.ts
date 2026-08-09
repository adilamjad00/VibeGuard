/**
 * The documentation map: sections, their order, and the anchors inside each.
 *
 * Single source of truth for the sidebar, the "on this page" list, prev/next,
 * the docs index and the footer. Deliberately free of imports so it stays
 * trivially testable and can never drag a React dependency into a plain
 * Node test run.
 */

export interface DocAnchor {
  /** Must match the `id` on the corresponding heading in the page. */
  id: string;
  title: string;
}

export interface DocSection {
  slug: string;
  title: string;
  /** One line, shown on the docs index and in link previews. */
  summary: string;
  anchors: readonly DocAnchor[];
}

export const DOC_SECTIONS: readonly DocSection[] = [
  {
    slug: "introduction",
    title: "Introduction",
    summary: "What VibeGuard is, the problem it addresses, and what it deliberately does not claim.",
    anchors: [
      { id: "what-is-vibeguard", title: "What is VibeGuard?" },
      { id: "why-vibeguard", title: "Why VibeGuard?" },
      { id: "who-its-for", title: "Who it is for" },
      { id: "what-it-does-not-claim", title: "What it does not claim" },
    ],
  },
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Run your first scan and learn how to read the report that comes back.",
    anchors: [
      { id: "quick-start", title: "Quick start" },
      { id: "first-scan", title: "Running your first scan" },
      { id: "what-you-can-scan", title: "What you can scan" },
      { id: "reading-the-result", title: "Reading the result" },
    ],
  },
  {
    slug: "how-it-works",
    title: "How it works",
    summary: "The full path from a submitted URL to a finished report, service by service.",
    anchors: [
      { id: "scan-workflow", title: "Scan workflow" },
      { id: "security-pipeline", title: "Security pipeline" },
      { id: "scanner-architecture", title: "Scanner architecture" },
      { id: "scoring-system", title: "Scoring system" },
      { id: "ai-analysis", title: "AI analysis" },
      { id: "report-generation", title: "Report generation" },
      { id: "live-progress", title: "Live progress" },
    ],
  },
  {
    slug: "results",
    title: "Results",
    summary: "How to read the score, the verdict, the severity ramp, and a partial scan.",
    anchors: [
      { id: "understanding-your-score", title: "Understanding your score" },
      { id: "verdicts", title: "Verdicts" },
      { id: "understanding-findings", title: "Understanding findings" },
      { id: "severity-levels", title: "Severity levels" },
      { id: "partial-scans", title: "Partial scans" },
    ],
  },
  {
    slug: "security",
    title: "Security",
    summary: "How VibeGuard handles the code you give it, and the protections around that.",
    anchors: [
      { id: "repository-handling", title: "Repository handling" },
      { id: "ssrf-protection", title: "SSRF protection" },
      { id: "secrets-redaction", title: "Secrets redaction" },
      { id: "data-and-report-storage", title: "Data and report storage" },
      { id: "prompt-injection", title: "Prompt injection" },
    ],
  },
  {
    slug: "reference",
    title: "Reference",
    summary: "Scanner details, current limits, and the questions that come up most.",
    anchors: [
      { id: "supported-scanners", title: "Supported scanners" },
      { id: "limits", title: "Limits" },
      { id: "faq", title: "FAQ" },
    ],
  },
] as const;

export function findSection(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((section) => section.slug === slug);
}

/**
 * Previous and next section for the pager at the bottom of each page. Both
 * ends are `null` rather than wrapping — a docs pager that loops from the last
 * page back to the first hides the fact that you have reached the end.
 */
export function siblings(slug: string): { prev: DocSection | null; next: DocSection | null } {
  const index = DOC_SECTIONS.findIndex((section) => section.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? DOC_SECTIONS[index - 1]! : null,
    next: index < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[index + 1]! : null,
  };
}

export function docPath(slug: string, anchorId?: string): string {
  return anchorId ? `/docs/${slug}#${anchorId}` : `/docs/${slug}`;
}
