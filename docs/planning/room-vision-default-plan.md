# Room-level default vision radius — slice plan

> **SHIPPED to `dev` 2026-08-11 — nine commits, `120103f8..df6e1103`, CI green (#777).
> NOT merged to `main`, so not deployed.** Baselines moved: shared 414→424, server
> 2080→2108, client 5233→5247, e2e 128→129. Six build commits, then three from the
> adversarial review (19 agents, `agents_error: 0`; 6 raw findings, 3 survived).
>
> **Three things below turned out to be WRONG. Sabotage caught each; reading did not.**
>
> 1. **§3 commit 1 cannot ship the `ClientMessage` union member without its validator.**
>    `messageValidators` is a mapped type over `ClientMessageType`, so the member alone is
>    a compile error. It moved into commit 2 alongside the validator.
> 2. **§5 trap 1 names the wrong guard.** The snapshot-payload contract test does not go
>    red when `visionSignature` loses the default, and structurally cannot:
>    `recipientFilter` rebuilds vision on every broadcast and never consults the cache.
>    The cache serves the per-recipient RELAY path (`pointer-preview` through
>    `getVisionContextFor`) — which is where S7 put its own staleness tests, and where the
>    real guard now lives.
> 3. **§2 item 8's "reuse `VisionRadiusField` as-is" shipped a lie.** This slice changed
>    what an empty per-token radius MEANS — from "unlimited" to "inherits the table
>    default" — and the per-token control went on lighting **Unlimited** with the tooltip
>    "Sight is stopped only by walls" while the server clipped that token. Fixed in
>    `8d955b45` by an `inheritsTableDefault` flag on the per-token surface only.
>
> **Two parameters were made REQUIRED against the plan, deliberately:** `fogViewers`' new
> argument and the `DMMenu` forwarding pin. An optional one can be deleted with ZERO
> typecheck errors and every suite green — the M4b defect shape, reproduced twice here.
>
> **Follow-ups, none of them defects:** ~~the per-token card says "Table Default" but not the
> inherited NUMBER (needs a new field through `MainLayoutProps` → `EntitiesPanel` →
> `PlayerCard` → `MobilePlayerRow`, plus four layout fixtures)~~ — **DONE 2026-08-27**: the
> number went in the PLACEHOLDER ("Table default — 60 ft") rather than the button label,
> because the empty box is the one part of that control that is about what is currently in
> force. `tableVisionDefault` rides the same route `onTokenVisionRadiusChange` already
> takes, so no layout fixture moved. It is OPTIONAL and therefore droppable with a green
> typecheck, which is why the guard is an e2e over the whole chain rather than a unit test
> on the field. **And it turned up a real gap while being wired:** the DM's OWN card is a
> separate render in `EntitiesPanel` and had never been given the sight control at all,
> though `PlayerSettingsMenu`'s own note says "a DM sets the darkness on every token,
> including their own". Now wired, same gate as the player section.
> `img/dm-menu-map-setup.jpg`
> predates the new panel and was deliberately not re-recorded; ~~DM-menu controls on mobile
> are sub-44px exactly like every neighbour on that tab, which is the panel-wide pass the
> handoff already identified for the chat SEND button~~ — **DONE 2026-08-27**: the pass
> landed as one `(pointer: coarse)` rule scoped to `[data-mobile-surface]` rather than to
> any component's class, because the reused panels are a wide family and a class list is
> something the next panel silently falls off. All five DM tabs are asserted clear in
> `apps/e2e/mobile/mobile-panel-touch-floor.spec.ts`.

Owner chose this slice on 2026-08-11, over M5 of the mobile authoring arc. Every path and line
number below was verified against `dev` = `5b79f1aa` on 2026-08-11 by reading the files, not from
memory. Where something is a judgement call rather than a fact, it says so. Read
`docs/planning/HANDOFF-NEXT.md` §2/§5/§7/§8 first if you have not — the gate, the traps and the
owner's method all apply here and are not repeated in full.

## 0. What this closes, and why it is next

S7 shipped per-token sight radii. A radius is DM-authored, lives on ONE token record, and vision is
the UNION over every token an owner has — so `createToken` inherits the owner's tightest existing
limit ([service.ts:72-87](../../apps/server/src/domains/token/service.ts)). That closes the
"+ Add Character" hole and leaves exactly one, documented in the code itself at
[service.ts:80-83](../../apps/server/src/domains/token/service.ts):

> KNOWN GAP: this cannot help when the player has no tokens left to inherit from — deleting your
> only token and reconnecting still respawns an unlimited one. Closing that needs a room-level
> default; see the arc note on S7.

The respawn is real and automatic: a reconnecting player with no token gets one at
[AuthenticationHandler.ts:196-205](../../apps/server/src/ws/auth/AuthenticationHandler.ts), where
`tightestVisionRadius` finds nothing and the token spawns with unlimited sight. Neither the player
nor the DM gets any signal that the darkness is gone.

The fix is also the feature a DM wants anyway: **"this dungeon is dark" as a table setting** —
one default radius on the room, applying to every token that has no explicit radius of its own,
instead of a per-token chore that silently resets.

## 1. The system as it stands — verified facts

| thing                      | where                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `Token.visionRadius?` FEET | `packages/shared/src/index.ts:179` (doc comment at :175: DM-set, deliberately not player-owned)    |
| feet→document conversion   | `packages/shared/src/visionRadius.ts:54-98` `tokenVisionRadius` — BOTH halves of the app call this |
| bounds + coercers          | `visionRadius.ts:109-110` ([0, 1000] feet), `:122` `coerceVisionRadius`, `:134` token-list variant |
| server payload filtering   | `apps/server/src/domains/room/scene/visionFilter.ts:51-63` — `radiusFeet: token.visionRadius` :56  |
| vision cache signature     | `visionFilter.ts:101-122` `visionSignature`; consumed at `ws/messageRouter.ts:554`                 |
| client fog viewers         | `apps/client/src/features/map/playerLens.ts:63-73` — `radiusFeet: token.visionRadius` :71          |
| client fog call site       | `apps/client/src/ui/MapBoard.tsx:813` `fogViewers(snapshot.tokens ?? [], uid, lens, grid.size)`    |
| fog memo key               | `features/map/components/FogLayer.tsx:91-92` — `viewersKey` already includes each `radiusFeet`     |
| create-time inheritance    | `apps/server/src/domains/token/service.ts:40-49` + `:72-87`                                        |
| per-token set path         | shared `:703` → `validation.ts:145` → `tokenValidators.ts:86-108` → `TokenDispatcher.ts:59`        |
| per-token UI               | `features/players/components/VisionRadiusField.tsx` — value `?: number`, `onChange(number\|null)`  |
| RoomState + empty state    | `apps/server/src/domains/room/model.ts:36-69`, `:74-105`, `toSnapshot` `:121-191`                  |
| state file save/load       | `domains/room/persistence/StatePersistence.ts:249` save block, `:140-155` load-with-coercion       |
| session file load          | `domains/room/snapshot/SnapshotLoader.ts:175-191`                                                  |
| room-setting handler       | `ws/handlers/SceneMessageHandler.ts` (85 LOC) — fog `:26`, diagonal `:41`, player-props `:51`      |
| DM menu wiring precedent   | `features/dm/components/DMMenuContainer.tsx:259-264` — snapshot read + INLINE `sendMessage`        |
| DM menu Map tab            | `features/dm/components/tab-views/MapTab.tsx:181-187` — the `FogControl` slot                      |
| existing e2e               | `apps/e2e/vision-radius.smoke.spec.ts` (182 lines) — generate-a-dungeon rails, two contexts        |
| existing contract test     | `apps/server/src/ws/__tests__/visionRadius.contract.test.ts` (300 lines, exempt from LOC guard)    |

**The template to mirror is `playerPropsEnabled`** — the most recent room-level DM setting, shipped
2026-08-11, and its chain touches every layer this slice needs: `model.ts:64/:103/:158`,
`StatePersistence.ts:153/:249`, `SnapshotLoader.ts:189`, `SceneMessageHandler.ts:51-61`,
`propValidators.ts:73`, `validation.ts:225`, shared `index.ts:559` (wire field) and `:856`
(message), `DMMenuContainer.tsx:259-264`, `SessionTab.tsx:131-163` (the control). Diff those sites
before writing anything.

LOC headroom (guard ceiling is 348; `scripts/structure-report.mjs --fail-on-new` fails only NEW
violators, but the discipline for baselined-over files is extract-don't-grow): SceneMessageHandler
85, roomValidators 206, model 191, StatePersistence 317, SnapshotLoader 229, visionFilter 122,
playerLens 73, MapTab 217, DMMenu.types 121, DMMenuContainer 269, VisionRadiusField fine.
Already-over, keep additions to a line or two: `MapBoard.tsx` 883, `EntitiesPanel.tsx` 700,
`packages/shared/src/index.ts` 982. `StatePersistence.ts` at 317 has ~30 lines of headroom —
comments are what push files over (HANDOFF §5); keep them terse, reasoning goes in commit messages
and tests.

## 2. Design — decided

1. **Resolution is READ-TIME, not stamp-at-create:**
   `effective = token.visionRadius ?? room.defaultVisionRadius ?? unlimited`. The DM changing the
   default applies immediately to every token with no explicit radius, which is the entire point of
   a table setting — and the respawn gap closes with zero changes to `createToken` or
   `AuthenticationHandler`, because the fresh token simply has no explicit radius. Note `??`
   semantics deliberately: an explicit radius of **0 (blind) beats the default**, because 0 is not
   nullish. Stamp-at-create was rejected: it freezes the default's value into the token and makes
   "loosen the darkness" a per-token chore again. _(This is the slice's one judgement call — if the
   owner pushes back, everything else survives the pivot.)_
2. **S7 inheritance is untouched.** Precedence, documented wherever it matters:
   explicit/inherited token radius → room default → unlimited. A player whose token was
   individually darkened and who adds a second token still inherits the tight value (S7 behaviour);
   the default only catches tokens with nothing at all.
3. **`RoomState.defaultVisionRadius: number | null`, REQUIRED.** `null` = no default (today's
   behaviour). Required on purpose so every state literal in the codebase must decide — that is the
   fixture ripple (§4), and it is deliberate, per HANDOFF §3B.
4. **Wire: `RoomSnapshot.defaultVisionRadius?: number`, optional, omitted when `null` — and sent to
   EVERY recipient.** Players compute their own fog client-side, so this is a table rule like
   `diagonalRule`, not a secret and NOT DM-only. Gate it behind `isDM` and the feature silently
   does nothing for the people it exists for (§5 trap 2).
5. **Message: `{ t: "set-default-vision-radius"; radius: number | null }`** — payload mirrors
   `set-token-vision-radius` (shared `:703`) minus `tokenId`. DM-gated by an inline
   `if (!isDM) throw` in `SceneMessageHandler`, exactly like `set-fog-enabled` — NOT
   `AuthorizationService.requiresDMPrivileges`, which is dead code (HANDOFF §5).
6. **One resolver, both halves call it.** Add to `packages/shared/src/visionRadius.ts`:
   `effectiveVisionRadiusFeet(tokenRadiusFeet: number | undefined, defaultRadiusFeet: number | null | undefined): number | undefined`.
   The file's own header (:4-9) states the doctrine: spelling a conversion chain twice is how
   client fog and server filtering come to disagree. Same rule for the fallback.
7. **Untrusted reads get a coercer:** `coerceDefaultVisionRadius(value: unknown): number | null` —
   finite number → clamped to [0, 1000]; anything else (including ABSENT — every state file on the
   production disk predates this field) → `null`. Used by `StatePersistence` load and
   `SnapshotLoader`. Mirrors `coerceVisionRadius` (:122) which returns `undefined`; the default's
   "no value" spelling is `null`, hence a second small function rather than reuse.
8. **UI: a `DefaultVisionControl` on the Map tab**, rendered beside `FogControl`
   (`MapTab.tsx:181-187`) — it is a fog/sight setting, not a session toggle. **Reuse
   `VisionRadiusField` as-is** (it already does feet, presets, null-to-clear, `compact`). Value
   comes from `snapshot?.defaultVisionRadius` in `DMMenuContainer` with an inline `sendMessage`,
   copying the `playerPropsEnabled` precedent at `:259-264` and its comment — `useDMContext` sits
   at 347 of 348 and must not gain a line. New props thread `DMMenuContainer → DMMenu → MapTab` as
   two optional fields; **nothing touches `MainLayoutProps` or `buildDMMenuProps`** (the props
   toggle proved the route).
9. **NPC and DM tokens: the default is inert for them**, exactly as per-token radii are — vision
   polygons are built only from the RECIPIENT'S own tokens (`visionFilter.ts:51-52`), the DM is
   never filtered, and the owner has ruled NPC radii inert (HANDOFF §9). No special-casing, and do
   not "fix" it.
10. **Naming: `defaultVisionRadius`** everywhere (state, wire, message field), matching
    `visionRadius`.

## 3. Build order — six commits, each through the full gate

Run `/verify-gates` after every edit burst; the §2 gate of HANDOFF-NEXT applies before every
commit. Boot `pnpm dev` once after commit 1 (shared changed — HANDOFF §7; the new exports go in
`visionRadius.ts`, which is already a re-exported sub-module at `index.ts:59`, so the barrel guard
stays green, but boot anyway).

1. **`feat(shared): a table default for sight, resolved in one place`** —
   `effectiveVisionRadiusFeet` + `coerceDefaultVisionRadius` in `visionRadius.ts`; the
   `RoomSnapshot.defaultVisionRadius?: number` wire field next to `playerPropsEnabled` (:559); the
   `set-default-vision-radius` member in the `ClientMessage` union next to :856. Tests beside the
   existing shared suites (visibility.test.ts is the S7 home; a new `visionRadius.test.ts` is also
   fine): precedence including 0-beats-default, clamping, junk→null, absent→null.
2. **`feat(server): rooms carry a default vision radius`** — `RoomState` field + doc comment
   (model.ts:64 area), `createEmptyRoomState` gets `defaultVisionRadius: null` (:103 area),
   `toSnapshot` sends it when non-null (:158 area — see §5 trap 3 for the exact predicate),
   `StatePersistence` save (:249 block) + coerced load (:153 area), `SnapshotLoader` coerced load
   (:189 area), the `SceneMessageHandler` branch (inline DM throw, store,
   `{ broadcast: true, save: true }`), `validateSetDefaultVisionRadiusMessage` in
   **`roomValidators.ts`** (mirror `tokenValidators.ts:86-108`, import the shared bounds), registered
   in `validation.ts`'s import block and `messageValidators` table. Then the fixture ripple (§4).
   Tests: `SceneMessageHandler.test.ts` (gate + store + result flags), `validation.test.ts`
   (validator: null ok, 0 ok, 1000 ok, 1001 refused, string refused — this file, NOT a router test;
   `route()` runs after validation, HANDOFF §5), `StatePersistence.test.ts` (round-trip; a literal
   legacy JSON with NO key loads as `null`; junk clamps), `SnapshotLoader.test.ts` (same two),
   `sessionRoundTrip.contract.test.ts` (field survives save→load).
3. **`feat(server): the vision filter falls back to the table default`** — `visionFilter.ts:56`
   becomes `radiusFeet: effectiveVisionRadiusFeet(token.visionRadius, state.defaultVisionRadius)`,
   and `visionSignature` gains `state.defaultVisionRadius ?? ""` in its array (§5 trap 1 — this
   line is the slice's landmine). Rewrite the `service.ts:80-83` KNOWN GAP comment to a one-liner
   pointing here (net-negative lines). Tests: `visionFilter.test.ts` (fallback resolution; explicit
   beats default; signature CHANGES when only the default does), and extend
   `visionRadius.contract.test.ts`: with fog on and a default set, an entity outside the default
   radius is stripped from a player's payload **without any token having moved**, reappears when
   the default clears, and a respawned-after-delete token is clipped by the default (the §0 gap,
   driven through the real router).
4. **`feat(map): player fog respects the table default`** — `fogViewers` gains a
   `defaultRadiusFeet?: number` parameter and resolves via `effectiveVisionRadiusFeet`
   (playerLens.ts:63-73); `MapBoard.tsx:813` passes `snapshot?.defaultVisionRadius`. `FogLayer`
   needs nothing — its `viewersKey` (:91-92) already keys on each viewer's resolved `radiusFeet`.
   Tests: playerLens unit tests (fallback, explicit-beats-default, 0-beats-default, lens union uses
   it too — the DM's player-lens must show the darkness the table sees, :54-62's own doc says why).
5. **`feat(dm): the table's default sight radius, set from the Map tab`** — `DefaultVisionControl.tsx`
   (new, ~70 lines, sibling of `FogControl`), rendering `VisionRadiusField`; two optional props
   through `DMMenu.types.ts` → `DMMenu.tsx` → `MapTab.tsx`; `DMMenuContainer` supplies
   snapshot value + inline send. **The mobile surface ships in this same commit for free** — the
   M4b DM screen renders the full menu from the same lazy chunk — but "free" is measured, not
   assumed: re-run `mobile-dm.spec.ts` (its fit guards cover both phone viewports) and eyeball the
   Map tab on the phone layout in the browser pane. Tests: a `DefaultVisionControl` unit test
   (renders value, null-clear sends, no-op blur stays silent — `VisionRadiusField` already
   guarantees most of this) and a `DMMenuContainer` wiring assertion beside the
   `playerPropsEnabled` one if one exists.
6. **`test(e2e) + docs: the dark table stays dark`** — new spec `apps/e2e/vision-default.spec.ts`
   (NOT appended to `vision-radius.smoke.spec.ts`; e2e specs are LOC-guarded, HANDOFF §5). Rails
   from the smoke spec: DM context starts a live map and generates the dungeon, player context
   joins; DM sets the default via the REAL Map-tab control (not `sendMessage` — the control is what
   this slice adds); assert the player's snapshot tokens/entities strip and the fog canvas clips;
   clear it; assert restored. If the harness allows a clean player-token delete + reconnect, drive
   the §0 respawn once — if not, the contract test from commit 3 already pins it; say which in the
   commit message. Same commit: `helpTopics.ts:213`'s fog topic gains one sentence about the table
   default (S8 rule: behaviour the manual describes changes in the same slice), and grep
   `docs/user-guide/` for the sight-radius prose and extend it. Do NOT re-record screenshots — two
   of the five walkthroughs are known-broken pre-existing (HANDOFF §0), and this adds no new
   screenshot subject.

## 4. The fixture ripple — expected, mechanical, delegated

Making the field required breaks exactly the five files HANDOFF §5 names — the TS2741 sites that
hand-build `RoomState` literals:

- `ws/__tests__/messageRouter.test.ts`
- `ws/__tests__/characterization/authorization.characterization.test.ts`
- `ws/__tests__/characterization/error-handling.characterization.test.ts`
- `ws/services/__tests__/AuthorizationService.test.ts`
- `ws/__tests__/sessionRoundTrip.contract.test.ts`

(Production code has only three literal builders — `model.ts`, `StatePersistence.ts`,
`SnapshotLoader.ts`, verified by grepping `fogEnabled:` — and all three are edited by this slice
itself. Suites built on `createEmptyRoomState` don't ripple.)

After the commit-2 type change, run typecheck, then **use `/fix-fixture-ripple` with the stated
default `defaultVisionRadius: null`** rather than hand-editing five files from the orchestrator
context. It re-typechecks to zero and runs the touched suites.

## 5. Traps — ranked by what they cost

1. **`visionSignature` must gain the default, or the feature looks unsent.** S7 wrote the warning
   into the function itself (`visionFilter.ts:89-99`): every input the polygon reads must appear in
   the key, or the router serves a stale filter. Without it, the DM sets the default and NOTHING
   changes for any player until some token happens to move — presenting as "the message never
   sent". The commit-3 contract test asserts a payload change with no token movement precisely so
   a sabotage of this line goes red.
2. **The snapshot field is for players.** The instinct that a DM setting is DM-chrome (like
   `liveMapDocumentId`, which IS `isDM`-gated in `toSnapshot`) ships a feature that works in the
   DM's own fog preview and does nothing at every player's screen — silently, since the server
   filter (commit 3) still strips payloads and the two halves then DISAGREE, which is the exact
   state S7's shared-resolver doctrine exists to prevent. The e2e in commit 6 catches it; so does
   any unit test asserting a non-DM `toSnapshot` carries the field.
3. **`radius: 0` is a real value.** A blind-by-default table ("total darkness, torches only when
   lit") must survive every truthiness temptation: `toSnapshot` sends on `!== null` (NOT
   `if (state.defaultVisionRadius)`), the coercer clamps-not-rejects 0, and `??` (never `||`) does
   the resolution. Test 0 explicitly at every layer — shared resolver, filter, client, wire.
4. **Every state file on the production disk lacks the key.** `main` deploys on push and the Render
   disk persists across deploys (HANDOFF §0 / deploy model): the first boot after shipping READS
   old files. The coercer's absent→`null` path is that boot. The `StatePersistence` legacy-JSON
   test is not optional, and the dev-server boot in §3 is the belt to its braces.
5. **New message type = validator registration or it never runs.** The `messageValidators` table is
   exhaustive-by-construction (a missing entry is a compile error; an unregistered type at runtime
   returns "Unknown message type"). And validator coverage lives in
   `middleware/__tests__/validation.test.ts` — a router test proves nothing about the validator
   because `route()` runs after validation. Three slices have paid for this one.
6. **The gate is the inline throw.** Do not add the message to
   `AuthorizationService.requiresDMPrivileges` — it has no runtime caller and its test asserts
   hard-coded name lists, so you'd write a green test for a gate that does not exist.
7. **LOC and prettier.** Prettier EXPANDS files — re-measure after formatting
   (`lint:structure:enforce` after every burst). Tests and `__tests__` are exempt; the new e2e spec
   is NOT. Keep the new control ~70 lines; keep comments to one line each.
8. **E2E locators.** `getByRole` matches the ACCESSIBLE name, not `title`; prefer exact strings
   (the smoke spec's own helpers show the house style). The e2e map canvas is short — anchor
   interactions by canvas fraction.
9. **Explored fog will not retro-darken, and that is by design.** A player who explored under
   unlimited sight keeps their client-local explored mask after the DM sets a default; explored fog
   is explicitly not a privacy boundary (owner decision, HANDOFF §9). Do not file it, do not "fix"
   it.
10. **Windows + harness basics** (HANDOFF §5): Bash cwd persists between calls; no `git add <dir>`
    ever — stage every file by explicit path (the owner's `temp/` art lives untracked in the tree);
    package-relative paths for single-file vitest runs.

## 6. Verification — beyond the gate

The full §2 gate before every commit, plus:

- **Boot `pnpm dev`** after commit 1 (and ideally after 2): five green suites cannot see a broken
  dev boot (HANDOFF §7). Use the Browser pane launch config, never Bash.
- **Sabotage each guard once it exists, then revert** (owner method, HANDOFF §8 — prove RED, and
  prove the strengthened test can PASS): (a) drop the fallback in `visionFilter.ts` → commit-3
  contract test red; (b) drop the default from `visionSignature` → the no-token-moved contract test
  red — this is the sabotage that matters most; (c) drop the client fallback in `fogViewers` →
  playerLens unit red + e2e red; (d) make `toSnapshot` omit the field for non-DM → e2e red;
  (e) let the validator accept 5000 → validation test red.
- **A real phone or the resized browser pane** for the Map tab after commit 5 — measured, not
  computed (owner rule). The fit is guarded by `mobile-dm.spec.ts`, not by hand, but look anyway.
- Full e2e with `--reporter=list` and READ THE SUMMARY LINE — flaky reports as pass otherwise.
  Baseline going in: **122 passed / 0 failed / 3 skipped** (HANDOFF §0); this slice should move it
  by exactly the new spec's count.

## 7. Owner decisions already made — do not re-ask, do not re-file

- Main Hall is public on purpose, `Fun1`/`FunDM` published — not a finding.
- `uid` is client-asserted at friends scale — not a vulnerability for this slice to fix.
- NPC token radii are inert and their control was removed deliberately.
- Explored fog is client-local and not a privacy boundary.
- Fog does not cover the void outside the published map rect (staging zones live there) —
  `isWorldPointVisible` returns true out there (`visionFilter.ts:70-74`), and the DEFAULT MUST NOT
  change that.
- Every slice ships its mobile surface in the same slice.
- Commit to `dev` as you go; **never push or merge to `main` unprompted** — `main` IS production
  and deploys ungated the moment it moves.

## 8. After this slice — known, not queued

- **The mobile party drawer renders one row per PLAYER** (first character only), so a phone DM
  cannot reach a second character's HP, portrait or sight controls at all
  (`MobilePlayerRow.tsx:37` takes "this player's token"). Making it per-character is the natural
  next small slice, and it is adjacent to this one's subject.
- The mobile authoring arc's M5–M8 (`docs/planning/mobile-authoring-arc.md` §4) remain the owner's
  other open road.
- The rest of HANDOFF-NEXT §3D (prompt()-based portrait URLs, SEND tap target, client-side
  initiative rolls, `drag-preview` queue-vs-drop, dedup double-count) — real, small, unclaimed.
