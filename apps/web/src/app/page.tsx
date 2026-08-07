import { fetchHealth, type HealthProbe } from "@/lib/api";

// The health panel must reflect the API right now; a cached "healthy" badge
// would be worse than no badge.
export const dynamic = "force-dynamic";

function Check({ name, value }: { name: string; value: string }) {
  const ok = value === "ok";
  return (
    <div className="check">
      <span className={`dot ${ok ? "ok" : "bad"}`} />
      <span className="name">{name}</span>
      <span className={`value ${ok ? "ok" : "bad"}`}>{value}</span>
    </div>
  );
}

function HealthPanel({ probe }: { probe: HealthProbe }) {
  if (!probe.reachable) {
    return (
      <div className="panel">
        <h2>Backend status</h2>
        <div className="check">
          <span className="dot bad" />
          <span className="name">api</span>
          <span className="value bad">unreachable — {probe.error}</span>
        </div>
        <p className="hint">
          The frontend is up but cannot reach the api service over the private network.
        </p>
      </div>
    );
  }

  const { report } = probe;
  return (
    <div className="panel">
      <h2>Backend status</h2>
      <div className="checks">
        <Check name="api" value="ok" />
        <Check name="postgres" value={report.db} />
        <Check name="valkey" value={report.valkey} />
        <Check name="storage" value={report.s3} />
      </div>
      <p className="hint">
        {report.status === "ok"
          ? "All services healthy — checked live over the Zerops private network."
          : "One or more dependencies are degraded."}
      </p>
    </div>
  );
}

export default async function Home() {
  const probe = await fetchHealth();

  return (
    <main>
      <h1 className="brand">🛡️ VibeGuard</h1>
      <p className="tagline">
        An AI security &amp; quality gate for AI-generated apps. Paste a public GitHub repo and
        get a Ship Readiness Score with ranked, explained, fixable findings.
      </p>

      <div className="panel">
        <h2>Scan a repository</h2>
        <div className="field">
          <input
            type="url"
            placeholder="https://github.com/user/repo"
            disabled
            aria-label="Repository URL"
          />
          <button disabled>Scan</button>
        </div>
        <p className="hint">
          Scanning goes live in the next deploy. This build proves the infrastructure:
          six services, one private network, health-checked end to end.
        </p>
      </div>

      <HealthPanel probe={probe} />

      <footer>Phase 1 — wired skeleton. Built on Zerops.</footer>
    </main>
  );
}
