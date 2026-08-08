/** Server-side only: the api service over the project's private network. */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://api:3001";

export interface HealthReport {
  status: "ok" | "degraded";
  db: string;
  valkey: string;
  s3: string;
  uptimeSeconds: number;
  activeStreams?: number;
}

export type HealthProbe =
  | { reachable: true; report: HealthReport }
  | { reachable: false; error: string };

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  source: string;
  category: string;
  severity: Severity;
  title: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
  explanation?: string;
  recommendedFix?: string;
  fingerprint: string;
}

export interface Scan {
  id: string;
  repoUrl: string;
  commitSha: string | null;
  status: "queued" | "cloning" | "scanning" | "analyzing" | "done" | "failed";
  score: number | null;
  verdict: "pass" | "review" | "block" | null;
  summary: (Record<Severity, number> & { failedScanners?: string[] }) | null;
  createdAt: string;
  completedAt: string | null;
  findings: Finding[];
}

/** Returns null for 404 so the page can render "not found" rather than crash. */
export async function fetchScan(id: string): Promise<Scan | null> {
  const res = await fetch(`${API_INTERNAL_URL}/scans/${id}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`api returned ${res.status}`);
  return (await res.json()) as Scan;
}

/** Never throws — an unreachable API is a state the page renders, not a crash. */
export async function fetchHealth(): Promise<HealthProbe> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    // /healthz answers 503 when degraded, and that body is exactly what we want
    // to show, so a non-2xx is still a successful probe.
    return { reachable: true, report: (await res.json()) as HealthReport };
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : String(err) };
  }
}
