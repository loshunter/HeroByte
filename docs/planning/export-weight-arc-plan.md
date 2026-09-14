# The Weighed Campaign — the byte-weighed mint path — Execution Plan

**Status: W0–W2 SHIPPED to `dev` 2026-09-14, NOT merged to `main`; W3 open.** Picked by the owner on 2026-09-13 ("start one now")
from the Kicked-In Door plan's section 7, on this agent's recommendation: it is that plan's
highest open item and the one defect left there that a DM can hit by playing normally.

| Slice | What                                                             | Status                                       |
| ----- | ---------------------------------------------------------------- | -------------------------------------------- |
| W0    | One frame builder, one weigher, one ceiling — shared by 3 sites  | **SHIPPED to `dev` 2026-09-14** (`9fbd94e9`) |
| W1    | Every mint path weighs bytes before it persists                  | **SHIPPED to `dev` 2026-09-14** (`6d756ea7`) |
| W2    | The save path says the weight; the refusals say the numbers      | **SHIPPED to `dev` 2026-09-14** (below)      |
| W3 🟢 | A DM-facing readout of the campaign's weight (if budget remains) | PLANNED                                      |

## 0. How to execute this plan

- The ladder per slice is unchanged: `/verify-gates` (with ` e2e`; with ` boot` on W0 because
  `packages/shared` gains two runtime exports), then sabotage every new pin (red on its named
  case, source restored byte-identical), then commit. Bugs found on the way are fixed in their
  own commits regardless of origin (HANDOFF §8). Push only when the owner asks.
- Close the arc with `evaluate-live` (two clients — the refusal must reach the DM's panel, and
  the player tab must see nothing change) and a `review-convergence`-bounded review sized to
  FINISH (one workflow per lens, ≤ 9 agents each, 3 rounds, plateau stop).
- Prompting: the owner's standing instructions are `PROMPT-kicked-in-door-arc.md` §7; work by
  them (batch independent calls, surgical edits, finish the task, never poll a subagent).

## 1. Product goal

### 1.1 What the DM experiences when this ships

A DM kicks in doors at `large` until the table holds four generated buildings. The fifth kick
is refused in the kick panel with the real numbers — what the campaign's export would weigh
and what a table can load back in one message — and nothing about the table changes: no
half-minted document, no node, no door. The same refusal meets an Atlas GENERATE, a NEW MAP,
an IMPORT and the live map's GENERATE tool, because all five are mints. Saving a session says
the file's weight beside the map count, and warns — instead of congratulating — when a file
has grown past what the loader accepts (play grows a table too: tokens, drawings, suspended
scenes). Loading is unchanged: the client already refuses a frame the socket would drop.

The promise being restored is the one `MAX_SESSION_DOCUMENTS` was written for and cannot keep:
**a DM's own export always loads back.** Today the count cap (64) protects it only while the
average document stays under 16 KB, and one `large` building is 207–235 KB stored.

### 1.2 Scope boundaries

IN: the shared frame builder + byte counter + ceiling; the weigh on all five mint paths; the
inverted characterization test; the save-time weight/warning; the refusal copy; the DM guide.
OUT (recorded in §7, not licensed): chunking `load-session` across frames; raising
`maxPayload`; gating incremental edits (`map-studio-command`) or travel captures; reclaiming a
deleted node's document; `MAX_GEOMETRY_ELEMENTS`; the live GENERATE tool's recipe picker
(though W1's extraction gives it its home).

## 2. Architecture

### 2.1 What recon established (2026-09-14, at `dev` = `8e104dc4`)

- **The export is built server-side** in `RoomMessageHandler.handleSessionExport`
  (`apps/server/src/ws/handlers/RoomMessageHandler.ts:187`), from `toSnapshot(state, true, uid)`
  flattened by a file-local `flattenForFile` (line 50: drawings inlined, whispers and non-public
  rolls stripped, `mapBackground` kept), `mapStudioService.list(roomId)`, `liveMapDocumentId`
  and the schema-conforming `sceneStates`. **That file is at 342/350** — nothing new fits in it.
- **The frame the client sends** is built inline in
  `apps/client/src/features/session/useSessionManagement.ts:182` — exactly
  `{ t: "load-session", snapshot, mapDocuments, liveMapDocumentId, sceneStates }` — and weighed
  with `TextEncoder` against `WS_MAX_MESSAGE_BYTES` (line 201). The server test
  `sessionRoundTrip.contract.test.ts` carries a THIRD hand copy of the same shape (lines 538
  and 616). Three copies of one shape is the drift that would make a server-side weigh vacuous.
- **The mint paths are five, in three files:** `cashNode` (`atlasCash.ts:68` — shared by
  `atlas-generate-node` and `atlas-kick`), `map-studio-create` and `map-studio-import`
  (`MapStudioMessageHandler.ts:67`, `:223`, via `assertMintCeiling` at `:295`), and
  `map-studio-generate` (`:123–172`, a recipe landing as one `place-room` on an EXISTING
  document — a mint-sized growth with no mint). `MapStudioMessageHandler.ts` is at 331/350.
- **The recipe already runs against an in-memory mint FIRST** (`atlasCash.ts:88–102`,
  "VALIDATE-THEN-PERSIST"), and `applyMapDocumentCommand` (`packages/shared/src/mapStudioCommands.ts:81`)
  is pure — so the candidate document can be weighed BEFORE anything persists, no delete-on-
  the-way-out needed.
- **The deps that reach `cashNode`** are built in `AtlasMessageHandler.ts:97–121` with `state`
  and `senderUid` in scope; `MapStudioMessageHandler` holds `getRoomState(roomId)` and gets
  `senderUid` per message. Both can close over what a weigh needs.
- **The wire limit** is one shared constant, `WS_MAX_MESSAGE_BYTES` (`packages/shared/src/wsLimits.ts`,
  a sub-module value re-exported from the barrel — the runtime-erasure rule, HANDOFF §7).
- **The count cap** stays: `MAX_SESSION_DOCUMENTS` (`sessionValidators.ts:25`), pinned on all
  three create paths by `atlasGraph.contract.test.ts:571`.
- **The known-gap characterization** is `sessionRoundTrip.contract.test.ts:577`: six `large`
  buildings, well under the count cap, produce a frame over the wire limit. It says "invert
  it the day this is fixed". This arc inverts it.
- **The refusal surfaces already exist:** `atlas-error` with `code: "at-cap"` reaches the kick
  panel (`useKickedInDoor.ts:211`) and the Atlas generate panel; a thrown error from
  `MapStudioMessageHandler` is routed to the sender as an error the client toasts (pinned by
  the count-cap test's `console.error` spy — W1 verifies what the DM actually SEES).

### 2.2 The design

**One shape, one counter, one ceiling — in `packages/shared`.**

- `packages/shared/src/sessionFrame.ts` (new sub-module, value re-exported from the barrel):
  - `loadSessionFrame(file)` → the `load-session` `ClientMessage`, built from a `SessionFile`
    (or the bare parsed shape the client's loader produces): the five keys and nothing else —
    never `assets`, never `savedAt`.
  - `utf8ByteLength(text)` → bytes as ws counts them (`TextEncoder`, global in every runtime
    HeroByte targets).
  - `loadSessionFrameBytes(file)` = `utf8ByteLength(JSON.stringify(loadSessionFrame(file)))`.
- `packages/shared/src/wsLimits.ts` gains **`SESSION_MINT_CEILING_BYTES`** =
  `WS_MAX_MESSAGE_BYTES * 3 / 4` (786,432). A MINT is refused when the export it would produce
  weighs more than this; the remaining quarter is for play — tokens, drawings, suspended
  scenes — which no mint gate can see. **This is the product decision the Kicked-In Door plan
  deferred, made here and dialled by one constant:** at `large` a table holds four generated
  buildings, not five; at `medium` about nine. The wire limit itself does not move.

**The server weighs the export it would write — `apps/server/src/domains/room/sessionExport.ts`
(new).**

- `buildSessionFile(state, mapDocuments, senderUid, now)` — the body of `handleSessionExport`
  moved whole (with `flattenForFile` and the scene filter), so the handler shrinks and the
  export has one author. The export's CONTENT stays characterized by `sessionRoundTrip.contract.test.ts`'s eighteen pins (flattened drawings, stripped whispers and private rolls, kept `mapBackground`, envelope-only scenes, a file the loaders read), which now load through the very frame they weigh; a direct unit test pins the builder's own contract.
- `mintOverflow(state, documents, senderUid)` → `{ bytes, ceiling } | null`: builds the file
  for `documents` (the room's list with the candidate added or replaced) and weighs its load
  frame against the ceiling. Returns the numbers, never a string, so the two refusal surfaces
  format one message from one source (`mintRefusal(overflow)` in the same module).

**Every mint path asks before it persists.**

- `cashNode`: after the pure recipe run, `applyMapDocumentCommand(minted, placeRoom)` yields
  the candidate; `deps.weighMint(candidate)` (a new `AtlasCashDeps` member, closed over
  `state` + `senderUid` by `AtlasMessageHandler`) refuses with `code: "at-cap"` and the numbers.
  Order inside `cashNode`: count cap → recipe → budget → **byte cap** → persist.
- `MapStudioMessageHandler.assertMintCeiling(roomId, senderUid, candidate)`: count first, then
  bytes. `create`'s candidate is `createMapDocument(input)` (pure, shared); `import`'s is the
  incoming document as `restore` would store it; `generate`'s is the post-apply document
  REPLACING its current version in the list. The generate case moves to
  `mapStudioGenerate.ts` (the extraction §7 of the Kicked-In Door plan already asked for) so
  the handler stays under the cap and the live tool's future recipe picker has a home.
- A refusal persists nothing and broadcasts nothing — pinned by list-length and
  `map-studio-document` frame counts on every path.

**The client tells the truth at both ends.**

- Load: `useSessionManagement.ts` builds its frame with `loadSessionFrame` and weighs it with
  `loadSessionFrameBytes` — the inline literal and the inline `TextEncoder` go. Behaviour
  unchanged; the test that proves "too large to load" stays green through it.
- Save: after the server's `session-file` lands, weigh `loadSessionFrame(file)`. Under the
  wire limit: the success toast carries the weight ("3 maps, 0.61 MB"). Over it: the file is
  STILL saved — the bytes are the DM's — but the toast is a warning that says it will not load
  back and why, with both numbers. (Play can grow a table past the wire limit even when every
  mint was under the ceiling; this is where that becomes visible before the day it matters.)

### 2.3 Settled by this plan

- The mint ceiling is a FRACTION of the wire limit, not a second absolute — moving the wire
  limit moves both. Three quarters is the dial; the reasoning is in §2.2.
- The candidate is weighed PURELY (shared `applyMapDocumentCommand`), never persisted-then-
  deleted; a refusal leaves no trace, matching `cashNode`'s existing contract.
- `load-session` is NOT gated by the mint ceiling. A loaded table between the ceiling and the
  wire limit is legal; it simply cannot mint until the DM deletes a map — the refusal says so.
- Incremental growth (`map-studio-command`, travel captures, tokens, drawings) is NOT gated:
  the cost would be a 1 MiB stringify per wall drawn, and the save-time warning is the
  catch-all. Recorded in §7 with the measured headroom.
- The count cap stays. A mint clears both or neither.

## 3. Invariants (every slice cites the ones it proves)

- **W.1** The frame the client sends for `load-session` and the frame the server weighs are
  built by ONE function; a key added to either side alone fails a test.
- **W.2** A mint whose export would exceed `SESSION_MINT_CEILING_BYTES` is refused on every
  mint path (kick, atlas generate, create, import, live generate) BEFORE anything persists.
- **W.3** A refusal names both numbers (would-be bytes, ceiling), reaches the DM who asked,
  and reaches nobody else.
- **W.4** The count cap is unchanged and still enforced on the same paths.
- **W.5** Six `large` buildings can no longer be minted into one table; the export of a table
  at the ceiling loads back onto a wiped server in one frame.
- **W.6** A saved file that would not load back is saved AND warned about, with the numbers.
- **W.7** `packages/shared`'s new exports are sub-module values (the dev server boots).
- **W.8** Nothing player-visible changes: no new field on any player frame, no new message type.

## 4. Slices

### W0 — the builder, the counter, the ceiling

- Shared: `sessionFrame.ts` (+ barrel re-exports), `SESSION_MINT_CEILING_BYTES` in `wsLimits.ts`.
- Server: `sessionExport.ts` with `buildSessionFile` moved out of `RoomMessageHandler.ts`;
  the handler calls it. The same module ships `mintOverflow`, `mintRefusal` and
  `withCandidate` UNWIRED — W1 wires them into the five mint paths. `sessionRoundTrip.contract.test.ts`'s two hand-built frames go
  through `loadSessionFrame`.
- Client: `useSessionManagement.ts` load path through the shared builder + counter.
- Pins: shared `sessionFrame.test.ts` (five keys exactly; `assets`/`savedAt` never; UTF-8
  counted, not UTF-16 — a name with a 3-byte character); server `sessionExport.test.ts` (the builder's direct contract — the documents it is handed, the binding, only schema-conforming scenes and loudly; the weigher measures the SAME builder with the candidate list; the refusal names both numbers); client: the existing
  "too large to load" test green through the shared builder + a key-set assertion on the sent
  frame. Proves W.1, W.7 (boot gate ON).
- Sabotage: drop `sceneStates` from the shared builder → the client key-set pin AND the server
  round-trip's suspended-scene assertions go red; count UTF-16 → the UTF-8 pin goes red.

### W1 — every mint path weighs bytes

- Server: `mintOverflow` + `mintRefusal` in `sessionExport.ts`; `cashNode` weighs the pure
  candidate (new `weighMint` dep, wired in `AtlasMessageHandler` for both callers);
  `assertMintCeiling` takes the candidate; `map-studio-generate` extracted to
  `mapStudioGenerate.ts` and weighed; `map-studio-import`'s candidate is what `restore` stores.
- Invert the characterization: "the mint path refuses the building that would overflow, the
  export of the table at the ceiling weighs under the wire limit, and it loads back onto a
  wiped server whole" — and the refused mint left no document, no node, no broadcast.
- Pins (contract, through the real router): refusal on all five paths with both numbers in
  the reason; nothing persisted; the count cap's test untouched and green; the `atlas-error`
  goes to the sender only (the player socket sees no frame). Proves W.2–W.5, W.8.
- Sabotage: delete the byte check in `cashNode` → the kick/generate refusals go red while
  create/import stay green (and vice versa), so each site is pinned on its own; return the
  ceiling instead of the bytes → the numbers pin goes red.

### W2 — the save path says the weight; the DM sees the refusal

- Client: the save toast carries the frame's weight; over the wire limit it warns instead
  (the file still downloads). Verify what a `map-studio-create` refusal actually shows the
  DM (the routed error toast) and fix the copy if it is the raw thrown text.
- Docs: `docs/user-guide/dm-guide.md` gains "How big can a campaign get" (the two caps, what
  the refusal says, what to do); the in-app help topic if one names the 64-map cap.
- Pins: `useSessionManagement.test.ts` — save over the limit warns with both numbers and still
  calls `saveSessionFile`; under it, the success toast names the weight. Proves W.6.
- Sabotage: skip the weigh on save → the warning pin goes red.

#### W2 — what shipped (2026-09-14)

- **Found on the way and fixed regardless of origin, its own commit:** a refused NEW MAP or
  IMPORT JSON BACKUP reached NO DM screen — those messages carry no `commandId`, so the router's
  nack never fires, and the handler's thrown error only reached the server log; the Map Studio
  panel spun until its watchdog blamed the server. This predates the arc (the COUNT cap has been
  silent since it shipped). Now `MapStudioMessageHandler.refuseMint` answers with a
  `map-studio-error` (`commandId: ""`, the document id the client minted) and `useMapStudio`
  releases the load and shows the reason — for the count cap, the byte ceiling and a duplicate
  import alike. Pinned on both ends; the graph contract's create/import cases now assert the
  FRAME the DM sees, not a `console.error`.
- The save toast says the weight ("3 maps included; 0.61 MB of the 1.00 MB a load accepts");
  over the wire limit the file still downloads and the toast is a WARNING with both numbers.
- Copy: `dm-guide.md` "How big can a campaign get?"; the help entry for SAVE GAME STATE.
- Sabotage 3/3 red on the named cases.

### W3 🟢 — the readout (only if budget remains; else §7 and say so)

`map-studio-documents` (the list the DM already requests) carries `exportBytes`; the desktop
DM menu's Atlas tab and the phone's DM screen show "Campaign 0.61 / 0.75 MB". No new message
type; the three `ServerMessage` hand-lists stay byte-identical.

## 5. Failure drills

- **Boot fails after W0 while every gate is green** → the barrel-const trap: the new export is
  a direct `export const` in `index.ts`. It must be a value re-export from the sub-module.
- **The characterization inversion is green with the check deleted** → the test is measuring
  an empty shell: assert `elements.length > 50` on every document that exists (the existing
  guard-the-guard), and assert the refusal's `bytes` is greater than its `ceiling`.
- **A weigh throws inside `cashNode`** (a malformed scene in `sceneStates`) → the export
  filter already skips malformed scenes loudly; the weigher must use the same filter, never a
  raw `Object.values`.
- **`MapStudioMessageHandler.ts` crosses 350** → the generate extraction comes FIRST in W1's
  commit sequence, not last.
- **The client save test cannot see the toast** → `useToast` returns its id (K2); assert on
  the mock's call args, not on rendered text.

## 6. Command crib sheet

```
pnpm --filter @herobyte/shared build          # after any shared change, before server tests
pnpm --filter @herobyte/server exec vitest run src/ws/__tests__/sessionRoundTrip.contract.test.ts
pnpm --filter @herobyte/server exec vitest run src/ws/__tests__/atlasGraph.contract.test.ts
pnpm --filter @herobyte/server exec vitest run src/ws/__tests__/atlasKick.contract.test.ts
pnpm --filter @herobyte/client exec vitest run src/features/session/__tests__/useSessionManagement.test.ts
pnpm lint:structure:enforce                   # the 350 guard, NOT part of pnpm lint
```

## 7. Deferred follow-ups (recorded, not licensed)

- **Chunked `load-session`** — the only fix that lets a campaign outgrow one frame. It changes
  the wire (a multi-frame envelope with a commit), the validators and both loaders; the
  ceiling above makes it unnecessary at friends scale.
- **Gating incremental growth** — `map-studio-command`, travel captures, tokens and drawings
  add bytes no mint gate sees; the quarter of headroom and the save-time warning cover it.
  If a table is ever found past the wire limit with every mint under the ceiling, the fix is a
  cached per-document weight (by revision) summed on each command, not a stringify per wall.
- **Reclaiming a deleted node's document** (the Kicked-In Door plan's lifecycle gap) — now
  more pressing, since the ceiling makes a forgotten 230 KB document cost a kick.
- **The live GENERATE tool's recipe picker** — W1's extraction gives it `mapStudioGenerate.ts`.
- **`MAX_GEOMETRY_ELEMENTS`** — still declared, never enforced; enforce or delete.
- **W3 if skipped.**
