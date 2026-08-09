# ✅ VibeGuard — Build Tracker (0 → 100%)

### The Zerops Challenge · Solo · 48h · Check off as you go

```
Progress: [███████████████████░]  95%   ·   Phase 6 build-side done → record, post, SUBMIT
```

> **You are here:** Phases 1–5, the bonus track and **the whole build-side of Phase 6** are complete
> and verified against the live deployment. **FEATURES FROZEN — no code changed in Phase 6.**
> The last 5% is three things only you can do: **record the video, publish the post, file the form.**
> Script, Q&A and post drafts are written for you in [`docs/DEMO.md`](docs/DEMO.md).
>
> **How to use this tracker**
>
> - Tick each box as you finish it. Each phase's boxes ≈ that phase's % band.
> - **Deploy at the end of every phase and confirm the live URL still works** before moving on (Rule 3 = auto-DQ if it's down at judging).
> - **Commit after each working step** (proof of in-window work — Rules 7 & 15).
> - If you fall behind, **cut from the 🎁 Bonus track first — never from the 🚫 Never-Cut list.**
> - `100% = polished + demoed + posted + SUBMITTED`, not just "code works."

---

## 📊 Progress map

| Phase | Goal                                       | Band    | Cumulative | Status  |
| ----- | ------------------------------------------ | ------- | ---------- | ------- |
| **0** | Setup & services                           | 0→5%    | **5%**     | ✅ Done |
| **1** | Empty-but-wired deploy                     | 5→15%   | **15%**    | ✅ Done |
| **2** | Thin end-to-end scan (1 real finding)      | 15→35%  | 35%        | ✅ Done |
| **3** | All scanners + LLM + score + S3            | 35→60%  | **60%**    | ✅ Done |
| **4** | Live progress (Valkey pub/sub → WebSocket) | 60→72%  | **72%**    | ✅ Done |
| **5** | Polish + UX + autoscaling                  | 72→86%  | **86%**    | ✅ Done |
| **6** | Demo + README + post + **SUBMIT**          | 86→100% | **95%**    | 🟡 Build-side done · video/post/form are yours |
| 🎁    | Bonus (re-scan diff, AI review, export)    | beyond  | +bonus     | ✅ 3 of 8 built, 5 declined with reasons |

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
- [x] Deployed & reachable ✅ ← **deployment risk eliminated**

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

## ✅ Phase 5 — Polish + UX + autoscaling `(72 → 86%)` — DONE

**UI (Tailwind v4, dark mode default)**

- [x] `ScoreGauge` — animated SVG arc + counting number, verdict-coloured, Framer Motion, `role="meter"`
- [x] `SeverityBreakdown` — counts by severity as chips + a proportional bar
- [x] `FindingCard` — native `<details>`: severity/source/category chips, `file:line`, snippet, explanation, fix, **copy-fix button**
- [x] `RepoInput` — inline validation, loading state, demo-repo hint
- [x] Findings sorted worst-first (criticals expanded by default)
- [x] `ScannerCoverage` — per-scanner result, with **failed ≠ 0 findings**

> **Deviation, on purpose: Tailwind v4 without shadcn/ui.** Nothing in this UI needs Radix — the
> only disclosure widget is the finding expander, and native `<details>`/`<summary>` is keyboard
> operable, announced as a disclosure, and findable by in-page search while collapsed. Stock shadcn
> would also have fought the neo-brutalist direction the whole way. Framer Motion is used as
> specified, for the gauge.

**States**

- [x] Empty (no scans yet → prompt back to the one action)
- [x] Loading skeletons (`loading.tsx` + an inline report skeleton under live progress)
- [x] Live progress (Phase 4's WebSocket, restyled as the pipeline rail)
- [x] Success (full report)
- [x] Partial (amber banner, "floor not a clean bill of health", report still renders)
- [x] Error (API unreachable → retry; scan failed; 404; `error.tsx` boundary)

**Quality pass**

- [x] Responsive — no horizontal scroll at 1280 / 768 / 390 / 360px, verified in a real browser
- [x] Accessibility — **axe-core: 0 WCAG 2.1 A/AA violations** on all four live pages
- [x] Zero console errors/warnings on every page (the 404 page's own document 404 excepted)
- [~] **Horizontal autoscaling for `worker`** — declared in `zerops-project-import.yml`
  (`minContainers: 1`, `maxContainers: 3`). **Still to apply on the live project via the GUI:**
  worker → _Automatic scaling configuration_ → containers min 1 / max 3. Not applied through the
  platform API on purpose: an earlier API write cleared the autoscaling config as a side effect
  of nulls in the payload.
- [x] Seed repo re-verified: score 36 / block / `failedScanners: []` / 6 findings, 6 explained
- [x] Deployed; full click-through driven through the real UI in a headless browser

**Evidence (live, `https://web-2adf-3000.prg1.zerops.app`)**

```
Browser-driven end-to-end (clicked the demo chip, then Scan repo):
  → /scan/67a2b875-…      transport indicator: LIVE · WEBSOCKET
  +0s   RUNNING SCANNERS
  +16s  EXPLAINING FINDINGS
  +26s  report rendered — 36 out of 100 — block
  console issues: 0

axe-core (wcag2a/aa, wcag21a/aa): home 0 · report 0 · partial 0 · failed 0
hscroll @1280 and @390: none on any state
tests: 58/58 (core 24 · api 15 · worker 19)
```

> **Bug caught by verification, not by reading.** The `brut` utility set the CSS `border`
> shorthand, which Tailwind emitted _after_ the generated colour utilities — silently overwriting
> every `border-critical` / `border-high` / `border-l-*` back to the default line colour. The
> severity stripe on finding cards and the red/amber tone on the failed and partial banners were
> all inert. `brut` now carries surface + shadow only and borders are written at the call site.
> Confirmed by computed style: critical card left border is `rgb(255,51,85)` at `6px`.

**Done when:** the whole happy path looks intentional and every state is handled. → **FEATURES FROZEN.**

---

## 🟡 Phase 6 — Ship: demo + README + post + SUBMIT `(86 → 100%)`

**Goal:** convert a working product into a submitted, prize-eligible entry. **Reserve the last ~3 hours for this — it decides the MacBook _and_ the mouse.**

**Everything that could be built is built. 10 of 19 boxes done; the other 9 need a human** — a
camera, a social account, and a form. **No code changed in this phase**, so nothing was redeployed
and nothing could regress.

**Demo video (90s — script now in [`docs/DEMO.md`](docs/DEMO.md), not the PDD)**

- [x] **Script written** — timed shot list with what is on screen and what to say, second by second
- [ ] Record a clean screen capture: hook → paste demo repo → live pipeline → **36/BLOCK, 4 criticals + 2 highs** → the advisory finding no scanner caught → the "6 services on Zerops" beat → close
- [ ] No dead air, no "let me just fix this" — re-record until tight
- [ ] Keep the live product clickable so judges can try it themselves

> ⚠️ **The old bullet here scripted "42/BLOCK with 2 explained criticals". That number was never
> real.** The product returns **36/BLOCK, 4 critical + 2 high, all six explained, plus 2 advisory
> notes**. Narrate what is on the screen.

**README (teaching-grade — Kunal rewards this)**

- [x] 1-line pitch + **live URL at the top**
- [x] Demo GIF — 16s, 900px, 415 KB, encoded from frames captured **during a real live scan**
- [x] Mermaid architecture diagram (the 6-service graph, 11 numbered edges) — parsed, not eyeballed
- [x] **"How Zerops is used"** table — 13 rows, each naming the specific mechanism, not "hosted on Zerops"
- [x] Quickstart + features (Core/Advanced) + the API surface
- [x] **AI tools disclosure** — Claude Code (Opus 5), plus the product's own runtime Claude usage
- [x] "What I learned building on Zerops" — 6 lessons, all from things that actually broke
- [x] MIT license (`LICENSE`, © 2026 adilamjad00)
- [x] Screenshots: live progress · score · findings · re-scan diff — all from the live deployment

**Docs & defense**

- [x] Finalize `docs/ARCHITECTURE.md` — added the missing **why Postgres** decision and a Phase 6 section
- [x] **Judge Q&A written** — 10 questions answered against the real build ([`docs/DEMO.md`](docs/DEMO.md) §3)
- [ ] Rehearse it until reflexive — esp. "what do you actually detect" and "what's the Zerops-specific part"

**Social post (whole prize — MX Master 3)**

- [x] **Post drafted** — X and LinkedIn variants, both tagging **@WeMakeDevs** and **@zeropsio**
- [ ] Publish it with the video and the live link attached
- [ ] (Ideally) you already posted ≥1 progress update earlier for "reach"

**SUBMIT (the non-negotiable)**

- [ ] File the submission form on the event page: **repo + live URL + demo + post link + AI tools disclosed**
- [ ] **Re-open the live URL after submitting** to confirm it's still up
- [ ] Keep the deployment warm through judging

**Phase 6 verification (measured, not assumed)**

```
live scan   244736ab · browser-driven through the real UI · 0 console errors
            +8.9s RUNNING SCANNERS (LIVE · WEBSOCKET) · +27.5s report 36/BLOCK
            4 critical gitleaks · 1 high semgrep · 1 high osv · 2 advisory claude
            diff vs. previous: same commit · 36 → 36 · 6 unchanged   ← determinism, on screen
tests       105/105  (core 55 · api 15 · worker 19 · web 16)  — unchanged, nothing moved
build       PASS all four workspaces
docs        13/13 local links + anchors resolve · mermaid parses · 3/3 external URLs 200
live URLs   web 200 · api /healthz {db,valkey,s3 all ok} · github repo 200 (public)
```

**Still outstanding (both need you, neither is code)**

1. **Zerops GUI** — worker → _Automatic scaling configuration_ → containers **min 1 / max 3**.
   Declared in `zerops-project-import.yml` since Phase 5, never applied to the live project. Not
   scripted on purpose: an earlier API write cleared the autoscaling config via nulls in the payload.
2. **Demo repo remediation commit `0abcef0`** — still prepared and unpushed, which is what keeps the
   opening 36/BLOCK beat. Push it during recording for the before/after.

**Done when:** the form is filed, the live URL is confirmed up, and the post is live. → **100%. 🏆**

---

## 🎁 Bonus track — 3 of 8 built, 5 declined with reasons

| #   | Item                                                          | Status                 | Evidence                                                                         |
| --- | ------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| 1   | **Re-scan diff**                                              | ✅ **COMPLETE**        | `GET /scans/:id/diff` live; coverage-aware; 16 tests                             |
| 2   | **AI-antipattern review**                                     | ✅ **COMPLETE**        | 2 advisory findings on the demo repo; score provably unchanged                   |
| 3   | **Markdown export**                                           | ✅ **COMPLETE**        | 7,686 bytes copied in-browser; 11 tests                                          |
| 4   | Live autoscaling beat                                         | ⛔ **BLOCKED**         | Needs the pending worker GUI toggle; container count is not exposed to the app   |
| 5   | Zip upload                                                    | ⬜ **NOT IMPLEMENTED** | Zip bombs and path traversal, on the service whose job is reading hostile input  |
| 6   | Qdrant semantic dedup                                         | ⬜ **NOT IMPLEMENTED** | A 7th service for a problem the two-pass `dedupe()` already solves               |
| 7   | Auth + saved history                                          | ⬜ **NOT IMPLEMENTED** | Large surface, no payoff in a 90-second demo                                     |
| 8   | CI/webhook gate                                               | ⬜ **NOT IMPLEMENTED** | Needs webhook secret verification and a GitHub App; the honest slice is too thin |
| 9   | Do not push .claude and Implementation plans Files on GitHub. |

### 1 · Re-scan diff — COMPLETE

`packages/core/src/diff.ts` · `apps/api/src/routes/scans.ts` · `apps/web/src/components/ScanDiff.tsx`
· `RescanButton.tsx`

Two passes, because scanner fingerprints embed the line number
(`gitleaks:file:12:rule`): exact fingerprint → `unchanged`, then rule identity
(`source|category|file|title`) → `moved`. Without the second pass, deleting an import shifts every
finding below it and the diff reports them all as fixed and re-introduced.

> **A defect the live run caught, not the tests.** The first deployment reported `+10 · 1 fixed` on
> two scans of the _same commit_ — because semgrep had crashed on the second one. A broken scanner
> presented as progress is the exact failure this product exists to prevent. Findings from a scanner
> that ran on one side and failed on the other are now `unknown`, the diff is `comparable: false`,
> and the UI renders the delta in muted grey with a "these two scans are not comparable" notice.

```
GET /scans/bf9f4073/diff   delta 10  comparable false  coverageGap ["semgrep"]  sameCommit true
                           fixed 0  introduced 0  unchanged 5  unknown 1
GET /scans/c1f0a5e4/diff   delta 0   comparable true   sameCommit true
                           fixed 0  introduced 0  unchanged 6      ← determinism proof
guards: bad uuid 400 · unknown scan 404 · first scan of a repo 404
```

The comparison target is chosen server-side (most recent earlier `done` scan of the same
`repo_url`); a caller-supplied id would let anyone splice two unrelated repositories into one report.
The re-scan button posts through the ordinary `POST /scans`, so the SSRF allowlist and rate limiter
stay on one route.

### 2 · AI-antipattern review — COMPLETE

`apps/worker/src/review.ts` · `packages/core/src/score.ts` · `apps/web/src/components/AdvisoryFindings.tsx`

Static analysis matches patterns and is structurally incapable of "this route updates a record and
never checks who owns it" — the _absence_ of a check has no pattern. A second Claude pass reads whole
files for that gap. Live on the demo repo:

```
[medium] authz             Admin endpoint exposes user data with no authorization check
                           src/server.js:11        ← a planted flaw NO scanner reported
[low]    prompt_injection  Embedded prompt-injection attempt directed at reviewing AI
                           src/config.js:1         ← it reported the manipulation instead of obeying it
```

**The score invariant holds, by two independent mechanisms.** Ordering: the score is computed before
the `analyzing` phase begins. Filter: `scoredFindings()` excludes `source: "llm"` from both
`shipReadinessScore` and `summarize`, with a test asserting a scanner-only score is byte-identical
with an advisory finding appended.

```
score 36 · verdict block · summary {critical:4, high:2}      ← identical to every prior run
"6 FINDINGS" excludes the advisory pair · severity bar "4 critical, 2 high"
coverage row reads "2 notes", not "2 found"
0 llm findings leak into the diff · archive keeps `advisory` as its own key
0 of the 4 fixture credentials present in the archive
```

Bounded: ≤4 files, ~6 KB each, ≤6 observations, severity capped at `medium` so it can never
out-rank a scanner critical, category and line re-validated before storage. Runs under `allSettled`
alongside enrichment, so it costs no wall-clock time and a failure yields zero advisory findings.

### 3 · Markdown export — COMPLETE

`packages/core/src/markdown.ts` · `apps/web/src/components/MarkdownExport.tsx`

Rendered in the browser from data the page already holds — no endpoint, no new input reaching the
backend. Makes the same separations the web report does. Verified in a real browser: 7,686 bytes on
the clipboard with the correct headline, severity table, `## Findings (6)`,
`## AI review (2) — advisory, not scored`, and none of the fixture credentials. PDF was declined —
it needs a renderer in the worker for a format nobody pastes into a PR.

### Demo repo

A remediation commit (`0abcef0`) is **prepared and deliberately unpushed** in the scratchpad clone:
secrets moved to env, `exec` → `execFile` with hostname validation, an authorization check on
`/admin/users`, `node-fetch` → 2.6.7. `origin/main` is still `01bc96b`, so the 36/BLOCK opening beat
is intact. Pushing it live during recording produces the before/after diff on camera.

### Bonus-track verification

```
npm test        105/105   (core 55 · api 15 · worker 19 · web 16)
npm run build   PASS      all four workspaces
API             /healthz all green · /scans/:id · /report · /diff · /scans all 200
security        bad uuid 400 · file:// 400 · 169.254.169.254 400 · SSE sequence intact
axe             0 WCAG 2.1 A/AA violations across 9 routes
responsive      no overflow at 1440 / 1280 / 1024 / 768 / 390 / 360
```

> **Second defect caught by verification.** The advisory pass put a 300-character comment line into a
> code block, and the report overflowed to 690px at a 390px viewport: grid items default to
> `min-width: auto`, so the card grew to fit its widest child and the `overflow-x-auto` inside never
> engaged. `min-w-0` on the cards; the long blocks now scroll in their own boxes (622px of content in
> a 306px container).

---

## 🚫 Never-Cut list (if the clock is burning, protect these)

1. The async pipeline + **at least semgrep** running (real findings)
2. The **Ship Readiness Score**
3. A **live, reachable deployment** on Zerops
4. The **90s demo video**
5. The **submission form filed** before the deadline

_Everything else is negotiable. These five are the difference between "placed" and "didn't count."_

---

## 🧭 Definition of Done (global)

Deployed on Zerops · reachable live URL through judging · demo flow works end-to-end · README with architecture diagram + AI disclosure · build post published & tagged · submission form filed · every architectural decision explainable.

_— Tick the boxes. Deploy each phase. Keep it live. Reserve the last 3 hours for Phase 6._
