---
name: verify-gates
description: Run HeroByte's full CI-equivalent verification ladder on the cheap gates-runner agent and act on its structured report. Use after every edit burst, before every commit, and always before any push — also whenever the user says "run the gates", "verify", "is it green", or asks if a change is safe to ship. The ladder is CI's exact step list; hand-picking a subset is how main went red twice on 2026-08-11.
---

# Verify Gates

Delegate the whole verification ladder to the `gates-runner` agent (pinned to a cheaper model) instead of running gate commands from the orchestrator context. One spawn replaces ~10 command round-trips, and the agent already knows every log-handling trap.

## How to invoke

Spawn via the Agent tool, `subagent_type: "gates-runner"`, background is fine:

```
prompt: "Run the gates.<flags>"
```

where `<flags>` is empty or any of:

- ` e2e` — include the Playwright suite. Default it ON for slice-sized or behavior-touching changes; skip for comment/docs-only edits.
- ` boot` — include the 30-second dev-boot check. **Required whenever `packages/shared` gained or changed an export** — the barrel-const trap boots-fails the dev server while every other gate stays green, and nothing else can see it.

## Acting on the report

- `GATES: PASS` → proceed to commit/push.
- Any failure → the fix is orchestrator work; the runner never fixes (that separation is deliberate — a repair-empowered runner would be tempted to re-pin tests, see fix-fixture-ripple's hard rules). Fix, then re-invoke.
- Treat every `SKIPPED` line as *not verified*, never as passing.
- e2e verdicts in the report come from the summary line, not exit codes — trust the report's counts.
