# ✅ VibeGuard — Build Tracker (0 → 100%)
### The Zerops Challenge · Solo · 48h · Check off as you go

```
Progress: [███░░░░░░░░░░░░░░░░░]  15%   ·   Phase 1 complete → Phase 2 next
```

> **You are here:** Phase 1 done (skeleton deployed, `/healthz` green, worker "ready"). **Next: Phase 2 — make the pipeline actually scan.**
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
| **2** | Thin end-to-end scan (1 real finding) | 15→35% | 35% | ⬜ Next |
| **3** | All scanners + LLM + score + S3 | 35→60% | 60% | ⬜ |
| **4** | Live progress (SSE) | 60→72% | 72% | ⬜ |
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

## ⬜ Phase 2 — Thin end-to-end scan `(15 → 35%)` 🎯 NEXT
**Goal:** submit a repo URL → the pipeline runs gitleaks → a real finding + score appear on a live page.
**Est: ~4h.**

**API**
- [ ] `POST /scans` — validate `repoUrl` (zod), insert `scans` row (`status='queued'`), enqueue BullMQ job, return `{scanId}`
- [ ] `GET /scans/:id` — return scan + its findings from Postgres
- [ ] IP rate-limit on `POST /scans` (Valkey token bucket) — quick, prevents abuse in demo

**Worker**
- [ ] Consume the `scans` queue job
- [ ] `clone.ts` — shallow `git clone --depth 1` into a temp dir, **size cap + timeout**, update status `cloning`
- [ ] Run the **gitleaks adapter** (already written) → `NormalizedFinding[]`
- [ ] Persist findings to the `findings` table
- [ ] Compute score via `packages/core` (`shipReadinessScore` + `verdictFor` + `summarize`) → update `scans` (`score`, `verdict`, `summary`, `status='done'`, `completed_at`)
- [ ] Delete the cloned dir (never keep untrusted code around)
- [ ] Wrap each step in try/catch → on failure set `status='failed'` with a reason (never hang)

**Web**
- [ ] `/` page — `RepoInput` posts to `POST /scans`, redirects to `/scan/[id]`
- [ ] `/scan/[id]` page — fetch report, render score number + verdict + a plain list of findings (styling comes in Phase 5)

**Verify & commit**
- [ ] Scan your seed repo → **it finds the hardcoded key**, shows a score, marks done
- [ ] Deploy; confirm the live URL still works
- [ ] Commit: "feat: end-to-end scan with gitleaks + score"

**Done when:** pasting the seed repo URL on the live site returns a real finding + score.

---

## ⬜ Phase 3 — All scanners + LLM + S3 `(35 → 60%)`
**Goal:** three real scanners run in parallel, the LLM explains each finding with a fix, and the raw report lands in object storage.
**Est: ~4h. This is the "depth" that separates you from the pack.**

**Scanners (copy the gitleaks pattern)**
- [ ] `semgrep` adapter — `semgrep scan --config p/owasp-top-ten --config p/secrets --json` → map `results[]` → findings (this alone catches SQLi *and* secrets — your safety net)
- [ ] `osv` adapter — dependency CVEs from lockfiles → `category:"dependency"`
- [ ] Run all three adapters in **parallel** (`Promise.all`), merge, **dedup by `fingerprint`**

**LLM pass (`llm.ts`)**
- [ ] For each finding (cap to top N by severity for cost), send **only the snippet + a small window** → strict JSON `{explanation, recommendedFix}`
- [ ] Validate/repair the JSON; on failure keep the static finding **with no explanation** (never blank the report)
- [ ] Attach `explanation` + `recommendedFix` to findings before persisting

**Object storage**
- [ ] Write the full raw report JSON to S3 (`storage`), save `report_object_key` on the scan
- [ ] (Optional) `GET /scans/:id/report` → presigned S3 URL

**Verify & commit**
- [ ] Score now reflects multiple severities; explanations + fixes show on findings
- [ ] **Tune score weights** so the seed repo lands ~40 pre-fix (sets up the before/after)
- [ ] Report JSON confirmed in object storage
- [ ] Deploy; confirm live; commit: "feat: semgrep + osv + LLM explanations + S3 reports"

**Done when:** a scan shows findings from ≥2 sources, each with a readable explanation + fix, and the report is in S3.

---

## ⬜ Phase 4 — Live progress (SSE) `(60 → 72%)`
**Goal:** watch the scan advance live — the watchable demo beat.
**Est: ~3h.**

- [ ] Worker publishes phase events to Valkey channel `scan:{id}` at each step (`cloning` → `scanning:gitleaks` → `scanning:semgrep` → `analyzing` → `done`) + optionally write `scan_events` rows
- [ ] `GET /scans/:id/stream` — SSE endpoint: subscribe to `scan:{id}`, relay events, clean up on client disconnect
- [ ] Frontend opens an `EventSource` on `/scan/[id]`, shows a live phase list / progress bar
- [ ] Handle the edge case: if the scan already finished before the client connects, fetch current status first, then stream
- [ ] Handle reconnection gracefully
- [ ] Deploy; confirm live; commit: "feat: live scan progress via Valkey pub/sub + SSE"

**Done when:** starting a scan shows phases updating in real time, ending on the full report.

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
