# 🛡️ VibeGuard

**An AI security & quality gate for AI-generated apps.**
Paste a public GitHub repo URL → get a **Ship Readiness Score** (0–100) with ranked, explained,
fixable security findings.

Built for The Zerops Challenge (48-hour solo hackathon).

---

## The problem

People are shipping apps they did not write. AI coding tools happily produce a working app that
also hardcodes an API key, concatenates user input into SQL, and pulls a dependency with a known
CVE. It runs, so it looks finished. It is not safe to put on the internet.

## What VibeGuard does

Submit a repo URL. An async pipeline shallow-clones it into a size-capped sandbox (it never
executes the cloned code), runs three real scanners plus an LLM explanation pass, and returns a
single number you can act on, backed by findings that each name a file, a line, the risk, and the
fix.

| Scanner | Finds |
|---|---|
| **gitleaks** | Hardcoded secrets and committed credentials |
| **semgrep** (`p/owasp-top-ten`, `p/secrets`) | Injection, authz gaps, crypto misuse |
| **osv-scanner** | Dependency CVEs from lockfiles |
| **LLM pass** | Plain-English explanation + a concrete recommended fix per finding |

## Architecture

Six services on Zerops sharing one private network. Only `web` and `api` are public.

| Service | Stack | Exposure |
|---|---|---|
| `web` | Next.js (App Router), SSR | public |
| `api` | Fastify — REST + SSE | public |
| `worker` | Node + gitleaks / semgrep / osv-scanner + LLM | **private** |
| `db` | Zerops PostgreSQL | private |
| `valkey` | Zerops Valkey — BullMQ queue + progress pub/sub | private |
| `storage` | Zerops Object Storage (S3) — raw reports | private |

Decisions and their rationale live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repo layout

```
packages/core     shared types, Ship Readiness Score, scanner adapter contract
apps/api          Fastify REST + SSE
apps/worker       BullMQ consumer + scanner adapters
apps/web          Next.js frontend
zerops.yaml       build/deploy/run for all three code services
```

## Local development

```bash
npm install
npm run build
npm test
```

Runtime configuration is entirely environment-driven — see [`.env.example`](.env.example).
No secrets are ever committed; every value comes from a Zerops service variable.

## Status

Phase 1 — wired skeleton deployed, health checks green.
