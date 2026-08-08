import type { FindingSource, Severity, Verdict } from "@vibeguard/core";

/**
 * Presentation-only lookups.
 *
 * Every class name here is written as a complete literal string because
 * Tailwind resolves utilities by scanning source text — a composed name like
 * `bg-${severity}` would compile to nothing.
 */

export const SEVERITY_CHIP: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
  info: "bg-info",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
  info: "text-info",
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-critical",
  high: "border-l-high",
  medium: "border-l-medium",
  low: "border-l-low",
  info: "border-l-info",
};

export const VERDICT_TEXT: Record<Verdict, string> = {
  pass: "text-pass",
  review: "text-review",
  block: "text-block",
};

export const VERDICT_CHIP: Record<Verdict, string> = {
  pass: "bg-pass",
  review: "bg-review",
  block: "bg-block",
};

export const VERDICT_STROKE: Record<Verdict, string> = {
  pass: "var(--color-pass)",
  review: "var(--color-review)",
  block: "var(--color-block)",
};

/**
 * The sentence under the score. It states what the verdict means for shipping,
 * and every one of them says the same underlying thing: this is evidence from
 * the checks that ran, not a certificate.
 */
export const VERDICT_COPY: Record<Verdict, { headline: string; body: string }> = {
  pass: {
    headline: "Clear to ship",
    body: "No blocking issues from the checks that ran. That is not a proof of safety — it means these specific checks came back clean.",
  },
  review: {
    headline: "Review before shipping",
    body: "Real issues were found that are not immediately exploitable. Read them before this goes anywhere public.",
  },
  block: {
    headline: "Do not ship",
    body: "At least one finding is severe enough to be exploited as-is. Fix the criticals first, then re-scan.",
  },
};

/** What each scanner is and what it looks for, in the product's own words. */
export const SOURCE_META: Record<FindingSource, { label: string; role: string; accent: string }> = {
  gitleaks: {
    label: "gitleaks",
    role: "Committed secrets — API keys, tokens and credentials in the tree and its history.",
    accent: "bg-brand",
  },
  semgrep: {
    label: "semgrep",
    role: "Static analysis — injection sinks, unsafe eval, weak crypto and auth mistakes in the source.",
    accent: "bg-cyan",
  },
  osv: {
    label: "osv-scanner",
    role: "Dependencies — known CVEs and advisories against the lockfile's exact versions.",
    accent: "bg-lime",
  },
  llm: {
    label: "claude",
    role: "Explanation only — turns each finding into why it matters and how to fix it. Never invents findings.",
    accent: "bg-violet",
  },
};

/** The order the scanner cards are shown in: the pipeline's own order. */
export const SOURCE_ORDER: readonly FindingSource[] = ["gitleaks", "semgrep", "osv", "llm"] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  secret: "secret",
  injection: "injection",
  authz: "access control",
  crypto: "crypto",
  dependency: "dependency",
  prompt_injection: "prompt injection",
  smell: "code smell",
  other: "other",
};
