# 🛡️ VibeGuard — Starter Kit
### AI Security & Quality Gate for Vibe-Coded Apps · The Zerops Challenge
*Everything you need to hit the ground running the moment the clock starts.*

> **How to use this kit (5 minutes):**
> 1. Create the empty repo + files below (or paste the **Claude Code prompt** in §7 and let it scaffold).
> 2. In Zerops, create the 3 managed services (§2) — **dashboard "Add Service" is foolproof**.
> 3. Connect the repo, add the 3 code services with the `zerops.yaml` in §3.
> 4. Push the **seed vulnerable repo** (§6) to its *own* public GitHub repo — that's your demo target.
> 5. Open ZCP + Claude Code, paste the §7 prompt, and build in the order it enforces.
>
> **The golden rule:** get an **empty-but-wired deploy live first** (all health checks green), *then* add scan logic. Never let your first successful deploy be Sunday night.
>
> ⚖️ **Rule reminders:** the event has started, so writing code now is fine. Make **meaningful, incremental commits** (proof of in-window work), **understand every decision** (keep `docs/ARCHITECTURE.md`), and **disclose AI tools** in the submission form.

---

## 1. Repo structure (monorepo)

```
vibeguard/
├── zerops.yaml                     # §3 — web + api + worker build/deploy/run
├── zerops-project-import.yml       # §2 — optional service provisioning
├── package.json                    # §4 — npm workspaces root
├── tsconfig.base.json              # §4
├── .env.example                    # §5 — env var contract
├── .gitignore
├── README.md                       # from PDD §20 (fill during build)
├── docs/
│   └── ARCHITECTURE.md             # your decisions, for judges (Rule 14)
├── packages/
│   └── core/                       # shared, framework-free
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── types.ts            # §4.3 — NormalizedFinding, Severity, etc.
│           ├── score.ts            # §4.4 — Ship Readiness Score (pure, done)
│           └── adapter.ts          # §4.5 — ScannerAdapter contract (done)
├── apps/
│   ├── api/                        # Fastify (Node/TS)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # bootstrap + routes + health
│   │       ├── db.ts               # pg/drizzle client
│   │       ├── schema.sql          # §4.6 — DB schema (done)
│   │       ├── queue.ts            # §4.7 — BullMQ producer + Valkey
│   │       ├── pubsub.ts           # Valkey pub/sub for progress
│   │       └── routes/
│   │           ├── scans.ts        # POST /scans, GET /scans/:id
│   │           └── stream.ts       # GET /scans/:id/stream (SSE)
│   ├── worker/                     # Node/TS + security CLIs
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile              # §3.3 — reliable CLI install (done)
│   │   └── src/
│   │       ├── index.ts            # BullMQ consumer
│   │       ├── pipeline.ts         # clone→scan→normalize→llm→score→persist→publish
│   │       ├── clone.ts            # shallow clone, size-capped
│   │       ├── llm.ts              # LLM explain + fix (skeleton)
│   │       └── adapters/
│   │           ├── gitleaks.ts     # §4.8 — FULL example, copy for the others
│   │           ├── semgrep.ts      # follow gitleaks
│   │           └── osv.ts          # follow gitleaks
│   └── web/                        # Next.js (App Router) — Claude Code builds
│       └── src/app/...             # §4.9 — pages + components plan
└── seed-vulnerable-repo/           # §6 — push to its OWN GitHub repo (demo target)
    ├── package.json
    └── src/{config,db,server}.js
```

---

## 2. Provision Zerops managed services (do this first)

**Recommended (foolproof): Zerops dashboard → your project → “Add Service”.** Add three, and **note each service's `hostname`** exactly (you'll reference them as `${hostname_var}`):

| Service | Type | Hostname | Mode |
|---|---|---|---|
| Postgres | PostgreSQL | `db` | Non-HA (single node — fine for the event) |
| Valkey (Redis) | Valkey | `valkey` | Non-HA |
| Object storage | Object Storage (S3) | `storage` | — |

> After creating each, open its **Access details / Environment variables** panel and **copy the exact generated variable names** — they're what §3/§5 reference. Names commonly look like `db_connectionString`, `db_hostname`, `db_port`, `db_user`, `db_password`, `db_dbName` · `valkey_hostname`, `valkey_port`, `valkey_password` · `storage_apiUrl`, `storage_accessKeyId`, `storage_secretAccessKey`, `storage_bucketName`. **Verify verbatim — this is the #1 thing people get wrong.**

**Optional convenience: `zerops-project-import.yml`** (verify version tags in the UI — they update):

```yaml
# Import via: Zerops dashboard → Import project/services.
# CONFIRM exact type tags + versions in "Add Service" (they change over time).
project:
  name: vibeguard
services:
  - hostname: db
    type: postgresql@16      # ← confirm current tag
    mode: NON_HA
  - hostname: valkey
    type: valkey@7.2         # ← confirm current tag
    mode: NON_HA
  - hostname: storage
    type: object-storage     # ← confirm exact type string
    objectStorageSize: 2
```

---

## 3. `zerops.yaml` (all three code services)

> Structure is verified against Zerops' own example (`zerops: - setup: … build: … run: …`). **`nodejs@22` is confirmed.** The **worker base image + CLI install** is the one part likely to need iteration — the Dockerfile in §3.3 is the reliable path; let ZCP loop on it.

### 3.1 Root `zerops.yaml`
```yaml
zerops:
  # ─────────── API (private + public) ───────────
  - setup: api
    build:
      base: nodejs@22
      buildCommands:
        - npm ci
        - npm run build -w @vibeguard/core
        - npm run build -w @vibeguard/api
      deployFiles:
        - apps/api/dist
        - apps/api/package.json
        - packages/core/dist
        - node_modules
    run:
      base: nodejs@22
      ports:
        - port: 3001
          httpSupport: true
      envVariables:
        NODE_ENV: production
        PORT: "3001"
        # Cross-service refs — pattern is ${<hostname>_<var>}; CONFIRM exact var names (§2)
        DATABASE_URL: ${db_connectionString}
        VALKEY_HOST: ${valkey_hostname}
        VALKEY_PORT: ${valkey_port}
        VALKEY_PASSWORD: ${valkey_password}
        S3_ENDPOINT: ${storage_apiUrl}
        S3_ACCESS_KEY: ${storage_accessKeyId}
        S3_SECRET_KEY: ${storage_secretAccessKey}
        S3_BUCKET: ${storage_bucketName}
      start: node apps/api/dist/index.js

  # ─────────── WEB (public) ───────────
  - setup: web
    build:
      base: nodejs@22
      buildCommands:
        - npm ci
        - npm run build -w @vibeguard/web
      deployFiles:
        - apps/web/.next
        - apps/web/public
        - apps/web/next.config.js
        - apps/web/package.json
        - node_modules
    run:
      base: nodejs@22
      ports:
        - port: 3000
          httpSupport: true
      envVariables:
        NODE_ENV: production
        PORT: "3000"
        # Browser calls the API's PUBLIC url — set after enabling public access on `api`
        NEXT_PUBLIC_API_URL: ${api_zeropsSubdomain}   # ← confirm the api public-URL var
      start: npm run start -w @vibeguard/web

  # ─────────── WORKER (private, no ports) ───────────
  - setup: worker
    build:
      # Option A (reliable): build from the Dockerfile in §3.3 (recommended for the CLIs).
      # Option B (native): base: ubuntu@24 + install tools in buildCommands (confirm the tag).
      base: ubuntu@24        # ← confirm tag, or switch this setup to a Docker build
      buildCommands:
        - apt-get update && apt-get install -y git curl python3 python3-pip nodejs npm
        - pip3 install --break-system-packages semgrep
        # gitleaks + osv-scanner: install current release binaries (see Dockerfile for URLs)
        - npm ci
        - npm run build -w @vibeguard/core
        - npm run build -w @vibeguard/worker
      deployFiles:
        - apps/worker/dist
        - apps/worker/package.json
        - packages/core/dist
        - node_modules
    run:
      base: ubuntu@24
      envVariables:
        DATABASE_URL: ${db_connectionString}
        VALKEY_HOST: ${valkey_hostname}
        VALKEY_PORT: ${valkey_port}
        VALKEY_PASSWORD: ${valkey_password}
        S3_ENDPOINT: ${storage_apiUrl}
        S3_ACCESS_KEY: ${storage_accessKeyId}
        S3_SECRET_KEY: ${storage_secretAccessKey}
        S3_BUCKET: ${storage_bucketName}
        LLM_API_KEY: ${LLM_API_KEY}        # set this yourself in the worker service env
      start: node apps/worker/dist/index.js
```

> **Public access:** enable it on **`web`** and **`api`** (the browser needs both). Keep `db`, `valkey`, `storage`, `worker` **private** — that private backend traffic is exactly the "how Zerops is used" story. Set `NEXT_PUBLIC_API_URL` to the API's public URL once it's assigned.
>
> **`LLM_API_KEY`:** add your Anthropic/OpenAI key as a **secret env var** on the `worker` service (and `api` if it calls the LLM). Never commit it.

### 3.2 Worker — the fiddly bit (let ZCP iterate)
The three scanners: **semgrep** (pip — reliable, and covers secrets *and* injection via `p/owasp-top-ten` + `p/secrets`, so it alone makes the demo work), **gitleaks** (release binary), **osv-scanner** (release binary). If a binary URL is stale, semgrep-only still finds real issues — so the demo never fully breaks.

### 3.3 `apps/worker/Dockerfile` (recommended reliable path)
```dockerfile
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# semgrep (reliable, version-agnostic)
RUN pip3 install --no-cache-dir --break-system-packages semgrep

# gitleaks — confirm the current version/URL at github.com/gitleaks/gitleaks/releases
ARG GITLEAKS_VERSION=8.21.2
RUN curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    | tar -xz -C /usr/local/bin gitleaks

# osv-scanner — confirm the current version/URL at github.com/google/osv-scanner/releases
ARG OSV_VERSION=1.9.1
RUN curl -sSfL -o /usr/local/bin/osv-scanner \
      "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_${OSV_VERSION}_linux_amd64" \
    && chmod +x /usr/local/bin/osv-scanner

WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @vibeguard/core && npm run build -w @vibeguard/worker
CMD ["node", "apps/worker/dist/index.js"]
```
*(Pin the two `ARG` versions to the current releases — Claude Code can check and bump them. Semgrep working alone is enough to demo, so don't let a stale binary block you.)*

---

## 4. Backbone files (concrete — copy these in)

### 4.1 Root `package.json`
```json
{
  "name": "vibeguard",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "npm run build -w @vibeguard/core && npm run build -w @vibeguard/api && npm run build -w @vibeguard/worker && npm run build -w @vibeguard/web"
  }
}
```

### 4.2 `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### 4.3 `packages/core/src/types.ts`
```ts
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
```

### 4.4 `packages/core/src/score.ts` (Ship Readiness Score — done, pure)
```ts
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
```

### 4.5 `packages/core/src/adapter.ts` (scanner contract — done)
```ts
import type { NormalizedFinding } from "./types.js";

export interface ScanContext {
  repoPath: string;   // local path to the cloned working tree
  scanId: string;
}

/** Every scanner implements this. Add a new tool = add a new adapter. */
export interface ScannerAdapter {
  name: string;
  run(ctx: ScanContext): Promise<NormalizedFinding[]>;
}
```
`packages/core/src/index.ts`: `export * from "./types.js"; export * from "./score.js"; export * from "./adapter.js";`

### 4.6 `apps/api/src/schema.sql` (DB schema — done)
```sql
create extension if not exists "uuid-ossp";

create table if not exists scans (
  id uuid primary key default uuid_generate_v4(),
  repo_url text not null,
  commit_sha text,
  status text not null default 'queued',
  score int,
  verdict text,
  summary jsonb,
  report_object_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists findings (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  source text not null,
  category text not null,
  severity text not null,
  title text not null,
  file_path text,
  line_start int,
  line_end int,
  snippet text,
  explanation text,
  recommended_fix text,
  fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists scan_events (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  phase text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_findings_scan on findings(scan_id);
create index if not exists idx_findings_sev on findings(severity);
create index if not exists idx_scans_repo on scans(repo_url, commit_sha);
```

### 4.7 `apps/api/src/queue.ts` (BullMQ on Valkey — done skeleton)
```ts
import { Queue } from "bullmq";

const connection = {
  host: process.env.VALKEY_HOST!,
  port: Number(process.env.VALKEY_PORT ?? 6379),
  password: process.env.VALKEY_PASSWORD || undefined,
};

export const scanQueue = new Queue("scans", { connection });

export async function enqueueScan(scanId: string, repoUrl: string) {
  await scanQueue.add(
    "scan",
    { scanId, repoUrl },
    { attempts: 2, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 50 }
  );
}
// The worker (apps/worker) creates a `new Worker("scans", processor, { connection })`.
// Progress: worker publishes to Valkey channel `scan:{id}`; api/src/stream.ts subscribes & relays via SSE.
```

### 4.8 `apps/worker/src/adapters/gitleaks.ts` (FULL example — copy pattern for semgrep + osv)
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ScannerAdapter, ScanContext, NormalizedFinding } from "@vibeguard/core";

const run = promisify(execFile);

export const gitleaksAdapter: ScannerAdapter = {
  name: "gitleaks",
  async run(ctx: ScanContext): Promise<NormalizedFinding[]> {
    const report = join(tmpdir(), `gitleaks-${randomUUID()}.json`);
    try {
      // scans the working tree (no git history). Flags vary by version — confirm with `gitleaks --help`.
      await run("gitleaks", [
        "detect", "--source", ctx.repoPath, "--no-git",
        "--report-format", "json", "--report-path", report, "--exit-code", "0",
      ]);
    } catch {
      /* gitleaks exits non-zero when it finds leaks; report file is still written */
    }
    let raw: any[] = [];
    try { raw = JSON.parse(await readFile(report, "utf8")); } catch { raw = []; }
    return raw.map((r): NormalizedFinding => ({
      source: "gitleaks",
      category: "secret",
      severity: "critical",
      title: `Hardcoded secret: ${r.RuleID ?? r.Description ?? "secret"}`,
      filePath: r.File,
      lineStart: r.StartLine,
      lineEnd: r.EndLine,
      snippet: r.Match ? String(r.Match).slice(0, 200) : undefined,
      fingerprint: `gitleaks:${r.File}:${r.StartLine}:${r.RuleID}`,
    }));
  },
};
```
> **semgrep** → `semgrep scan --config p/owasp-top-ten --config p/secrets --json --output <report> <repoPath>`; map `results[]` → `{check_id→title, path, start.line, extra.severity→severity, extra.message}`.
> **osv** → `osv-scanner --format json -r <repoPath>` (confirm flags with `--help`); map `results[].packages[].vulnerabilities[]` → `category:"dependency"`, severity from CVSS if present.

### 4.9 Frontend plan (Claude Code builds — Next.js App Router)
- `/` → `RepoInput` (URL field + Scan button).
- `/scan/[id]` → server component fetches the report; a client component opens `EventSource('/api/.../stream')` for live phases; renders `ScoreGauge`, `SeverityBreakdown`, `FindingCard[]`.
- Tailwind + **shadcn/ui**, **dark mode default**. Framer Motion for the gauge fill + findings fading in.
- States to build: empty, live (progress), success, partial (a scanner failed), error.

---

## 5. `.env.example` (env contract)
```bash
# API + Worker
DATABASE_URL=            # from Zerops `db` service
VALKEY_HOST=
VALKEY_PORT=6379
VALKEY_PASSWORD=
S3_ENDPOINT=             # from Zerops `storage` service
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
# Worker (+ API if it calls the LLM)
LLM_API_KEY=            # your Anthropic/OpenAI key — set as a Zerops SECRET, never commit
# Web
NEXT_PUBLIC_API_URL=    # API service PUBLIC url
```

---

## 6. Seed vulnerable demo repo (your demo target — push to its OWN public GitHub repo)

> This guarantees your live demo finds **real** issues (semgrep/gitleaks catch these). Put it in a **separate** repo (e.g. `vibeguard-demo-app`), *not* the VibeGuard repo. Tune your score weights so this lands ~40 pre-fix, ~85 after you remove the two criticals on stage.

`seed-vulnerable-repo/package.json` (planted vulnerable dependency):
```json
{
  "name": "totally-legit-ai-app",
  "version": "1.0.0",
  "dependencies": {
    "express": "4.18.2",
    "lodash": "4.17.11"
  }
}
```
*(`lodash@4.17.11` has known CVEs → osv-scanner flags it. Confirm/adjust to a currently-flagged version.)*

`seed-vulnerable-repo/src/config.js` (planted hardcoded secret → gitleaks):
```js
// AI-generated "config" with a committed key
module.exports = {
  openaiApiKey: "sk-proj-1a2b3c4dExampleFAKEkeyDoNotUse00998877665544",
  jwtSecret: "supersecret123",
};
```

`seed-vulnerable-repo/src/db.js` (planted SQL injection → semgrep):
```js
const db = require("./fake-db");
// User input concatenated straight into SQL — classic AI happy-path bug
function getUser(username) {
  const query = "SELECT * FROM users WHERE name = '" + username + "'";
  return db.query(query);
}
module.exports = { getUser };
```

`seed-vulnerable-repo/src/server.js` (planted command injection + missing authz → semgrep/LLM):
```js
const express = require("express");
const { exec } = require("child_process");
const app = express();

// No auth check; user-controlled input into a shell command
app.get("/ping", (req, res) => {
  exec("ping -c 1 " + req.query.host, (err, out) => res.send(out));
});

// "Admin" route with no authorization at all
app.get("/admin/users", (req, res) => res.json({ users: ["all", "the", "data"] }));

app.listen(3000);
```

---

## 7. 🚀 Claude Code first prompt (paste into ZCP)

> Paste this into your Claude Code agent inside ZCP after the repo is created and the 3 managed services exist. It enforces the winning build order (deploy-first, then features) and the rules (you own the decisions).

```
You are helping me build "VibeGuard" for a 48-hour solo hackathon (The Zerops Challenge).
It is an AI security & quality gate for AI-generated apps: submit a public GitHub repo URL,
an async pipeline runs real security scanners + an LLM review, and returns a "Ship Readiness
Score" (0-100) with ranked, explained, fixable findings and live progress.

ARCHITECTURE (multi-service on Zerops, one private network):
- web: Next.js (App Router) SSR frontend  [public]
- api: Node/TS Fastify REST + SSE          [public]
- worker: Node/TS + gitleaks, semgrep, osv-scanner + an LLM pass  [private]
- db: Zerops PostgreSQL   valkey: Zerops Valkey (BullMQ queue + pub/sub + cache)   storage: Zerops S3 object storage
Monorepo with npm workspaces: packages/core (shared types, score fn, adapter interface),
apps/api, apps/worker, apps/web.

I have already written these files — use them as the source of truth, do not rewrite their logic:
- packages/core/src/{types.ts, score.ts, adapter.ts}   (Ship Readiness Score + NormalizedFinding + ScannerAdapter)
- apps/api/src/{schema.sql, queue.ts}
- apps/worker/src/adapters/gitleaks.ts   (the pattern for the other adapters)
- zerops.yaml (three setups) and apps/worker/Dockerfile

BUILD IN THIS EXACT ORDER. Deploy and verify each phase on Zerops before moving on:

PHASE 1 — Deploy an empty-but-wired skeleton FIRST.
  Scaffold all services with a trivial handler each (web renders a page, api has GET /healthz
  returning {status, db, valkey, s3} after checking each connection, worker connects to the queue
  and logs "ready"). Wire env vars from the Zerops services (confirm the EXACT generated variable
  names from each service's access-details panel; the reference pattern is ${hostname_var}).
  Run the schema.sql migration against Postgres. DEPLOY. Do not proceed until /healthz is green
  on the live api URL and the worker logs "ready".

PHASE 2 — Thin end-to-end scan with ONE real finding.
  POST /scans {repoUrl} -> insert scan, enqueue via BullMQ. Worker: shallow-clone into a temp,
  size-capped dir (never execute cloned code), run the gitleaks adapter, write findings to Postgres,
  compute the score via packages/core, mark the scan done. A basic /scan/[id] page shows the score
  and findings. DEPLOY and verify against my demo repo (I'll give you a URL) — it must find a real secret.

PHASE 3 — Add semgrep + osv adapters (copy the gitleaks pattern) and the LLM pass.
  semgrep: p/owasp-top-ten + p/secrets, JSON output. osv: dependency CVEs from lockfiles.
  LLM (env LLM_API_KEY): for each finding, produce {explanation, recommendedFix} as strict JSON;
  only send the flagged snippet + a small window, never whole files; validate/repair the JSON; if the
  LLM fails, keep the static finding with no explanation (never blank the report). Store the raw report
  JSON in S3 object storage. DEPLOY.

PHASE 4 — Live progress. Worker publishes phase events to Valkey channel scan:{id}; api exposes
  GET /scans/:id/stream as SSE that subscribes and relays; the frontend opens an EventSource and
  shows "Cloning -> Scanning -> Analyzing" live. DEPLOY.

PHASE 5 — Polish. shadcn/ui + Tailwind, dark mode, a ScoreGauge (Framer Motion fill), FindingCards
  (file, line, severity, explanation, fix, copy button), empty/error/partial states, no dead buttons.
  Configure horizontal autoscaling on the worker. DEPLOY.

CONSTRAINTS:
- Keep the app deployable and the live URL working after every phase (judges must reach it).
- The worker's CLI install (semgrep via pip, gitleaks/osv release binaries) is the riskiest bit:
  confirm the correct Zerops base image and install method by inspecting the environment and iterating
  on the deploy using the logs until the three binaries run. Semgrep alone must work at minimum.
- Explain each significant decision briefly and record it in docs/ARCHITECTURE.md as we go (I must be
  able to defend the architecture to judges).
- Make small, meaningful commits after each working step.
- Never hardcode secrets; only use Zerops env vars.

Start with PHASE 1 now. Before writing code, list the exact Zerops env-var names you'll reference for
db, valkey, and storage, and confirm the base image tags in zerops.yaml against this environment.
```

---

## 8. First-hour checklist

- [ ] Repo created + these backbone files committed (first commit = timestamped, in-window).
- [ ] Zerops project + `db`, `valkey`, `storage` services created; exact env-var names copied.
- [ ] `LLM_API_KEY` added as a secret on `worker` (and `api` if needed).
- [ ] Seed vulnerable repo pushed to its own public GitHub repo (your demo target).
- [ ] ZCP + Claude Code connected; §7 prompt pasted; **Phase 1 deployed and `/healthz` green**.
- [ ] Public access enabled on `web` + `api`; `NEXT_PUBLIC_API_URL` set.

> If you're green on `/healthz` on a live Zerops URL within the first ~90 minutes, you've already beaten most of the field — the deployment risk is dead and everything after is additive.

*— VibeGuard starter kit · build in order, deploy early, keep it live.*
