export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type FindingSource = "gitleaks" | "semgrep" | "osv" | "llm";

export type FindingCategory =
  | "secret" | "injection" | "authz" | "crypto"
  | "dependency" | "prompt_injection" | "smell" | "other";

export interface NormalizedFinding {
  source: FindingSource;
  category: FindingCategory;
  severity: Severity;
  title: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
  explanation?: string;       // filled by the LLM pass
  recommendedFix?: string;    // filled by the LLM pass
  fingerprint: string;        // stable id for dedup/diff
}

export type ScanStatus =
  | "queued" | "cloning" | "scanning" | "analyzing" | "done" | "failed";

export type Verdict = "pass" | "review" | "block";

export interface ScanSummary {
  critical: number; high: number; medium: number; low: number; info: number;
}
