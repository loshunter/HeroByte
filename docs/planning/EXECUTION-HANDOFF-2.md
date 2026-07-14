# EXECUTION HANDOFF 2 — ✅ COMPLETE (historical record)

> **STATUS 2026-07-14: this arc is DONE and pushed.** S10–S13 and Phase 3 V1–V6 all shipped;
> the 2026-07-13 senior review's 2 HIGH + 3 MEDIUM + all LOW findings were fixed with regression
> tests and pushed to `origin/dev` (range `d0b5de72..f0c5430e` plus follow-ups through `bb54218d`).
> Do NOT execute this document. The next arc is **`docs/planning/m4-dungeon-recipe-plan.md`**
> (M4 Phase 1 — the dungeon recipe). The traps in §"New traps" below remain valid reference.

You are the engineer picking up HeroByte (`D:\HeroByte`, branch `dev`) with a fresh context window.
Your predecessor shipped all of Phase 1 (S1–S8) and the Phase-2 keystone (S9). This file is the delta;
the original briefing still governs how you work.

## Read first, in this order

1. **`docs/planning/EXECUTION-HANDOFF.md`** — the original briefing. §3 (verification ritual), §4/§5
   (traps), and the methodology are all still in force verbatim. Read it in full.
2. **`docs/planning/live-map-toolbar-plan.md`** — the plan you execute. §0–§4 for the rules, then the
   slices you actually run: **S10 (line ~339) → S13 (~376)** and **Phase 3 V1–V6 (~389)**. Every slice
   has a Context Capsule with exact `file:line` anchors — you should rarely need to grep.
3. **`MEMORY.md`**, then in full: **`s1-live-binding-shipped.md`** (the complete S1–S9 record + every
   trap discovered so far) and **`herobyte-build-conventions.md`** (build/test gotchas).

## Already shipped — do NOT redo (all local on `dev`, nothing pushed)

Phase 1 S1–S8 + S9, one commit per slice, each verified + adversarially gated:
`a82a32b` fix: tint image-backed live elements (S9 gate) ·
`af9e56b` S9 player-visible scenery ·
`7eeccbd` S8 e2e + docs ·
`0864374` S7 hotkeys ·
`b71ccf5` S6 procedural terrain ·
`4a83842` S5 terrain brush · `a0c7bcd`+`24e8413` S4 room · `a2d207e` S3 door · `974e98f`+`3aa7460` S2 ·
`faeb023`+`ad4fee3` S1.

Suites currently green: **shared 248 · server 1561 · client 843 · e2e 57**; structure guard, typecheck,
lint, `build:check` (71 KB gz / 175 KB) all clean.

## Your job

Execute the remaining slices in order and finish the project:
**Phase 2 — S10 → S11 → S12 → S13**, then **Phase 3 — V1 → V6**. Start with **S10**.

- **S10 🟡** Placement tools (tiles/stamps/scatter, asset picker). Reuses S9's `MapElementsLayer` render
  path + the existing `add-element`/`add-elements` commands. **No server work.**
- **S11 🟡** Hallway tool + POPULATE (the "author on the fly" headline). Reuses `place-room` + `add-elements`.
- **S12 🟡** Layers panel, inspector, eyedropper parity.
- **S13 🔴** Exports move to the live palette; **the Studio scene UI is deleted** (the document/command/
  compile ENGINE stays forever). Fix docs, replace `apps/e2e/map-studio.smoke.spec.ts` with palette-driven
  coverage. `build:check` should show the entry bundle SHRINK (the lazy studio chunk disappears).
- **V1–V6** visual/mobile polish — independent of the map arc, touch different files, can run anytime.
  Drive BOTH 375×812 (mobile) and 1280×800 (desktop). V2 (devicePixelRatio) is 🔴 rendering.

## How you work — non-negotiable (from the original handoff)

- **One slice at a time**; write code **and its tests in the same commit**; run the **full verification
  ritual** (handoff §3) before claiming done; **commit per slice to `dev`**.
- **Golden Rules (plan §4):** the 350-LOC guard is `pnpm lint:structure:enforce` (SEPARATE from `pnpm lint`;
  `loc >= 350` fails — keep ≤348); **rebuild `@herobyte/shared` after any shared edit**
  (`pnpm --filter "@herobyte/shared" build`); register every new WS message in
  `apps/server/src/middleware/validation.ts`; **never** touch the frozen test
  (`terrainRenderParity.frozen.test.ts`); runtime constants live in a sub-module re-exported from
  `index.ts` (the tsx `.d.ts` trap).
- **When a slice's Trap / Escalate-if fires, or the code contradicts a capsule, STOP and report** rather
  than guess — a wrong guess here ships a silent unit-mismatch or an info-leak.
- **Do NOT push to origin unless the owner asks.**

## Senior gates (remaining)

Run an adversarial **Workflow** review at every 🔎 gate and any slice touching
**security / protocol / persistence / rendering-parity / units**:

- **After S13 — the FINAL gate** (plan ~line 385): units lens, info-leak lens, race lens,
  deletion-completeness lens (the Studio deletion must leave no dangling references or dead exports).
- **V2 (devicePixelRatio)** is a rendering-parity slice — review it.
- S10–S12 are client-only placement/UI; a gate isn't mandated, but S11's POPULATE (bulk element
  generation) touches units + payload size — verify those inline.

**Workflow discipline (learned the hard way this run):**
- Scoped finders, each forced to state a **concrete failure_scenario** → 2 refuters per finding (prompted
  to REFUTE, default not-real) → completeness critic → triage survivors into fixes + regression tests.
- **Bank agents in small waves (≤7 concurrent finders per Workflow call).** A big fan-out can hit the
  **subagent session limit** and every agent errors — the Workflow then returns `{confirmed:[]}`.
  **That empty result is an infrastructure failure, NOT a clean pass.** If it happens: (a) do a thorough
  **inline** adversarial review yourself (read the files, construct the failing sequences — this caught
  nothing the gate later missed), and (b) retry the Workflow once the limit resets. The full S9 gate
  (12 agents in ≤4-item waves) ran fine; the first Phase-1 attempt (7 agents at once) all errored.
- **Verify every load-bearing assumption inline before fanning out** (e.g. "does the live path inherit the
  per-recipient secret-door strip?" — confirmed at `model.ts:294–325` before the S9 gate).

## Browser verification (handoff §3) — and what bit me

- Distinct `?sessionUid=` per tab; room password `Fun1`, DM password `FunDM`. Drive forms/actions via
  `javascript_tool` — **screenshots time out in headless**, so verify with: snapshot inspection
  (`window.__HERO_BYTE_E2E__.snapshot`), **canvas pixel sampling** (`getImageData` — e.g. count a
  distinctive fill to prove a layer painted), and `read_page` (accessibility tree) for DOM/labels.
- The console tool replays a **retained buffer** that survives reload/`console.clear()` — HMR
  "Should have a queue" / hook-order errors carry a `?t=…` module version and persist; judge health by
  the newest timestamp + behavioral proof (E2E harness live, layers rendering), not by their presence.
- **Server-code changes need a dev-server RESTART** (`preview_stop` + `preview_start name:"server"`);
  HMR only covers the client. The restart clears the in-memory `MapStudioService` documents → the persisted
  `liveMapDocumentId` becomes a **dangling binding**. Drive a fresh scenario via the harness:
  `sendMessage({t:"elevate-to-dm", dmPassword:"FunDM"})` → `map-studio-create` → `map-studio-set-live` →
  `map-studio-command` (add-element), then read the player tab's snapshot/pixels.

## New traps discovered this run (add to the original §5)

- **e2e runner:** run `pnpm test:e2e -- <file-substring>` — NOT `node scripts/run-e2e.mjs …`, which fails
  on Windows with `spawn pnpm ENOENT` (the script spawns `pnpm` without a shell; only the pnpm-script path
  sets `npm_execpath`). `pnpm test:e2e:smoke` greps "smoke".
- **Multi-client e2e:** give each client its OWN `browser.newContext()` (isolated storage → distinct
  session UID). A shared `context.newPage()` collides the DM's UID and triggers a connection war → the
  second client never sees the scene.
- **Canvas-drag e2e:** a tool's `onMouseUp` skips its commit while a command is in flight (no retry) —
  `waitForTimeout` a beat after a big command (e.g. `placeRoom`) before the next drag. And a short drag can
  snap to **zero cells** on a zoomed-out camera → null draft; use the room's proven ~240px span.
- **`0×0` viewport → the app latches `isMobile` at mount** and renders `MobileLayout`. `resize_window`
  to 1280×800 THEN reload (isMobile is mount-only).
- **`apps/server/src/domains/room/model.ts` is AT the 350-LOC cap** — any server-model addition needs a
  trim elsewhere in the same file. Unit test files under `__tests__` are exempt from the structure guard;
  non-test source files are not, and `prettier --fix` can EXPAND a file over the cap.
- **Secrecy invariant (S9):** `deriveMapElements` (`scenePublish.ts`) is the SOLE privacy-filtered producer
  of `RoomSnapshot.mapElements`; it ships to every recipient with **no per-recipient wire backstop**
  (unlike `compiledScene`'s secret-door strip). Keep that single-producer invariant intact in S10–S13 —
  never assemble a player element list any other way. `opacity: 0` is presentation, NOT a privacy control
  (the privacy mechanisms are `hidden` / invisible layer / `notes`-kind layer / `visibleToPlayers:false`).

## Open follow-up chips (owner-triggered; some intersect the remaining work)

1. Dangling live-map binding after a server restart (in-memory Studio docs don't survive; recompile of a
   missing doc errors gracefully). 2. Re-send `map-studio-create`/`open` on WebSocket reconnect. 3.
   `importMapDocument` should reject duplicate layer ids (defense-in-depth for `deriveMapElements`'
   unique-id assumption). 4. The live grid overlay (clamped `toLiveGridSize`) diverges from document-scale
   terrain/element content for grids outside [10,500]. Chips 1–2 overlap any reconnect/persistence work;
   3 hardens the S9 secrecy path; 4 is a small design decision. Surface them if a slice lands near them.

## Start here

Confirm the tree is green, then begin S10:

```
pnpm typecheck && pnpm lint && pnpm lint:structure:enforce && pnpm test
```
