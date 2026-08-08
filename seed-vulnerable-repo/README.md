# totally-legit-ai-app

> ⚠️ **This application is deliberately vulnerable. Do not deploy it, and do not copy any of it
> into real code.**

It is the demo target for [VibeGuard](https://github.com/adilamjad00/VibeGuard) — a fixture built to
be scanned, not run. It imitates what an AI coding assistant plausibly produces on a happy path:
it works, and it is unsafe.

## The planted flaws

| File | Flaw | Caught by |
|---|---|---|
| `src/config.js` | Hardcoded API key and JWT secret committed to source | gitleaks |
| `src/db.js` | User input concatenated into a SQL string | semgrep |
| `src/server.js` | User input passed to a shell command | semgrep |
| `src/server.js` | `/admin/users` with no authorization check at all | semgrep / LLM pass |
| `package.json` | `lodash@4.17.11` — known CVEs | osv-scanner |

Every credential here is synthetic and has never been valid.

They are deliberately shaped to match real credential formats, because secret scanners key on
structure rather than on the word "key": gitleaks' OpenAI rule requires the literal `T3BlbkFJ`
marker that real OpenAI keys carry, and its AWS rule requires the `AKIA` prefix followed by exactly
16 uppercase alphanumerics. A friendly-looking placeholder like `sk-proj-myFakeKey` matches neither
and is invisible to the scanner — which would make this fixture prove nothing.

The app is never executed during a scan. VibeGuard clones it and reads it as inert text — the whole
point is that analyzing untrusted code must not mean running it.
