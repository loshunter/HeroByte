# Execution Handoff — Live Map Toolbar, Private Rooms follow-ups, Visual/Mobile Polish

**For:** the next engineer/agent picking up HeroByte with a clean context window.
**From:** the senior dev (Fable 5) after a full planning + fixing session on 2026-07-11.
**Repo:** `D:\HeroByte` · branch `dev` · pnpm monorepo (React/TS client, Node WS server, shared package).

Read this once, top to bottom, before touching anything. It tells you what already shipped (don't redo it), what to build, and — most importantly — *how* to build it so you don't fall into the traps that already cost real debugging time this session.

---

## 0. Orientation — where everything is

- **The plan you execute:** [`docs/planning/live-map-toolbar-plan.md`](live-map-toolbar-plan.md) (555 lines). It is self-contained and junior-model-ready: every slice has a **Context Capsule** (exact files with line anchors + verbatim contracts), Changes, Tests, Done-when, Traps, and Escalate-if. **You should almost never need to grep the repo to understand a slice — the answer is in the capsule.** If you find yourself exploring broadly, you've drifted; re-read the capsule.
- **Durable project memory:** `C:\Users\loshu\.claude\projects\D--HeroByte\memory\*.md`. Load `MEMORY.md` first (it's the index). The load-bearing ones for this work:
  - `herobyte-build-conventions.md` — the non-obvious build/test gotchas (stale shared dist, cell-vs-pixel units, package filters, the verification ritual). **Read this in full.**
  - `live-map-toolbar-plan.md`, `private-rooms-feature.md`, `herobyte-2026-07-11-senior-review.md` — status of everything done this session.
  - `herobyte-north-star-vision.md` — `VISION.md` is the product north star; the toolbar work is the M3→M4 bridge.
- **The team playbook:** `.agents/AGENTS.md` — git/branch conventions, the agent operating protocol, verification suites. (It has an uncommitted working-tree edit that predates this session — leave it alone.)
- **The vision:** `VISION.md` at repo root — the "why" behind the toolbar and Studio retirement.

---

## 1. What already shipped this session (DO NOT redo — build on it)

All committed to `dev`. Verify with `git log --oneline -12`.

**Bug fixes (from an adversarial senior review — all verified + tested):**
- `7dabaaaf` prop drag half-cell drift; `4df41996` secret-door id fingerprint leak; `70d6e7c1` Map Studio command-queue wedge on reconnect; `2dec3860` real "subtle" motion tier; `598d146a` CWD-forked state/asset stores.

**Multi-room / private tables (the connection-war fix is critical context):**
- `db329419` — **the connection-war fix.** Two browser contexts sharing one session uid used to 4001-war forever and neither could authenticate. Now replacement uses close code `WS_CLOSE_REPLACED = 4002` (`packages/shared/src/wsCloseCodes.ts`), terminal client-side. This was *the* reason custom rooms never worked.
- `ca5a8936` — **private tables.** Per-room passwords set at creation, separate room + DM passwords, default password locked out of custom rooms, link-only (no room listing). Server core: `apps/server/src/domains/auth/` (service split into `authCrypto.ts` + `secretPersistence.ts`), `apps/server/src/ws/auth/roomCreation.ts`. Client: `apps/client/src/features/rooms/useCreateRoom.ts` + `RoomLobby.tsx`. Fully browser-verified.

**Plans written (your work queue):**
- `e6766c90` + `b30bf0ea` — the live-map-toolbar plan (Phases 1 & 2).
- `30ea4718` — Phase 3 (visual/mobile) appended.

**Current tree:** clean except the pre-existing `.agents/AGENTS.md` edit. `dev` is ahead of `origin/dev` by this session's commits — do NOT push unless the owner asks.

---

## 2. What to build — the slices, in order

The plan has three phases. **Do slices strictly in order within a phase; complete a slice's Done-when before starting the next.** Phase 3 is independent (different files) and may run in parallel with Phase 1/2 if you want, but one thing at a time is safest.

**Phase 1 — the live map toolbar rails (`docs/planning/live-map-toolbar-plan.md` §5):**
`S1` server live-bound document → **`S2` map-edit mode + wall tool [🔎 SENIOR GATE after]** → `S3` door tool + walls overlay → `S4` room tool (`place-room`) → `S5` live terrain brush → `S6` procedural terrain at the table → `S7` undo/hotkeys → **`S8` e2e + hardening [🔎 SENIOR GATE]**.

**Phase 2 — Studio parity then retirement (§5B):**
**`S9` player-visible live elements [🔎 SENIOR GATE — protocol/secrecy]** → `S10` placement tools + asset picker → `S11` hallway tool + POPULATE → `S12` layers/inspector/eyedropper → **`S13` exports move + delete the Studio [🔎 FINAL SENIOR GATE]**.

**Phase 3 — visual & mobile polish (§5C), mostly CSS/theme, low-risk:**
`V1` touch targets → `V2` canvas devicePixelRatio (crispness) → `V3` canvas sizing robustness → `V4` mobile sheets not draggable windows → `V5` readability floors → `V6` safe-area/landscape.

Start with **S1** (pure backend, provable by tests, zero UI risk) unless the owner directs otherwise. The 🔎 **SENIOR GATES** are where you STOP and request an adversarial review before continuing (see §4).

---

## 3. The non-negotiable execution loop (per slice)

This is the method that works on this codebase. Follow it every slice:

1. **Read the slice's Context Capsule and only the files it names.** Don't wander.
2. **Write the code + its tests in the same commit.** Test names/coverage are specified per slice.
3. **Respect the Golden Rules** (plan §4). The ones that bite hardest:
   - **350-LOC guard** on every NEW file (`loc >= 350` fails; a trailing newline counts — keep new files ≤348 real lines). It's a SEPARATE script: `pnpm lint:structure:enforce` from repo root, NOT part of `pnpm lint`.
   - **Stale shared dist:** after ANY edit under `packages/shared/src`, run `pnpm --filter @herobyte/shared build` or server/client silently use the old types.
   - **Validator registry is a hard gate:** a new WS message type MUST be registered in `apps/server/src/middleware/validation.ts` or the server silently drops it (console.warn only).
   - **Never touch the frozen test** `apps/client/src/features/map-studio/__tests__/terrainRenderParity.frozen.test.ts` (sha-locked by `pnpm lint`).
   - **One command = one undo step** (batch client-side).
4. **Run the verification ritual (below) before claiming done.**
5. **When a Trap or Escalate-if fires, STOP and report** — a paused slice costs nothing; a wrong guess ships a silent unit-mismatch or info-leak bug.
6. **Commit per slice to `dev`** with a message in the repo style (`feat: <what> — <flavor>`). End the commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (or your model line).

### The verification ritual (exact commands, from repo root)
```bash
pnpm --filter @herobyte/shared build      # ALWAYS first if you touched packages/shared
pnpm --filter @herobyte/shared test
pnpm --filter vtt-server test             # single file: pnpm --filter vtt-server test -- path/to.test.ts
pnpm --filter herobyte-client test        # single file: pnpm --filter herobyte-client exec vitest run <path>
pnpm typecheck                            # vitest does NOT typecheck
pnpm lint                                 # eslint+prettier+frozen-test gate
pnpm lint:structure:enforce               # the 350-LOC guard (SEPARATE, from repo root)
pnpm --filter herobyte-client build:check # entry-bundle 175KB gzip budget (for client-heavy slices)
pnpm test                                 # full suite
pnpm test:e2e                             # serial; ports 5175/8788; passwords Fun1 / FunDM
```
Do NOT run `pnpm test` while an adversarial review workflow is live — verifier agents run tests too and the batched client runner fails on contention (transient, retries green).

### Browser-driven verification (for any UI slice)
This project is best verified by actually driving it. Use the Browser pane tools:
- Start servers: `preview_start {name:"server"}` then `preview_start {name:"client"}` (config in `.claude/launch.json`; client 5174, server 8787).
- Load `http://localhost:5174/?sessionUid=<unique>` (the `sessionUid` URL param overrides the localStorage uid — **use a distinct one per tab** or you'll trigger the connection-war behavior between tabs).
- Auth: default room password `Fun1`, DM password `FunDM`.
- **The headless preview browser is finicky:** coordinate clicks land at (0,0) because the viewport reports 0×0 — drive forms with `javascript_tool` (set input value via the native setter + dispatch an `input` event, then `form.requestSubmit()`), and read state via `read_page` / `javascript_tool` rather than screenshots (screenshots time out). `resize_window` to mobile 375×812 and desktop 1280×800 for responsive checks.
- Confirm behavior in **server logs** (`preview_logs`) — they're the source of truth (e.g. `Client authenticated: <uid> (room <id>)`).

---

## 4. Use adversarial agents — this is how quality is enforced here

The single highest-leverage practice on this repo: **adversarial multi-agent review catches the class of bug that tests AND hand-review miss** (this session and prior ones confirmed real bugs of exactly this kind: unit mismatches, off-lattice re-binning, float64 seed collapse, the secret-door id leak). Use the **Workflow tool**.

**When to run one:** at every 🔎 SENIOR GATE in the plan, and any time a slice touches security, protocol, persistence, rendering parity, cells-vs-pixels units, or cross-client behavior.

**The pattern that works (finder → adversarial refuters):**
1. **Fan out scoped finders** — one agent per subsystem/lens (units, info-leak, race, protocol-drift, test-quality…), each with a tight scope and a schema that forces a concrete `failure_scenario` (specific inputs → specific wrong behavior). Reject any finding that can't articulate a concrete failure.
2. **Verify each medium+ finding with 2 independent refuters**, each prompted to REFUTE, defaulting to `isReal=false` when uncertain. Keep only findings that survive (majority upholds). Give refuters distinct lenses (does-the-code-say-this vs is-it-reachable-and-what's-the-impact).
3. **A completeness critic** at the end: "what did this review miss?"
4. **Triage survivors against the code yourself**, turn confirmed risks into fixes + regression tests, THEN continue.

**Two hard lessons about running these here (they will bite you otherwise):**
- **Session limits kill big fan-outs.** A 16-agent finder wave twice consumed the entire session quota and returned *nothing* usable. **Bank the work in small waves** (≤7 agents per Workflow call), and prefer running finders and verifiers as SEPARATE waves rather than one giant pipeline. If agents die on a session limit, their partial reasoning is still in the transcript journals (`.../subagents/workflows/<runId>/journal.jsonl` and `agent-*.jsonl`) — salvage it rather than re-running.
- **Verify the load-bearing claims yourself, inline, before fanning out.** When a review's whole architecture rests on one assumption (e.g. "returning `{broadcast:true}` from this handler triggers a room broadcast"), confirm it by reading the code yourself first — don't spend a fan-out to discover the premise was wrong.

Structured workflow subagents should return raw data via a schema (not prose). Read the Workflow tool's own docs for the pipeline/parallel/schema mechanics.

---

## 5. Traps that already cost time this session — avoid them

- **tsx resolves `@herobyte/shared` to the `.d.ts`.** A direct `export const FOO = 1` in `packages/shared/src/index.ts` is **erased to `undefined` at runtime** for the server (tsx honors `apps/server/tsconfig.json`'s path map to `dist/index.d.ts`, and ambient declarations have no runtime value). Put runtime constants in a **sub-module and re-export** them from `index.ts` (see `wsCloseCodes.ts` for the pattern). Re-exported values resolve fine; direct declarations don't.
- **Pre-auth WS messages get queued/dropped.** The client send-path holds any message except `authenticate` until authenticated, AND the command-ack layer retries+drops un-acked commands. A message the client sends *before* auth (like `create-room`) must be added to the immediate-send list (`MessageQueueManager`) AND the non-tracked list (`CommandAckManager`), and its server response must be threaded through BOTH `ControlMessage` unions + the `isControlMessage` guard (`services/websocket.ts` and `services/websocket/MessageRouter.ts`).
- **Vite HMR can wedge on a partial reload** (`X is not defined` after adding an import). A full page reload (`window.location.reload()` via `javascript_tool`) clears it; the source is fine.
- **prettier reflows on `--fix` can push a file over 350 LOC** (it expands a call to multi-line). After `eslint --fix`, re-check `pnpm lint:structure:enforce` and re-trim.
- **Headless ResizeObserver doesn't fire** in the preview browser, so canvas-size checks read the 800×600 default — that's a test-env artifact, not necessarily a prod bug (but V3 addresses the real fragility).
- **Server tsx-watch dies on a fatal bootstrap error** (e.g. a mid-edit stale import) and does NOT self-restart — `preview_stop` + `preview_start` it.

---

## 6. The units discipline (the crown-jewel correctness concern)

Three coordinate spaces, two of which look alike (plan §3): **screen px → world px → document px**, plus **grid cells** for tokens/props. Every geometry↔token boundary must convert with the shared helpers (`gridCellToWorldPoint`, `transformScenePoint`/`inverseTransformScenePoint`) — never inline math. A silent cells-vs-pixels mismatch has shipped here before and was only caught by adversarial review. When a slice touches geometry, the units lens is a mandatory review lens.

---

## 7. Your first move

1. Read `docs/planning/live-map-toolbar-plan.md` §0–§4 and the `herobyte-build-conventions` memory.
2. Confirm the tree is green: `pnpm typecheck && pnpm lint && pnpm lint:structure:enforce && pnpm test` (all pass as of the last commit).
3. Execute **S1** following §3's loop. It's server-only and fully test-provable — the ideal warm-up that proves the rails.
4. At the S2 gate, run your first adversarial review wave (§4) before proceeding.

Escalate to the owner (don't guess) on: anything a slice's Escalate-if names, any wire-protocol/secrecy decision, or any place the code contradicts the plan's capsule (the capsule's line numbers are from 2026-07-11 and shift as you edit — match on the quoted code, not the number, and flag real divergences).
