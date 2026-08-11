---
name: fix-fixture-ripple
description: Delegate the mechanical TS2741 fixture fallout after adding a required field to a shared type (RoomState, MainLayoutProps-style component props). Use whenever typecheck output shows "Property 'X' is missing in type ... but required" across multiple test-fixture literals — do not hand-edit N fixtures from the orchestrator context.
---

# Fix Fixture Ripple

Every new required field on a shared type breaks the hand-built test fixtures that construct it (historically: 15 files for SnapshotCharacter, 4 for a RoomState field, 18 call sites for a component prop). The repair is uniform and judgment-free, so it goes to the `fixture-ripple` agent (pinned cheaper).

## How to invoke

Spawn via the Agent tool, `subagent_type: "fixture-ripple"`, with the field, its default, and — if already in hand — the typecheck output pasted in:

```
prompt: "RoomState gained required `playerPropsEnabled: boolean` (default false). Repair the fixture fallout and report."
```

## Acting on the report

- `⚠ DESIGN CHOICE` lines mean it applied the optional-prop escape hatch to a **component API** (the documented MainLayoutProps pattern). Read these — veto and redo by hand if the prop genuinely should be required at every call site.
- `ESCALATE` lines are orchestrator work; the agent only handles the exact ripple pattern and is instructed to stop rather than improvise.
- It will never touch assertions or characterization pins — twice in this repo a green pin was faithfully protecting a bug, and re-pin decisions stay with the orchestrator. If a needed change is a re-pin, it arrives as an ESCALATE, which is correct.
