# totally-legit-ai-app

> ⚠️ **This application is deliberately vulnerable. Do not deploy it, and do not copy any of it
> into real code.**

It is the demo target for [VibeGuard](https://github.com/adilamjad00/VibeGuard) — a fixture built to
be scanned, not run. It imitates what an AI coding assistant plausibly produces on a happy path:
it works, and it is unsafe.

## The planted flaws

| File | Flaw | Caught by |
|---|---|---|
| `src/config.js` | Four high-entropy credentials committed to source | gitleaks |
| `src/server.js` | User input passed to a shell command | semgrep |
| `package.json` | `node-fetch@2.6.6` — forwards secure headers to untrusted sites | osv-scanner |
| `src/db.js` | User input concatenated into a SQL string | *not currently matched* |
| `src/server.js` | `/admin/users` with no authorization check at all | *not currently matched* |

The last two are honest about their status. semgrep's SQL-injection rules are keyed to real database
drivers, and `src/db.js` requires a made-up `./fake-db`, so nothing matches it. There is likewise no
generic "route without an authorization check" rule — recognising that is a judgement call, which is
the gap the LLM pass exists to fill. Claiming they were detected when they are not would be exactly
the false confidence VibeGuard is built to eliminate.

## Why these dependency versions

`express@5.1.0` is current and clean on purpose. An earlier version of this fixture pinned
`express@4.18.2`, whose transitive tree dragged in **19 unrelated advisories** — they buried the
deliberately planted flaws and pinned the score at 0, where fixing anything could no longer move it.
Even `express@4.21.2` is no longer clean: new advisories have since landed on `path-to-regexp`,
`qs`, and `body-parser`.

`node-fetch@2.6.6` carries exactly one HIGH advisory, so the dependency signal is real, singular,
and attributable.

Every credential here is synthetic and has never been valid.

They are deliberately shaped to match real credential formats, because secret scanners key on
structure rather than on the word "key": gitleaks' OpenAI rule requires the literal `T3BlbkFJ`
marker that real OpenAI keys carry, and its AWS rule requires the `AKIA` prefix followed by exactly
16 uppercase alphanumerics. A friendly-looking placeholder like `sk-proj-myFakeKey` matches neither
and is invisible to the scanner — which would make this fixture prove nothing.

The app is never executed during a scan. VibeGuard clones it and reads it as inert text — the whole
point is that analyzing untrusted code must not mean running it.
