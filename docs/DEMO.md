# Demo, judge Q&A, and the build post

Everything needed to record and submit. Numbers here are **measured against the live deployment**,
not estimated — verified on the scan at the bottom of this file.

> **Correction to the old plan.** The tracker's original Phase 6 note scripted *"score 42/BLOCK with
> 2 explained criticals."* That number is stale. The live product returns **36/BLOCK with 4 criticals
> and 2 highs**, all six explained, plus 2 advisory notes. Narrate what is on the screen — a voiceover
> that disagrees with the UI is worse than no voiceover.

---

## 1 · The 90-second demo

**Target:** `https://github.com/adilamjad00/vibeguard-demo-app` (currently at commit `01bc96b`)
**Live app:** `https://web-2adf-3000.prg1.zerops.app`

### Before you hit record

- [ ] Open `https://api-2adf-3001.prg1.zerops.app/healthz` — must be `{"status":"ok", db/valkey/s3 all "ok"}`. A cold worker makes the first scan slower; **run one throwaway scan to warm it**.
- [ ] Browser at **1280×800**, zoom 100%, no extensions, no bookmarks bar, no notifications.
- [ ] Have the remediation commit ready to push in a second window (see §2).
- [ ] Close the tab afterwards — do **not** leave the recording session's scan mid-flight.

### Shot list

| Time | On screen | Say (verbatim-ish) |
|---|---|---|
| **0:00–0:08** | Home page, scroll stopped on the hero | "AI writes you a working app in ten minutes. It also hardcodes your API key and shells out to `exec`. It runs — so it looks finished." |
| **0:08–0:14** | `/scan`, click **Try the demo repo**, click **Scan repo** | "VibeGuard takes a public repo URL. No signup, no install, no CI config." |
| **0:14–0:34** | **Live pipeline, real time.** Let it run. Point at `LIVE · WEBSOCKET` and the per-scanner counts as they land | "This is live — the worker is publishing phase events through Valkey and the browser is on a WebSocket. gitleaks, semgrep and osv-scanner run concurrently on a private container. The repo is cloned into a sandbox and read as text. **It is never executed.**" |
| **0:34–0:44** | Score resolves: **36 / BLOCK**, severity bar, scanner coverage | "36 out of 100. Block. Four criticals, two highs — and the score is deterministic: the same code always produces the same number." |
| **0:44–0:58** | Expand finding 01 (`src/config.js:19`), then scroll past 05/06 | "Every finding names the file and the line, redacts the secret, explains **why it matters**, and gives you a fix you can copy. Committed API key. A `child_process` sink. A dependency CVE." |
| **0:58–1:08** | **AI REVIEW · ADVISORY · NOT SCORED** — the authz note at `src/server.js:11` | "Then a language model reads the files for what a pattern *can't* express — this admin route has no authorization check, and **no scanner reported it**. It's advisory. It does not touch the score, because the score was computed before this ran." |
| **1:08–1:20** | **Cut** to the pushed fix + re-scan diff band | "Fix it, re-scan, and the diff tells you what actually changed — fixed, new, moved — and refuses to call it progress if a scanner failed." |
| **1:20–1:28** | The status bar: `6 SERVICES · ZEROPS · PRG1`, then the architecture diagram or the Zerops project view | "Six services on Zerops: web, API, a private worker that autoscales, Postgres, Valkey for the queue *and* the live feed, and object storage. Four of them have no public ingress at all." |
| **1:28–1:30** | Live URL on screen | "It's live. Scan your own repo." |

### Recording notes

- **The 20 seconds of live pipeline is the demo.** Do not cut it or speed it up — the fact that
  those events arrive *during* the scan is the whole engineering claim. Everything else can be cut.
- The scan takes **~27 seconds** (measured). If it runs long, the cut at 1:08 absorbs it.
- If a scanner fails on camera, **say so and keep going** — the partial-scan banner is a feature and
  a judge who sees you handle it honestly remembers it. Do not re-record for that.
- Leave the deployment reachable afterwards. Judges click.

---

## 2 · The fix-and-re-scan beat

A remediation commit is **prepared and deliberately unpushed** in a local clone of the demo repo:

```
0abcef0  fix: remediate every finding VibeGuard reported
         secrets → env vars · exec → execFile with hostname validation
         authorization check on /admin/users · node-fetch 2.6.6 → 2.6.7
```

`origin/main` of the demo repo is still `01bc96b`, which is what keeps the opening 36/BLOCK beat
intact. Push it **during** recording (or in a rehearsal window) and re-scan to produce the before/after
on camera.

> **Rehearse this once before recording.** The exact after-score is whatever the scanners report on
> the fixed tree — do not narrate a number you have not seen. What you *can* assert without
> rehearsing: the verdict crosses out of BLOCK, and the diff band lists the fixed findings.

---

## 3 · Judge Q&A

**"What does it actually detect? Is this just a wrapper?"**
Three real scanners, running as real binaries on a private container: gitleaks 8.30.1, semgrep 1.172
with three vendored rulesets, osv-scanner 2.5.0 against OSV.dev. On the demo repo that is four
committed credentials, a `child_process` sink and a dependency CVE — with file, line and fingerprint.
The LLM is downstream of all of it and cannot create a finding.

**"What's the Zerops-specific part? Could this be a Vercel app?"**
No. It is six services on one private network, and the shape of the product depends on that: the
worker clones arbitrary third-party repositories, so it runs with **no public ingress** — no port, no
subdomain, no route in. Valkey carries the BullMQ queue *and* the live progress channel. The scanner
binaries are baked into a cached runtime image via `prepareCommands`, so a redeploy skips a
multi-minute install. Serverless gives you none of that: no persistent queue consumer, no private
service topology, and a 30-second scan does not fit a function timeout.

**"Why should I trust the score?"**
Because it is deterministic and I can show you: two scans of the same commit produce the identical
number, and the diff endpoint says so on screen. It is 100 minus a weight per severity, with repeats
of the *same rule* damped to a quarter and capped at 2×. That damping exists because without it four
secrets in one file scores 0 and so does a repo with forty — and once every bad repo reads 0, fixing
something can no longer move the number.

**"What does the LLM do — and what does it deliberately not do?"**
Two passes, both fenced. The explanation pass turns each scanner finding into *why it matters* and a
concrete fix. The advisory pass reads whole files for what a pattern cannot express — a route with no
ownership check. **Neither can move the score**, guaranteed twice over: the score is computed before
either runs, *and* `scoredFindings()` filters `source: "llm"` out of the scorer and the summary. There
is a test asserting a scanner-only score is byte-identical with an advisory finding appended.

**"You're feeding untrusted code to a model — what about prompt injection?"**
File contents are framed as untrusted data in the system prompt, secrets are masked before anything
is sent, and every advisory observation is re-validated after the fact (category allowlist, line must
exist in the file, severity capped at `medium`). The demo repo contains comments arguing its
credentials are fake and instructing a reviewing AI to ignore them — VibeGuard **reports that as a
finding** rather than obeying it. That is on screen at `src/config.js:1`.

**"What if a scanner crashes?"**
It is reported as *failed*, never as *zero findings* — the report carries an amber "this is a floor,
not a clean bill of health" banner and the coverage panel names which scanner did not run. The diff
inherits that: findings from a scanner that ran on one side and failed on the other go to `unknown`,
the comparison is marked not-comparable, and the delta is rendered in grey. That was a real bug — the
first deployment reported *"+10, 1 fixed"* on two scans of the same commit because semgrep had
crashed. A broken scanner presented as progress is the one thing this product must never do.

**"Why WebSocket and not SSE?"**
SSE is implemented and correct — `curl -N` on `/scans/:id/stream` is the cleanest demo of the
pipeline. But Zerops' shared L7 balancer runs `proxy_buffering on`, which held the whole SSE response
until it ended: 40–66 seconds of nothing, then everything at once. It cannot be disabled for a
`*.zerops.app` subdomain — the routing entries are `isEditable: false` and the schema has no buffering
key at any scope. An upgraded WebSocket is a tunnel, not a buffered response, so it is unaffected.

**"Is it safe to point this at a repo? What stops SSRF?"**
An allowlist at submission: `https://github.com/owner/repo` only. `http://`, `file://`, link-local
`169.254.169.254`, internal hostnames like `valkey`, embedded credentials and non-GitHub hosts are all
rejected before the URL is stored, let alone queued — 12 tests cover it. The clone is `--depth 1`,
250 MB-capped, 120-second timeout, deleted in a `finally`, and **nothing in it is executed**.

**"What would you do with another week?"**
A GitHub App so it runs on pull requests and blocks a merge — that is the version people would
actually keep. Then per-repo history so the score is a trend rather than a snapshot. I deliberately
did **not** add auth, uploads or a vector database in 48 hours; they are surface area with no payoff
in a 90-second demo, and each is written up in the tracker with the reason it was declined.

**"What broke?"**
Three things worth telling you about. The first live scan of a repo full of planted flaws returned
**100/pass** — a deprecated gitleaks flag, a `catch {}` hiding it, and a fixture secret no scanner
could match. Semgrep's intermittent failure was blamed on memory for hours; it was a `--max-memory`
flag *we* had added while mis-diagnosing an OOM. And a CSS `border` shorthand in a utility silently
overwrote every severity colour, so the red stripe on critical findings was inert. All three were
caught by verifying against the running deployment rather than by reading the code.

---

## 4 · The build post

Tag **@WeMakeDevs** and **@zeropsio**. Attach the 90-second video. Post the live link, not a
screenshot of it.

### X / Twitter

> Shipped **VibeGuard** for #TheZeropsChallenge 🛡️
>
> Paste a public GitHub repo → get a Ship Readiness Score in ~30s, with every finding explained and
> a fix you can copy.
>
> gitleaks + semgrep + osv-scanner run concurrently on a private worker. The repo is cloned into a
> sandbox and read as text — never executed.
>
> Six services on @zeropsio, one private network: web, API, an autoscaling worker with no public
> ingress at all, Postgres, Valkey carrying both the job queue and the live progress feed, and
> object storage for the redacted archive.
>
> The bit I'm proudest of: the score is **deterministic and the LLM cannot touch it**. Claude
> explains findings and flags things a pattern can't express — an admin route with no authz check —
> but it's computed before the model runs, and filtered out of the scorer besides.
>
> Live, no signup 👉 https://web-2adf-3000.prg1.zerops.app
> Code + full decision log 👉 https://github.com/adilamjad00/VibeGuard
>
> @WeMakeDevs

### LinkedIn

> **VibeGuard — an AI security gate for AI-generated apps.** Built solo in 48 hours for The Zerops
> Challenge.
>
> People are shipping apps they didn't write. AI coding tools produce working code that also
> hardcodes credentials, shells out to `exec`, and pulls dependencies with known CVEs. It runs, so it
> looks finished.
>
> VibeGuard takes a public GitHub URL and returns a Ship Readiness Score (0–100) in about thirty
> seconds — three real scanners running concurrently on a private worker, then a Claude pass that
> explains each finding and gives you a concrete fix.
>
> Two decisions I'd defend anywhere:
>
> • **The language model can't move the score.** It's computed from scanner output before the model
> runs, and filtered out of the scorer on top of that. An LLM that can change a security verdict is a
> security tool you can't trust.
>
> • **A failed scanner is reported as failed, never as "no issues found."** A false clean bill of
> health is the most dangerous thing a security tool can produce.
>
> Six services on Zerops sharing one private network — the worker that clones untrusted repositories
> has no public ingress at all. Every decision, including the ones that turned out wrong, is written
> up in the repo.
>
> Live: https://web-2adf-3000.prg1.zerops.app
> Code: https://github.com/adilamjad00/VibeGuard
>
> #TheZeropsChallenge #Zerops #WeMakeDevs #DevSecOps

---

## 5 · Submission checklist

- [ ] Repo URL — `https://github.com/adilamjad00/VibeGuard`
- [ ] Live URL — `https://web-2adf-3000.prg1.zerops.app`
- [ ] Demo video link
- [ ] Build post link (tagged @WeMakeDevs + @zeropsio)
- [ ] AI tools disclosed — Claude Code (Opus 5); it is also in the README
- [ ] **Re-open the live URL after submitting** and confirm it loads
- [ ] Keep the deployment warm through judging

---

## Evidence

Measured on the live deployment while writing this file — a full browser-driven scan, clicking
through the real UI:

```
scan 244736ab-5386-44a0-ad45-3162b5bf41b3   repo adilamjad00/vibeguard-demo-app @ 01bc96b
  +0.0s   submitted through the UI
  +8.9s   cloning done · RUNNING SCANNERS · transport LIVE · WEBSOCKET
  +27.5s  report rendered — 36 / 100 · BLOCK
  console errors: 0

  4 critical  gitleaks   src/config.js:19-22   Hardcoded secret: generic-api-key
  1 high      semgrep    src/server.js:7       Detect child process
  1 high      osv        package-lock.json     node-fetch@2.6.6: GHSA-r683-j2x4-v87g
  advisory    claude     src/server.js:11      Admin endpoint exposes user data with no authz check
  advisory    claude     src/config.js:1       Embedded prompt-injection attempt

  diff vs. previous scan: same commit · 36 → 36 · 0 fixed · 0 new · 6 unchanged
```
