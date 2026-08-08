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

Every credential here is fake. `sk-proj-1a2b3c4dExampleFAKEkeyDoNotUse00998877665544` is a
placeholder that has never been a real key, and `supersecret123` is a literal example of what not
to do.

The app is never executed during a scan. VibeGuard clones it and reads it as inert text — the whole
point is that analyzing untrusted code must not mean running it.
