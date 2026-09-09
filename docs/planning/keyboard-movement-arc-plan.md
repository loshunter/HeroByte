# Keyboard movement arc — plan

Launch prompt: [PROMPT-keyboard-movement-arc.md](./PROMPT-keyboard-movement-arc.md). Owner's ask
(2026-09-08): WASD/arrows move the SELECTED token or item one grid cell per press; the fog cone
redraws per square; a movement budget ticks down per square, built alongside.

## Slices

| #   | Slice                                           | Status                                  |
| --- | ----------------------------------------------- | --------------------------------------- |
| 1   | Keystroke → one-cell move, guard, mobile d-pad  | **SHIPPED to `dev` 2026-09-09** (below) |
| 2   | Any selected item + the hold-to-repeat story    | **SHIPPED to `dev` 2026-09-09** (below) |
| 3   | Movement budget (diagonal rule, display, reset) | **SHIPPED to `dev` 2026-09-09** (below) |

## Slice 1 — SHIPPED 2026-09-09

**What a user gets.** In Select or Transform mode, with a token (or prop) selected, `WASD` and the
arrow keys step it one grid cell; `Q E Z C` and the numpad corners step it one cell diagonally.
Whatever is selected that the actor may move goes together (the DM's multi-select moves as one).
On a phone the selection sheet — which already appears with a selection — carries a 3×3 d-pad;
each tap is the same one-cell move. The help panel's "Move" entry names both. The fog cone and
line-of-sight redraw from the next snapshot, square by square, with no fog code touched.

**Decisions, and why.**

- **The wire is `transform-object`, not `move`.** The launch prompt banked `move`, but the client
  never sends it — every token AND prop drag already goes through `transform-object` with a
  `token:`/`prop:` id, and the server's `TransformHandler.applyTokenTransform` /
  `applyPropTransform` carry the ownership, lock and wall-block checks. Riding that road gives
  "any selected item" for free and adds nothing to the wire. (`move` is a legacy token-only path
  used by e2e seams and tests; it rides the delta channel but does not save.)
- **Discrete presses only (`event.repeat` swallowed).** A held key at the OS repeat rate would be
  ~30 transform-object broadcasts a second, each a fog re-filter per recipient. One press = one
  round trip. Slice 2 owns the repeat story if the owner wants hold-to-run.
- **Fast presses chain — in ONE direction, bounded.** Two presses inside one round trip used to
  be a lost step (both computed from the same snapshot cell). The hook keeps a chain per object:
  the cell the chain started from, the last cell asked for, its direction, and when its FIRST
  unconfirmed step was sent (`stepOrigin` / `nextPendingStep`). A press chains from the last
  target only while it is the same direction, the snapshot cell lies on the chain's path (start,
  any confirmed step, or target), the chain is under 4 cells ahead of the snapshot, and under
  1.5 s old counted from that first unconfirmed step. A turn, a snapshot elsewhere, a stale or
  over-deep chain all start over from where the token really is. (Round-1 review: the first
  version refreshed the clock on every press and did not lock direction, so a held key against a
  wall marched a phantom chain and a perpendicular press then TELEPORTED the token — the server's
  wall check is one straight segment and a (10,5)→(44,6) hop slipped under a wall ending at y=5.)
- **The origin snaps to the nearest cell.** A token spawned from the staging zone sits at a
  fractional cell (16.97, 14.60 — measured live); a keyboard step lands on whole cells, so the
  origin rounds first. Verified live: (17.97, 12.6) → `d` → (19, 13).
- **Guard = invariant 4.17 minus the DM clause.** Typing surface (`isEditableTarget`), any
  modifier, `event.repeat`, and map-edit mode all mean "not for me". Not DM-only: a player moving
  their own token is the point. When nothing movable is selected the key is left alone (no
  `preventDefault`), so arrows still scroll a focused panel.
- **Selection is the existing model.** Selection only lives in Select/Transform mode (it
  auto-clears elsewhere — `useSelectionManager`), so a player must arm Select and pick their
  token before WASD does anything. Kept as is; a "nothing selected → your own token" fallback is
  a scope widening for the owner to call.
- **Mobile surface = the d-pad in the selection sheet.** No dock slot (the dock is pinned at
  five); the sheet exists exactly when a selection does. Eight chips each ≥ 44×44 (measured 69×44
  at 375×812, sheet 469–710 px above the dock); in a short landscape viewport (812×375) the pad
  folds to one row of the four orthogonals, since three rows would clip the sheet's own Clear
  chip. Renders only when `movableCount > 0`, so a selection the player may not move shows the
  sheet without a pad. One press is one step on every pointer: the compat `click` after a
  pointer sequence (`detail ≥ 1`) is ignored, a keyboard activation (`detail 0`) steps — the
  round-1 review MEASURED that a finger tap is down, up, out, leave, click, so the first version's
  "pointerleave = slid off" latch double-stepped every phone tap.
- **Client pre-filter mirrors the server.** `movableSelection` applies the server's rules
  (owner/DM for tokens; DM, owner or `*` for props; locked = DM only) so a refused press sends
  nothing. The server remains the guard.

**Files.** `apps/client/src/features/movement/keyboardMovement.ts` (pure: key → delta, movable
selection, step origin), `useKeyboardMovement.ts` (the listener, returns `MovementControls`),
`layouts/MobileMovePad.tsx` (the d-pad), threaded App → `MainLayoutProps.movement` (optional, the
`kick` precedent) → `MobileLayout` → `MobileSelectionSheet`. CSS `.mobile-move-pad`.

**Pins.** 22 unit tests (pure + hook), 2 layout tests (the d-pad through the REAL `MobileLayout`,
including the "no pad when nothing movable" case), e2e `keyboard-movement.spec.ts` (real key
presses: step, chat-box guard, someone else's token via a SECOND browser context so it never
skips) and `mobile/mobile-move-pad.spec.ts` (375px: pad present, 44px floor, fits above the dock,
two taps; no pad on another player's token). Sabotage: 17/17 unit-level red (numpad table, each
ownership rule, locked, TTL, from-equality, each guard clause, preventDefault, chaining, the sheet
render, `movableCount` gate, the layout's forwarding, a pad arrow's sign) + both e2e specs red
under their own sabotage (key table nulled; the layout's `movement` forwarding cut).

**Gate at commit** (full ladder, gates-runner): shared 25 files/427, server 127/2342, client 301
files/5598, e2e **180 passed / 3 skipped / 1 flaky** — the flaky retry was
`kicked-in-door.smoke.spec.ts` ("the return door never asked to travel"), outside this slice.

**Live-checked** (two clients, dev server): desktop `d`/`ArrowUp`/`w` each moved one cell and the
chat box kept "dw" with the token still; the phone tab's d-pad moved its token right, up,
down-right and the desktop tab saw it at (19, 15).

**Traps found.** The e2e seam object is REPLACED per render — a `const d = window.__HERO_BYTE_E2E__`
captured before an await reads a stale snapshot (cost one false "the tap did nothing"). Vite HMR of
a hook module cleared the server-side selection once (dev-only; the roll log does not).

## Slice 2 — SHIPPED 2026-09-09

**What a user gets.** A HELD key walks: the first press steps at once, then one cell every
150 ms (~6 cells/s) until release. The phone d-pad does the same on press-and-hold (350 ms before
the walk starts, then the same cadence; a slide-off or cancel stops it). "Any selected item" was
already true after slice 1 (props ride the same road; an NPC token is a token the DM may move).

**Decisions.** The OS repeat (~30/s) is throttled, not honoured: a repeat event steps only when
`HOLD_STEP_INTERVAL_MS` has passed since the last step — one press is still one round trip, and the
chain keeps the walk continuous. Swallowed repeats are still `preventDefault`-ed so the page cannot
scroll under a walking token. A fresh press is never throttled. On the pad, the click that follows
a pointer press is skipped (a tap is one step; keyboard activation still steps) and the walk timer
reads the LATEST `movement` through a ref — every snapshot replaces `move`, and a hold longer than
the chain's 1.5 s TTL would otherwise step from where the token was when the press began (caught
on read-back, pinned).

**Pins.** +2 hook tests (cadence, fresh press unthrottled), +1 layout test (press → delay → walk →
release → skipped click → bare click → slide-off latch → mid-walk `move` swap). Sabotage 8/8 red.

**Live-checked.** Desktop: 31 synthetic repeat events in ~1 s → 4 steps (19→23). Phone: a 1.2 s
pointer hold sent 7 steps at 2/360/515/670/828/983/1139 ms; six landed and the seventh was REFUSED
by the server's wall block (x=24), which is the guard working, not the walk failing.

## Slice 3 — SHIPPED 2026-09-09

**What a user gets.** While combat is on, every combatant in the initiative order wears a
movement readout under its nameplate: `remaining / speed ft`, gold while there is budget left
and the HP bar's red once overspent (a combatant = in the order AND one a turn can land on; a
DM-owned PC is not, by the pre-existing participation rule, so it wears none). Every road a
player or DM moves a token by in combat is CHARGED server-side — a keyboard step, a drag
release, the legacy `move` — under the table's diagonal rule and feet per square, with
Pathfinder's every-second-diagonal alternation carried across hops within the turn; a travel warp
and an NPC placement are not moves and are free. The budget resets when that character's turn
STARTS, and for everyone on every road combat starts or ends by (the buttons, the first
initiative value, clear-all-initiative, a travel). The DM sets a character's speed (feet per turn;
unset = 30; emptying the field returns it to the default): a PLAYER's from the settings menu that
carries the sight radius, on both layouts (the card's menu on the desktop, the party drawer's EDIT
sheet on a phone, 44px input reachable by scrolling); a MONSTER's from the DM menu's NPC editor,
which both layouts share. A monster's budget is DM information: stripped from a player's frame on
the wire (a bytes-level contract test), hidden by the DM's player lens, and shown to the DM for
every monster in the order whether or not it has moved yet.

**Decisions, and why.**

- **The charge lives on the server, on every road a position changes by** (`chargeTokenMove`,
  called from `TransformHandler.applyTokenTransform` and `TokenMessageHandler.handleMove`). A
  client-computed number could be edited; and a drag across five cells should cost five.
- **`movementCharge` is its own shared function, not `measureGridDistance`.** The ruler is
  path-independent; Pathfinder's alternation needs the count of diagonals already taken this turn
  (`movementDiagonals`), which only a running charge can keep. Pinned to AGREE with the ruler for
  any single hop from a clean slate under every rule — so for the first hop of a turn the two
  numbers are identical. Under Pathfinder they diverge later in the turn BY DESIGN: the ruler
  always counts from a clean slate, the budget carries the turn's diagonal count, so a ruler
  reading is the cost of that move taken first, not of taking it next.
- **Charged only in combat; reset on the character's turn start** — the owner's sanctioned
  default ("reset on your turn start"). Out of combat there is no turn to budget, so nothing
  ticks and nothing shows. A DM moving a token out of its turn charges it too (what you moved
  since your last turn start), and the next turn start wipes it. Every road that starts, clears
  or suspends a fight resets everyone (`resetAllMovementBudgets` in the Start/End buttons,
  `applyInitiative`'s auto-start, clear-all-initiative — which also drops the turn pointer into
  the now-empty order — and both branches of a travel's `restoreCollections`).
- **Display only, never a block.** Overspend turns the readout red; the DM adjudicates.
- **Speed is DM-set** (the vision-radius rule: "a budget a player could raise is not a budget"),
  over a dedicated `set-character-speed` message (`speed: number | null`, null = back to the
  default), validated in its own `movementValidators.ts` (characterValidators sits at the
  ceiling), refused server-side for anyone but the DM. NPC speed is set in the DM menu's NPC
  editor (`onSetNPCSpeed`, wired once in `DMMenuContainer`, which both layouts render) — the NPC
  card's ⚙️ deliberately carries no speed, as it carries no sight radius.
- **Threading follows the vision-radius chain exactly** (App → MainLayoutProps → MainLayout /
  BottomPanelLayout → EntitiesPanel → PlayerCard → PlayerSettingsMenu; MobileSurfaces →
  MobileEntitiesList → MobilePlayerRow → PlayerSettingsMenu), so the control reads and behaves
  identically wherever a DM finds it, and the mobile surface shipped in the same slice.
- **Only combatants IN the order wear a readout** (`initiative !== undefined`), and an NPC's
  only when the frame carries its numbers — so a redacted monster never shows a fake default.
  NOTE: a DM-OWNED PC is not a combatant (`shouldCharacterParticipateInCombat`), so it never gets
  a turn start; if the DM sets it an initiative it will show and charge but only reset with
  combat start/end. Consistent with the existing rule; recorded, not changed.

**Files.** `packages/shared/src/movementBudget.ts` (+ barrel re-export, sub-module — no runtime
const in the barrel), `Character.speed / movementUsed / movementDiagonals`, the
`set-character-speed` message; server `transform/movementCharge.ts`, `handlers/movementBudgetReset.ts`,
`validators/movementValidators.ts`, `snapshot/movementRedaction.ts`, plus the wiring in
TransformHandler, TokenMessageHandler, InitiativeMessageHandler, CharacterMessageHandler,
CharacterDispatcher, validation.ts, recipientFilter; client `tokenPlates.ts` (`move` on the plate),
`TokenNameplate.tsx` (`token-move-budget` Konva node), `MovementSpeedField.tsx`, and the chain
above.

**Pins.** Shared: 8 (each rule, the alternation across hops, ruler agreement, raw euclidean).
Server: charge suite through the real room service (transform road, combat gate, refused move,
Pathfinder across hops, euclidean), the legacy road through the router, initiative resets
(next/previous/start/end), the validator's bounds, the DM-only handler, the redaction pure and
through `buildRecipientView` (bytes-level: no `"speed":30` in a player frame). Client: plates rules
(combat gate, order gate, NPC fake-default, lens), the field (clamp, unchanged, Enter, compact
floor, follows prop), the settings menu, the mobile row, the mobile list's DM gate and
character-id binding. E2E `movement-budget.spec.ts` (a real player steps twice, the plate reads
"15 / 25 ft", the DM advances the order until the player's turn and the plate reads
"25 / 25 ft" again, end-combat clears every plate; a monster's fields never reach the player's
frame while the PC's do) and `mobile/mobile-movement-budget.spec.ts` (a DM at 375px sets 25 ft
through the real EDIT sheet, on the floor, and the plate reads it). Sabotage: shared/server
14/14 red, client 13/13 red, e2e 3/3 red (see the harness logs).

**Live-checked** (two clients, dev server): desktop DM — start → "25 / 25 ft"; `ArrowRight` + `e`
(a diagonal, one square under 5e) → 10 ft used, "15 / 25 ft"; next-turn → "25 / 25 ft";
end-combat → no readout. Phone DM at 375×812 — Party → EDIT → the speed field (60px tall, below
the fold of the scrolling sheet) → 25 → the phone's OWN nameplate updated live to "25 / 25 ft".

**Traps found.** `create-npc` RENAMES through the allocator ("Budget Goblin 1") — find a created
NPC by id diff, never by the name you sent. A DM-owned PC is not a combatant, so a spec whose
mover is the DM can never see a turn-start reset (the live check "passed" only because the dev
table had two DMs). With the browser pane hidden, `element.blur()` fires neither `blur` nor
`focusout`, so a React `onBlur` commit needs an explicit `focusout` dispatch.

## The flake the suite grew when slice 1 joined it — two bugs, both fixed (2026-09-09)

`kicked-in-door.smoke.spec.ts` ("the return door never asked to travel") had never failed in any
gate log; it failed on the first attempt in BOTH full runs after `keyboard-movement.spec.ts`
joined the suite immediately ahead of it, passed 3/3 alone, and reproduced 1-in-2 as the pair.
The screenshot showed the DM's OWN token still drawn on the return door's cell. Two causes:

1. **Client bug (real, pre-existing): a `token-updated` delta patched `tokens[]` only**, while
   the canvas draws from `sceneObjects[]` — so a `move` over the delta channel moved the data
   and left the sprite where it was until the next full snapshot (a heartbeat). The spec's
   "step the party aside" therefore raced the next broadcast. Fixed in `SnapshotReconciler`
   (`applyTokenDelta` now moves the matching scene object); pinned, sabotage red.
2. **Spec hazard: it stepped only NON-DM tokens aside.** The DM's token travels with the party
   and is spread randomly into the same zone, so it was a coin flip on the door's cell; the new
   spec ahead of it shifted the spread. The spec now moves EVERY token and waits for each
   sprite to reach its target instead of sleeping 500 ms.

## Review round 1 (2026-09-09) — six lenses, 12 fixed, the rest recorded

Six read-only Opus lenses on the full arc diff (defects, server semantics, test validity,
doc-vs-code honesty, privacy/wire, mobile reach), all `MODE: static`, plus the lead's
`live-two-client` pass. Union of findings, deduplicated. FIXED in this round: the phantom chain
(direction-locked, depth-capped, TTL from the first unconfirmed step); the phone tap double-step
(click discriminated by `detail`, one active hold, `touch-action: none`); the landscape fold;
map-edit inertness for the d-pad; combat auto-start / clear-all / travel never resetting; the
legacy `move` road charging without broadcasting or saving; the plates showing a budget on a
non-combatant DM-owned PC and none on a fresh monster; NPC speed unsettable anywhere (now the DM
menu's editor, both layouts); a set speed being forever (null returns to the default); the prop
transform road ignoring the player-props switch; the three fields entering room state from a
file uncoerced; the mobile legacy row sending a uid as a character id; the not-found log reading
as an attack; the orphaned doc block; the wording overclaims (ruler agreement, "every road", the
44×44 chips, the held-key guard, the discrete-presses sentence); and the vacuous tests (the
overspend colour, the desktop speed UI, the one-sided charge assertion, the no-op stepOrigin
line, the empty-targets wait, a wall-refused step charging nothing, the NPC-speed leak half).

RECORDED, NOT FIXED (each an owner call or a pre-existing class):

- **Frame-cadence side channel.** A hidden monster walked by a held key sends a player a frame
  per step at the 150 ms cadence (byte-identical but for `stateVersion`). Pre-existing class:
  drag previews already broadcast per pointer move for the same token, so a hidden monster's
  motion was never silent on the wire. A coalescer for unchanged-view recipients is the fix if
  the owner wants it.
- **A save per step.** `transform-object` is `save: true`, so a hold is ~6 full serialisations a
  second (~0.4 ms and ~100 KB each on the dev table). Pre-existing on every drag release; the
  hold multiplies it. A trailing debounce in `StatePersistence.saveToDisk` is the fix — its own
  commit, after this round.
- **A sub-cell drag with Snap off charges 0 ft** (cells are counted by rounded index under the
  grid rules — a 0.8-cell drift is no square). Accepted: it is the ruler's rule too.
- **A fractional feet-per-square distorts per-hop rounding** (0.15 ft/square charges 0.2 per
  step). Exotic; accumulate in squares if it ever matters.
- **The pad hides when another sheet or screen is up** (Tools/Help sheet, Party/Dice/Log screen)
  while the desktop keys keep working with panels open. A floating pad is the fix if wanted.
- **`DraggableWindow` (the settings menu's host) uses `100vh`** on mobile, the unit the sheet
  contract forbids; unmeasurable locally (`vh == dvh` in every local browser). Pre-existing.
- **A player elevated to DM mid-combat** stops being a combatant, so its plate disappears rather
  than drifting negative — consistent with the participation rule; recorded.

## Open after the arc (owner's calls)

- A "nothing selected → your own token" fallback for WASD in pointer mode.
- Whether a DM-owned PC with an initiative should be a combatant (today it is not, by the
  pre-existing participation rule), which decides whether its budget ever resets on a turn.
- A DM "reset budget" control outside a turn boundary, and any enforcement (a red readout is
  advisory today).
- Hold-to-walk on the phone d-pad steps at the keyboard's cadence; a slower phone cadence is a
  one-constant change if thumbs find it fast.
