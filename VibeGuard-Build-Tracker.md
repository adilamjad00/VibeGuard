# ✅ VibeGuard — Build Tracker (0 → 100%)
### The Zerops Challenge · Solo · 48h · Check off as you go

```
Progress: [██████████████░░░░░░]  72%   ·   Phases 1–4 complete → Phase 5 next
```

> **You are here:** Phases 1–4 complete and verified against the live deployment. **Next: Phase 5 — polish, states, autoscaling.**
>
> **How to use this tracker**
> - Tick each box as you finish it. Each phase's boxes ≈ that phase's % band.
> - **Deploy at the end of every phase and confirm the live URL still works** before moving on (Rule 3 = auto-DQ if it's down at judging).
> - **Commit after each working step** (proof of in-window work — Rules 7 & 15).
> - If you fall behind, **cut from the 🎁 Bonus track first — never from the 🚫 Never-Cut list.**
> - `100% = polished + demoed + posted + SUBMITTED`, not just "code works."

---

## 📊 Progress map

| Phase | Goal | Band | Cumulative | Status |
|---|---|---|---|---|
| **0** | Setup & services | 0→5% | **5%** | ✅ Done |
| **1** | Empty-but-wired deploy | 5→15% | **15%** | ✅ Done |
| **2** | Thin end-to-end scan (1 real finding) | 15→35% | 35% | ✅ Done |
| **3** | All scanners + LLM + score + S3 | 35→60% | **60%** | ✅ Done |
| **4** | Live progress (Valkey pub/sub → WebSocket) | 60→72% | **72%** | ✅ Done |
| **5** | Polish + UX + autoscaling | 72→86% | 86% | ⬜ |
| **6** | Demo + README + post + **SUBMIT** | 86→100% | 100% | ⬜ |
| 🎁 | Bonus (re-scan diff, etc.) | beyond | +bonus | ⬜ |

**Pacing (you're at 15%):**
- **End of Saturday →** Phases 2 + 3 done (~60%): scan → real findings → score → LLM explanations, deployed.
- **Sunday AM →** Phase 4 (~72%).
- **Sunday midday →** Phase 5 (~86%), then **FREEZE FEATURES**.
- **Sunday afternoon (last ~3h) →** Phase 6 to 100%. **Never let this get squeezed.**

---

## ✅ Phase 0 — Setup & services `(0 → 5%)` — DONE

- [x] Repo created, backbone files committed (first in-window commit)
- [x] Zerops project + `db` (Postgres), `valkey`, `storage` (S3) services created
- [x] Exact generated env-var names copied from each service
- [x] `LLM_API_KEY` added as a secret on `worker`
- [x] Seed vulnerable repo pushed to its own public GitHub repo (demo target)
- [x] ZCP + Claude Code connected

## ✅ Phase 1 — Empty-but-wired deploy `(5 → 15%)` — DONE

- [x] `web`, `api`, `worker` services scaffolded with trivial handlers
- [x] `api` `GET /healthz` checks db + valkey + s3 → all green on the live URL
- [x] Worker connects to the BullMQ queue and logs "ready"
- [x] `schema.sql` migration run against Postgres
- [x] Public access enabled on `web` + `api`; `NEXT_PUBLIC_API_URL` set
- [x] Deployed & reachable ✅  ← **deployment risk eliminated**

---

## ✅ Phase 2 — Thin end-to-end scan `(15 → 35%)` — DONE

**API**
- [x] `POST /scans` — validate `repoUrl`, insert `scans` row, enqueue BullMQ job, return `{scanId}`
- [x] `GET /scans/:id` — return scan + its findings from Postgres
- [x] IP rate-limit on `POST /scans` — **Valkey-backed** (was in-memory, i.e. per-replica; fixed during audit)

**Worker**
- [x] Consume the `scans` queue job
- [x] `clone.ts` — shallow `--depth 1` into a temp dir, size cap + timeout, status `cloning`
- [x] gitleaks adapter → `NormalizedFinding[]`
- [x] Persist findings to the `findings` table
- [x] Score via `packages/core` → update `scans`
- [x] Delete the cloned dir (`finally` block)
- [x] try/catch → `status='failed'` with a reason

**Web**
- [x] `/` page — `ScanForm` posts to `POST /scans`, redirects to `/scan/[id]`
- [x] `/scan/[id]` page — score, verdict, findings list

**Verification evidence (live)**
- Scan of the seed repo returns 4 real gitleaks findings at `src/config.js:19–22`, redacted, with
  repo-relative paths and temp-dir-free fingerprints.
- SSRF allowlist rejects `http://`, `file://`, `169.254.169.254`, internal `valkey`, embedded
  credentials and non-GitHub hosts (12 unit tests).
- `/healthz` 200 `{db, valkey, s3 all ok}`; web 200.

> **Caught here:** the first live scan returned **score 100 / pass** on a repo full of planted
> flaws — deprecated gitleaks invocation, a `catch {}` that hid it, and a fixture secret no scanner
> could match. See `docs/ARCHITECTURE.md` § Phase 2.

---

## ✅ Phase 3 — All scanners + LLM + S3 `(35 → 60%)` — DONE

**Scanners**
- [x] `semgrep` adapter — rulesets **vendored into the image**, not fetched per scan (registry rate-limited; and `p/owasp-top-ten` alone found nothing on the demo repo)
- [x] `osv` adapter — dependency CVEs, severity from CVSS group score
- [x] All three run in **parallel** — `Promise.allSettled`, deliberately not `Promise.all`, which would discard good results when one scanner fails
- [x] Dedup by fingerprint **and** by `(file, line, category)` across scanners

**LLM pass (`llm.ts`)**
- [x] Top N by severity, snippet + small window only, secrets masked before sending
- [x] **Structured outputs** (`messages.parse` + `zodOutputFormat`) replace the validate/repair loop
- [x] Failure keeps the static finding with no explanation; unset key is a supported state
- [x] Score computed **before** the LLM runs, so enrichment cannot move a verdict

**Object storage**
- [x] Normalised **redacted** report to S3 (never raw scanner stdout), `report_object_key` saved
- [x] `GET /scans/:id/report` → 5-minute presigned URL

**Verification evidence (live, scan `9635fa17`)**

```
STATUS done  SCORE 36  VERDICT block   failedScanners []
sources: {gitleaks: 4, osv: 1, semgrep: 1}      explained: 6/6

[critical] gitleaks src/config.js:19-22  Hardcoded secret: generic-api-key  (x4)
[high    ] semgrep  src/server.js:7      Detect child process
[high    ] osv      package-lock.json    node-fetch@2.6.6: GHSA-r683-j2x4-v87g
```

- All **three** scanners fire; stable across repeated runs after the vendored-rules fix.
- Every finding carries an explanation + concrete fix.
- Archived report fetched via presigned URL contains **none** of the 4 fixture credentials;
  unsigned access to the same object returns **403**.
- 44/44 unit tests green (13 core + 12 api + 19 worker); all four workspaces build.

**Score target met honestly — 36/block, no scoring change.** The earlier 0 came from an
`express@4.18.2` transitive cascade of 19 advisories that was never deliberately planted and
accounted for 63% of the penalty. Fixed in the **fixture**, not the scorer: `express@5.1.0` (clean —
`4.21.2` no longer is) plus `node-fetch@2.6.6` contributing exactly one HIGH advisory. Severity
weights were never touched. Removing the committed secrets takes the score to **80 / pass**, so the
before/after beat crosses the verdict boundary.

**Two corrections to earlier notes here.** semgrep's intermittent failure was **not** memory: it was
a `--max-memory 768` flag we had added while mis-diagnosing an OOM, which capped semgrep-core and
made it abort during rule validation. Raising the worker to 2 GB changed nothing — the tell that the
constraint was never RAM — and removing the flag fixed it. Separately, the Zerops API does **not**
reject the CLI token; we were reading `token` from `cli.data` when the field is `Token`, so an empty
string was being sent.

---

## ✅ Phase 4 — Live progress `(60 → 72%)` — DONE

- [x] Worker publishes phase events to Valkey `scan:{id}` (`cloning → scanning → scanning:<tool> → analyzing → done`) **and** writes `scan_events` rows
- [x] `GET /scans/:id/stream` — SSE: subscribe, relay, clean up on disconnect
- [x] `GET /scans/:id/ws` — **the transport the browser actually uses** (see below)
- [x] Frontend shows a live phase list, driven by the socket
- [x] Late joiner: a client connecting after the scan finished replays everything and closes immediately
- [x] Reconnection/degradation: polling fallback with a 4s stall detector

**Verification evidence (live, browser path: web origin → Next rewrite → api)**

```
+ 1.0s  [open] upgraded to websocket
+ 1.0s  cloning / scanning            (replayed)
+16.7s  scanning:gitleaks 4 · scanning:semgrep 1 · scanning:osv 1
+26.2s  done — score 36, verdict block
+26.4s  [close]
```

Frames spread across the scan, **not** one burst at the end. Also verified: `activeStreams` goes
1 → 0 (3 concurrent clients on one scan = 1 multiplexed subscription); the SSE endpoint still emits
the correct sequence; a non-UUID id is rejected before it reaches a channel name; `/healthz`,
`GET /scans/:id` and `/report` unchanged; 47/47 tests.

> **Why WebSocket and not SSE.** Zerops' shared L7 balancer runs `proxy_buffering on`, holding a
> whole SSE response until it ends (measured 40–66s — the entire scan). It **cannot** be disabled for
> a `*.zerops.app` subdomain: routing entries are `isEditable: false`, the per-location schema has no
> buffering key, the full OpenAPI spec has no buffering setting at any scope, and this `LIGHT` project
> on a shared IPv4 exposes no HTTP Balancer section. An upgraded WebSocket is a tunnel, not a buffered
> response, so it is unaffected. A custom domain was rejected as a fix: nothing documents that it
> changes this, so it would have been a purchase against an unverified assumption. SSE is kept —
> it is correct behind any non-buffering proxy, and `curl -N` on it is the clearest demo of the pipeline.

---

## ⬜ Phase 5 — Polish + UX + autoscaling `(72 → 86%)`
**Goal:** demo-grade. Intentional, no dead buttons, handles every state.
**Est: ~3–4h.**

**UI (shadcn/ui + Tailwind, dark mode default)**
- [ ] `ScoreGauge` — big score + verdict badge, color-coded (red/amber/green), Framer Motion fill
- [ ] `SeverityBreakdown` — counts by severity as chips
- [ ] `FindingCard` — expandable: title, severity color, `file:line`, snippet, explanation, fix, **copy-fix button**
- [ ] `RepoInput` — validation, loading state, an example-repo hint
- [ ] Sort findings by severity (criticals first)

**States (judges notice these)**
- [ ] Empty (no scan yet, with a prompt)
- [ ] Loading skeletons
- [ ] Live progress (from Phase 4)
- [ ] Success (full report)
- [ ] Partial (a scanner failed → banner, report still renders)
- [ ] Error (clear message + retry)

**Quality pass**
- [ ] Responsive at 1280px + mobile (you may demo on a shared screen)
- [ ] Accessibility: semantic HTML, keyboard nav, ARIA live region on progress, contrast-safe severity colors
- [ ] Remove all dead buttons + console errors
- [ ] **Configure horizontal autoscaling on the `worker` service** (Zerops UI) — enables the scaling demo beat
- [ ] Final seed-repo check: criticals guaranteed every run
- [ ] Deploy; full click-through walkthrough; commit: "polish: UI, states, a11y, autoscaling"

**Done when:** the whole happy path looks intentional and every state is handled. → **FREEZE FEATURES.**

---

## ⬜ Phase 6 — Ship: demo + README + post + SUBMIT `(86 → 100%)`
**Goal:** convert a working product into a submitted, prize-eligible entry. **Reserve the last ~3 hours for this — it decides the MacBook *and* the mouse.**
**Est: ~3h.**

**Demo video (90s — script in PDD §19)**
- [ ] Record a clean screen capture: hook → paste seed repo → live pipeline → score 42/BLOCK with 2 explained criticals → the "6 services on Zerops" beat → close
- [ ] No dead air, no "let me just fix this" — re-record until tight
- [ ] Keep the live product clickable so judges can try it themselves

**README (teaching-grade — Kunal rewards this)**
- [ ] 1-line pitch + **live URL at the top**
- [ ] 15–20s demo GIF
- [ ] Mermaid architecture diagram (the 6-service graph)
- [ ] **"How Zerops is used"** table (the 35% axis, spelled out)
- [ ] Quickstart + features (Core/Advanced)
- [ ] **AI tools disclosure** (Claude Code + any others)
- [ ] "What I learned building on Zerops" (the teaching beat)
- [ ] MIT license
- [ ] Screenshots: score, findings, live progress

**Docs & defense**
- [ ] Finalize `docs/ARCHITECTURE.md` (decisions — why queue+worker, why Postgres, why 6 services)
- [ ] Rehearse the judge Q&A (PDD §19) until reflexive — esp. "what do you actually detect" and "what's the Zerops-specific part"

**Social post (whole prize — MX Master 3)**
- [ ] Publish a build post: project name + what it does + **the demo video** + **live link** + **how Zerops is used** + tag **@WeMakeDevs** and **@zeropsio**
- [ ] (Ideally) you already posted ≥1 progress update earlier for "reach"

**SUBMIT (the non-negotiable)**
- [ ] File the submission form on the event page: **repo + live URL + demo + post link + AI tools disclosed**
- [ ] **Re-open the live URL after submitting** to confirm it's still up
- [ ] Keep the deployment warm through judging

**Done when:** the form is filed, the live URL is confirmed up, and the post is live. → **100%. 🏆**

---

## 🎁 Bonus track (beyond 100% — do only if ahead; high demo value first)

- [ ] **Re-scan diff (before/after)** — apply the 2 fixes → re-scan → score jumps 42→85. *The single strongest demo beat; fit it into Phase 5/6 if you can.*
- [ ] **AI-antipattern LLM review** — missing authz / prompt-injection surfaces beyond static rules
- [ ] PDF/Markdown report export (great to attach to the social post)
- [ ] Live autoscaling demo beat (show a worker replica spin up under load)
- [ ] Zip upload (non-GitHub code)
- [ ] Qdrant semantic finding-dedup
- [ ] Auth + saved scan history
- [ ] CI/webhook gate mode (`POST` on push → pass/fail)

---

## 🚫 Never-Cut list (if the clock is burning, protect these)

1. The async pipeline + **at least semgrep** running (real findings)
2. The **Ship Readiness Score**
3. A **live, reachable deployment** on Zerops
4. The **90s demo video**
5. The **submission form filed** before the deadline

*Everything else is negotiable. These five are the difference between "placed" and "didn't count."*

---

## 🧭 Definition of Done (global)
Deployed on Zerops · reachable live URL through judging · demo flow works end-to-end · README with architecture diagram + AI disclosure · build post published & tagged · submission form filed · every architectural decision explainable.

*— Tick the boxes. Deploy each phase. Keep it live. Reserve the last 3 hours for Phase 6.*
