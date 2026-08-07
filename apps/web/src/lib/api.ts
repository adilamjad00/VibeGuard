/** Server-side only: the api service over the project's private network. */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://api:3001";

export interface HealthReport {
  status: "ok" | "degraded";
  db: string;
  valkey: string;
  s3: string;
  uptimeSeconds: number;
}

export type HealthProbe =
  | { reachable: true; report: HealthReport }
  | { reachable: false; error: string };

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
