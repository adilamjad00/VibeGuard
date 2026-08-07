# VibeGuard — Architecture & Decision Log

> Written as we build, so every decision has a defensible *why*. Newest phase at the bottom.

## What VibeGuard is

Submit a public GitHub repo URL. An async pipeline shallow-clones it, runs real security scanners
(gitleaks, semgrep, osv-scanner) plus an LLM explanation pass, and returns a **Ship Readiness
Score** (0–100) with ranked, explained, fixable findings and live progress.

The target user is someone who vibe-coded an app with an AI and has no idea whether it is safe to
put on the internet. The output is deliberately *actionable*: not "you have 47 issues" but "this
line leaks your OpenAI key, here is the fix."

## Service topology (Zerops, one private network)

```
                    ┌───────────────────────────────────────────┐
   browser ──────►  │  web    Next.js App Router      [public]   │
                    │  api    Fastify REST + SSE      [public]   │
                    │  worker Node + scanner CLIs     [private]  │
                    │    │                                       │
                    │    ├── db       PostgreSQL      [private]  │
                    │    ├── valkey   Valkey          [private]  │
                    │    └── storage  Object Storage  [private]  │
                    └───────────────────────────────────────────┘
```

Only `web` and `api` are publicly reachable. `worker`, `db`, `valkey` and `storage` have no public
surface at all — they are reachable only over the project's private network by hostname
(`db:5432`, `valkey:6379`, …). That is the whole point of running this on a multi-service platform
rather than a single container.

### Why split api and worker at all?

Scanning is slow (clone + three scanners + an LLM pass = tens of seconds) and bursty. If the HTTP
request did the work, one scan would block a request thread and any timeout would lose the result.
Splitting means:

- `api` stays fast and always answers — the live URL never appears broken to a judge.
- `worker` can be scaled **horizontally** and independently (Phase 5), which is the natural fit for
  a queue-backed workload.
- The worker executes untrusted third-party code paths (it clones arbitrary public repos), so it
  lives with **no public ingress**. Blast radius is contained by topology, not by hope.

### Why Valkey carries both the queue and the progress channel

BullMQ needs a Redis-compatible store; the SSE progress feed needs pub/sub. Valkey does both, so
one managed service covers two needs instead of adding a second dependency. Queue jobs are durable
(BullMQ persists them); progress events are fire-and-forget pub/sub, which is correct — a dropped
progress tick must never corrupt a scan.

---

## Phase 1 — deploy an empty-but-wired skeleton first

**The governing decision: deploy before building.** The dominant risk in a 48-hour build on an
unfamiliar platform is not "can I write the scanner logic" — it is "can I get six services talking
to each other on someone else's cloud." So Phase 1 ships zero product logic and instead proves the
plumbing: `/healthz` green against real Postgres + Valkey + S3, and the worker attached to the
queue. Every later phase is additive on a known-good deploy.

### Corrections made to the original starter-kit plan

These were found by checking the Zerops documentation against the plan before writing any code.

**1. The worker's `Dockerfile` cannot be used; `run.prepareCommands` replaces it.**
Zerops' `zerops.yaml` has no Dockerfile build path for runtime services — you pick a base image.
The native equivalent is the **runtime-prepare phase**: `run.os` + `run.base` +
`run.prepareCommands` build a custom runtime image, which Zerops then **caches**, keyed on those
fields plus `build.addToRunPrepare`. Redeploys skip the whole reinstall. Keeping `nodejs@22` as
`run.base` (rather than bare Ubuntu) also keeps Node a first-class managed runtime instead of
something we hand-install and have to maintain.
`apps/worker/Dockerfile` is retained in-tree as a record of intent and as an escape hatch if we
ever move the worker to a `docker@26.1` service — its install logic was ported, not discarded.

**2. `os: ubuntu` for the worker, not Alpine.**
Zerops build containers default to Alpine. Semgrep ships a compiled `semgrep-core` linked against
glibc, which does not run on musl. gitleaks and osv-scanner are static Go binaries and are
indifferent. Ubuntu is the only choice that makes all three work.

**3. Semgrep installs into a venv, not via bare `pip install`.**
Ubuntu 24.04 enforces PEP 668 (`externally-managed-environment`), so `pip install semgrep` fails
outright. A venv at `/opt/semgrep` plus a symlink into `/usr/local/bin` is cleaner than
`--break-system-packages` and does not fight the OS package manager.

**4. Scanner versions bumped to current releases.**
gitleaks `8.21.2` → **`8.30.1`**. osv-scanner `1.9.1` → **`2.5.0`**; note v2 renamed the release
asset to `osv-scanner_linux_amd64` with no version in the filename, so the old URL pattern 404s.

**5. `ubuntu@24` is not a valid base tag** (the real one is `ubuntu@24.04`). Moot after decision
#1, but it would have failed the first deploy.

**6. The web build does not depend on `${api_zeropsSubdomain}`.**
That variable exists, but its exact cross-service name and whether its value carries the `https://`
scheme could not be confirmed from the docs. A build that silently bakes in an empty or malformed
API URL is a bad failure mode — it looks deployed and is broken. `NEXT_PUBLIC_API_URL` is instead
set explicitly on the `web` service once `api`'s subdomain is live. One manual step, zero mystery.

### Other Phase 1 decisions

**Migrations run from the API at boot, not from a shell.**
`schema.sql` is fully `create … if not exists`-guarded, so it is idempotent and safe to execute on
every start. This removes a `zcli vpn` + local `psql` dependency from the critical path — there is
no `psql` on the dev machine. Trade-off: with multiple `api` replicas this races, but idempotent
DDL makes the race benign. If we ever need real migration ordering, this gets replaced by a
one-shot job.

**`/healthz` returns 503, not 200, when a dependency is down.**
Each of the three checks (`SELECT 1`, Valkey `PING`, S3 `HeadBucket`) is independently try/caught
and reported as `ok` or `error: <message>`. A health endpoint that always returns 200 is
decoration; this one is machine-checkable and tells you *which* dependency broke.

**The worker logs the version of all three scanner binaries at boot.**
The runtime-prepare phase is the riskiest part of the whole deploy. Probing `--version` on each
binary at startup turns "did the image build correctly?" into one line in the service log, instead
of a mystery discovered later during a demo. Probe failures are logged and never fatal — a missing
osv-scanner must not stop the worker from running the other two.

**`deployFiles` must include `packages/core/package.json`.**
With npm workspaces, `node_modules/@vibeguard/core` is a *symlink* into `packages/core`. Deploying
only `packages/core/dist` leaves that symlink dangling at runtime, and the service crashes on its
first `import`. Both paths ship together.
