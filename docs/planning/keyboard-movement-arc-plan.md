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
- **(Superseded by slice 2 — kept as the slice-1 record.) Discrete presses only.** A held key at
  the OS repeat rate would be ~30 broadcasts a second, each a fog re-filter per recipient; slice 1
  swallowed `event.repeat`. Slice 2 replaced that with a throttle (one step per 150 ms).
- **The wire is RELATIVE: `step-object` carries a direction, never a cell.** The server resolves
  the target from its own authoritative position (`TransformMessageHandler.handleStepObject`)
  over the same road a drag release takes, so latency, a refused step or a turn can never make a
  client ask for a cell nobody is next to: N presses are N one-cell steps, applied in order. This
  is the second version of this rule. The first sent absolute cells and kept a client-side chain
  of unconfirmed steps to guess the origin; review round 1 found a held key against a wall marched
  the chain and a perpendicular press TELEPORTED the token forward (the server's wall check is one
  straight segment); round 2 found the direction-locked, depth-capped replacement still re-sent a
  stale absolute cell whenever it distrusted the chain, which is a move order BACKWARD — up to 4
  cells, overcharged up to 60%. A relative wire has no origin to guess. The chain is gone.
- **The origin snaps to the nearest cell — on the server.** A token spawned from the staging zone
  sits at a fractional cell (16.97, 14.60 — measured live); `handleStepObject` rounds the object's
  current cell before adding the direction, so a step lands on whole cells.
- **Guard = invariant 4.17 minus the DM clause.** Typing surface (`isEditableTarget`), any
  modifier, and map-edit mode all mean "not for me". Not DM-only: a player moving their own token
  is the point. `event.repeat` is NOT a guard clause — slice 2 throttles it to
  `HOLD_STEP_INTERVAL_MS` (150 ms) and preventDefaults the swallowed ones. When nothing movable is
  selected the key is left alone (no `preventDefault`), so arrows still scroll a focused panel.
- **Selection is the existing model.** Selection only lives in Select/Transform mode (it
  auto-clears elsewhere — `useSelectionManager`), so a player must arm Select and pick their
  token before WASD does anything. Kept as is; a "nothing selected → your own token" fallback is
  a scope widening for the owner to call.
- **Mobile surface = the d-pad in the selection sheet.** No dock slot (the dock is pinned at
  five); the sheet exists exactly when a selection does. Eight chips each ≥ 44×44 (measured 69×44
  at 375×812, the pad taking the 220px it asks for — a grid item with `margin: 0 auto` had shrunk
  it to 3×44, round 2); in a short landscape viewport (812×375) the pad folds to ONE row of the
  four orthogonals (← ↑ ↓ →, keyed on `data-dir`, never on label text; the fold selector is two
  classes deep because the later base rule beat it at equal specificity and round 2 measured two
  rows led by a dead dot). Renders only when `movableCount > 0`, so a selection the player may not
  move shows the sheet without a pad. One press is one step on every pointer: the compat `click`
  after a pointer sequence (`detail ≥ 1`) is ignored, a keyboard activation (`detail 0`) steps,
  throttled to the same cadence — round 1 MEASURED that a finger tap is down, up, out, leave,
  click, so the first version's "pointerleave = slid off" latch double-stepped every phone tap.
  The press CAPTURES the pointer, so a mouse released off the chip still ends the walk (round 2:
  without capture a mouse walk ran forever and the pad went dead); the hold is keyed by POINTER
  id, so a second finger on the same button changes nothing.
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
  or suspends a fight resets everyone and returns the round to 1 (`resetAllMovementBudgets` in
  the Start/End buttons, `applyInitiative`'s auto-start, clear-all-initiative — which also drops
  the turn pointer into the now-empty order — both branches of a travel's `restoreCollections`,
  and a session load, which is a fresh boundary like a travel). **A turn start resets once per
  ROUND** (`state.combatRound`: +1 when next-turn wraps the order — a pointer left OUTSIDE the
  order counts as a wrap too — and −1 when previous-turn wraps it back, with NO floor, so a
  backward wrap exactly undoes a forward one). The stamp (`movementRound`) is written by the turn
  start itself, never ahead of it: round 3 found that stamping everyone at combat start made
  every round-1 turn start a no-op, and that the old `Math.max(1, …)` floor let PREV then NEXT
  from the top of the order in round 1 mint a round and a refill. Clearing ONE combatant's
  initiative drops the pointer if it was theirs and its stamp — never its spend: any player may
  clear their own, and round 3 showed zeroing there was a two-click refill (clear, re-roll, walk).
  A monster created mid-fight is born with a zeroed record and no stamp, so the DM's plate shows
  its budget before its first step and its first turn start resets it like anyone's.
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
- **Only combatants IN the order wear a readout** (`initiative !== undefined` AND the
  participation rule), and a monster's only on the DM's frame, and only when the record EXISTS
  (`movementUsed !== undefined` — a zeroed record shows the full budget) — so a redacted monster
  never shows a fake default, and during the elevation blip (role flipped, snapshot still the
  player's) a monster shows nothing rather than a wrong number. A fight that survives a restart
  back-fills a missing record with zero on load, so the DM's plates do not go dark for a round. A
  DM-OWNED PC is not a combatant (`shouldCharacterParticipateInCombat`): its plate is suppressed,
  and the SERVER still charges it — `movementUsed` climbs with nothing displaying it and only
  combat start/end clears it. Consistent with the existing rule; recorded, not changed.

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

## Review round 3 (2026-09-09) — six fresh lenses; 1 critical / 17 major / 45 minor → PLATEAU

Fresh Opus lenses on the full diff (critical/major/minor: client 0/2/8, server 1/5/7, tests
0/2/10, honesty 0/2/9, privacy 0/1/3 PASS, mobile 0/5/8). Round 2 was 1/18/30; the count did not
drop, so under `review-convergence` this is the last round and the owner gets the report — the
defects are still fixed (fix-bugs rule), in two commits, and NO fourth round is run.

**Server half (this commit).** CRITICAL: round 2 hung the budget reset on the clear-initiative
road, which any player may use on their own character — clear, re-roll, walk on: a two-click
refill. `leaveOrderBudget` now drops the pointer and the stamp and keeps the spend. MAJOR: the
per-round stamp was written for everyone at combat start, so every round-1 turn start was a no-op
(a spend before your first turn stood through it) — the stamp is now written by the turn start
only; the backward wrap was floored at 1 while the forward wrap was not, so PREV+NEXT from the
top of the order in round 1 minted a round and a refill — no floor (0 and below are stamp keys;
persistence accepts any integer); a turn pointer left outside the order (its holder cleared)
skipped the round increment, so the lap it opened reset nobody — a pointer outside the order is
a wrap; `load-session` carried a file's spend into the fight and `combatRound` never rode the
merge literal — a load now resets everyone (a fresh boundary, like a travel); round 1's prop fix
put the player-props switch ABOVE the shared-prop rule, so on a default table players could no
longer move a DM-placed `owner: "*"` prop — PropDispatcher's own shape restored on both sides.
Also: a step resolves its origin from the TOKEN (the legacy `move` road leaves the scene object
stale); `step-object` refuses a drawing id (its transform is in pixels); a same-cell move charges
0 ft and is quiet; the accumulator is capped (a far-flung cell wrote `Infinity`, which JSON writes
as `null`); a charged legacy move no longer sends a delta beside its snapshot; a fight surviving a
restart back-fills missing records; the round coercions are integer-only; the contract test gained
the road the secret is WRITTEN on (a DM setting a monster's speed) and a turn-start reset frame,
a positive control on the player's own frame, the missing `+10` sweep value and a five-digit
sentinel; the travel bucket map says `cleared`. Sabotage: 17/17 red. RECORDED here, not fixed:
next/previous-turn ignore `combatActive` (a player can walk the pointer out of combat and drift
the round; nothing charges and the next start returns it to 1); the wall check for a fractional
origin runs from the raw cell, not the rounded one (over-blocks, never under-blocks); a DM-run
character typed `pc` ships its budget like its HP (the pre-existing `type` axis); a teammate's
spend ticks for every player while fogged (fog is not a data boundary).

## Review round 2 (2026-09-09) — six fresh lenses; 1 critical / 18 major / 30 minor → fixed here

Fresh Opus lenses on the full diff, each reporting what round 1 fixed, regressed, and left
(critical/major/minor: defects 1/2/3, server 0/3/3, tests 0/3/8, honesty 0/4/8, privacy 0/2/3,
mobile 0/4/5 — 18 major, not the 17 first written). FIXED: the absolute-cell fallback (a backward teleport up to 4 cells — replaced by
the relative `step-object` wire; the chain is gone); a mouse released off a d-pad chip walking
forever (pointer capture); a held Enter outrunning the throttle; a second finger on the SAME
button cutting a walk short (pointer-id keyed hold); the landscape fold that rendered two rows
(selector specificity) and the pad shrunk to 3×44 (`margin: 0 auto` on a grid item); the per-round
reset stamp (a player refilling their own budget with PREV+NEXT; a PREV correction granting a
turn); the single-character clear leaving a dangling turn pointer; the redaction gaining
`movementRound`; `set-character-speed` no-op broadcasts; a monster born mid-fight wearing no
readout for the DM; the elevation-blip fabricated default; diagonals counted under rules that
never read them; the "deny non-owner" prop test made vacuous by round 1; three-digit secrecy
sentinels (a UUID-substring flake); the contract's missing fog/hidden case and positive controls;
the readout format pinned without Konva; the plates memo's missing `combatActive` dependency;
`toStrictEqual` where a deleted key mattered; the `mobile-select` sweep filtering by intent
(`display`/`visibility`) rather than a zero box; the frame-cadence reasoning (corrected above);
and a dozen stale sentences. REFUTED: the pad hiding when another tool is armed (the selection
clears; the keys have nothing to move either). The rest is recorded above with its reasoning.

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

- **Frame-cadence side channel.** A hidden monster walked by a held key sends a player a full
  per-recipient snapshot per step at the 150 ms cadence (byte-identical but for `stateVersion`).
  Round 2 corrected round 1's reasoning: drag PREVIEWS of a hidden monster are NOT sent to a
  player at all (`broadcastFilteredDragPreview` drops them), so that was the wrong precedent.
  The true pre-existing fact is narrower: every drag RELEASE (`transform-object`) already sent
  every player a full snapshot, and the legacy `move` road sent a `state-sync` per move, so a
  hidden monster's motion was one frame per gesture before and is one frame per cell now — a
  WIDENED channel, not a new one. The fix if the owner wants it: in `RoomService.broadcast`, send
  `{t:"state-sync", stateVersion}` to a recipient whose payload differs from the last only in
  `stateVersion`.
- **A save per step.** `step-object` rides the transform road, which is `save: true`, so a hold
  is ~6 full serialisations a second (~0.4 ms and ~100 KB each on the dev table). Pre-existing on
  every drag release; the hold multiplies it. A trailing debounce in `StatePersistence.saveToDisk`
  is the fix — its own commit, after the review.
- **A sub-cell drag with Snap off charges 0 ft** while it stays inside one rounded cell index;
  one that crosses a half-cell boundary charges a whole square, however small. Accepted (Snap off
  is the exotic case) — but round 3 corrected the reasoning: this is NOT the ruler's boundary. The
  ruler counts cells by `floor` on world pixels (`worldPointToGridCell`), the charge by `round` on
  cell indices, so the two disagree for a hop that starts or ends off-grid (3.4 → 3.6 charges 5 ft,
  the ruler reads 0; 3.6 → 4.4 charges 0, the ruler reads 5). The agreement pin covers whole-cell
  hops only. A same-cell move charges 0 ft and is quiet (no snapshot, no save).
- **A fractional feet-per-square distorts per-hop rounding** (0.15 ft/square charges 0.2 per
  step). Exotic; accumulate in squares if it ever matters.
- **The pad hides when another sheet or screen is up** (Tools/Help sheet, Party/Dice/Log screen)
  while the desktop keys keep working with panels open. A floating pad is the fix if wanted.
  Round 2 also claimed arming Measure/Pointer/Draw hides the pad while the keys keep working;
  REFUTED live: arming another tool clears the server-side selection (`useSelectionManager`), so
  the keys have nothing to move either.
- **`DraggableWindow` (the settings menu's host) uses `100vh`** on mobile, the unit the sheet
  contract forbids; unmeasurable locally (`vh == dvh` in every local browser). Pre-existing.
- **A player elevated to DM mid-combat** stops being a combatant, so its plate disappears rather
  than drifting negative — consistent with the participation rule; recorded.
- **The legacy `move` road, when charged, forces a full snapshot even for a hidden monster** (the
  delta channel cannot carry a character, so the quiet `state-sync` branch is bypassed).
  Consistent with `transform-object`, which every real client road uses; the product never sends
  `move`. A character record riding the DM's delta is the better wire if `move` ever returns.
- **`load-session` keeps a connected player's live character** and so drops the file's `speed`
  and spend for them (the pre-existing "the live sheet wins" rule for hp/initiative). A speed the
  DM set is roster data with no other home, so an overlay is worth doing; recorded.

## Open after the arc (owner's calls)

- A "nothing selected → your own token" fallback for WASD in pointer mode.
- Whether a DM-owned PC with an initiative should be a combatant (today it is not, by the
  pre-existing participation rule), which decides whether its budget ever resets on a turn.
- A DM "reset budget" control outside a turn boundary, and any enforcement (a red readout is
  advisory today).
- Hold-to-walk on the phone d-pad steps at the keyboard's cadence; a slower phone cadence is a
  one-constant change if thumbs find it fast.
