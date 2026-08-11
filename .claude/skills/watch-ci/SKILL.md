---
name: watch-ci
description: Watch the GitHub Actions run after a push to loshunter/HeroByte and triage any failure, via the Haiku-pinned ci-watcher agent. Use immediately after every git push (dev or main), when the user asks "did CI pass" or "is the deploy good" — and always for main, because Render and Cloudflare deploy the push regardless of CI, so an unwatched red run means production is running unverified code.
---

# Watch CI

Delegate CI watching to the `ci-watcher` agent (Haiku) instead of polling from the orchestrator. It owns the find-poll-triage lifecycle and reports one structured verdict.

## How to invoke

Right after a push, spawn via the Agent tool, `subagent_type: "ci-watcher"`, in the background so other work continues:

```
prompt: "Watch the latest run on <branch> for <head-sha>."
```

## Acting on the report

- `CI: success` → done. For main pushes with player-visible changes, follow with the production probes: fetch `https://herobyte.pages.dev/`, take the `assets/index-*.js` name, and grep the bundle for a marker string that lives in the **eager** bundle (e.g. a snapshot field name) — DM-only strings live in the lazy chunk and a wrong probe reads as a stale deploy. Server: expect HTTP 200 from `https://herobyte-server.onrender.com/`.
- `CI: failure` → reproduce the named step locally before pushing a fix. The two steps `pnpm lint` does not cover are `pnpm format:check` and `pnpm lint:structure:enforce`; the /verify-gates skill runs the full list.
- Remind the user that already-open player tabs must reload after any main deploy — stale clients silently blank.
