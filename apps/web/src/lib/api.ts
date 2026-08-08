import type { NormalizedFinding, ScanStatus, Severity, Verdict } from "@vibeguard/core";

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

export type Finding = NormalizedFinding;

export interface Scan {
  id: string;
  repoUrl: string;
  commitSha: string | null;
  status: ScanStatus;
  score: number | null;
  verdict: Verdict | null;
  summary: (Record<Severity, number> & { failedScanners?: string[] }) | null;
  createdAt: string;
  completedAt: string | null;
  findings: Finding[];
}

export interface ScanListItem {
  id: string;
  repoUrl: string;
  status: ScanStatus;
  score: number | null;
  verdict: Verdict | null;
  createdAt: string;
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

/**
 * Recent scans for the landing page. Never throws: this is a secondary panel,
 * and it must not be able to take down the page that owns the primary action.
 */
export async function fetchRecentScans(): Promise<ScanListItem[]> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/scans`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { scans?: ScanListItem[] };
    return body.scans ?? [];
  } catch {
    return [];
  }
}
