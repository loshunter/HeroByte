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
  four orthogonals — round 3 changed that to TWO rows of four, orthogonals then diagonals: the
  budget prices a diagonal at one square and its two orthogonal substitutes at two, so the one-row
  fold made a landscape phone pay double (keyed on `data-dir`, never on label text; the fold
  selector is two classes deep because the later base rule beat it at equal specificity and round
  2 measured two rows led by a dead dot; the button rule is two classes deep too, because the
  420px `.mobile-chip` rule later in the file shrank the arrows to 11px on every portrait phone). Renders only when `movableCount > 0`, so a selection the player may not
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

**Pins (as shipped in slice 1; round 2 removed the chain suite — HEAD carries 20 unit cases).**
22 unit tests (pure + hook), 2 layout tests (the d-pad through the REAL `MobileLayout`,
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

**Decisions (the chain sentences are the slice-2 record; round 2 removed the chain — each
repeat is another relative step against the server's own cell, which is what keeps a walk
continuous now).** The OS repeat (~30/s) is throttled, not honoured: a repeat event steps only when
`HOLD_STEP_INTERVAL_MS` has passed since the last step — one press is still one round trip, ONE
message for the whole selection (round 3: a message per object was 6.7 × N a second, past the
limiter's 100/s at ~15 objects, and the dropped steps broke formation; the client chunks at
`MAX_STEP_OBJECTS`). Swallowed repeats are still `preventDefault`-ed so the page cannot scroll
under a walking token. A fresh press is never throttled. A full-screen modal (`[data-modal-overlay]`
— initiative, elevation, character creation) makes the keys inert: round 3 showed an arrow pressed
"into" the initiative panel stepped the token underneath and charged its budget. On the pad, the
click that follows a pointer press is skipped (a tap is one step; keyboard activation still steps,
throttled per BUTTON) and the walk timer reads the LATEST `movement` through a ref. The hold delay
is 500 ms (was 350: a careful thumb stepped twice and paid 10 ft); only the primary button of the
primary pointer presses (a right-click stepped, its menu suppressed); where capture is refused the
pointer LEAVING the chip ends the walk, so no walk is unbounded.

**Pins (slice 2 as shipped; HEAD's layout test also covers pointer capture, pointer id, right
button, leave-without-capture, per-button throttle).** +2 hook tests (cadence, fresh press
unthrottled), +1 layout test (press → delay → walk → release → skipped click → bare click →
slide-off latch → mid-walk `move` swap). Sabotage 8/8 red. Round 3 added the holds a browser engine
can see — `mobile-move-pad.spec.ts` holds a finger over CDP and a mouse released far off the chip.

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
sentinel; the travel bucket map says `cleared`. Sabotage: 17/17 red.

**Client and mobile half (the second commit).** MAJOR: a multi-select walk sent one message per
object per step and tripped the limiter past ~15 objects, dropping steps at random — one message
for the whole selection now, chunked at 64; a full-screen modal did not stop the keys (an arrow
"into" the initiative panel stepped the token underneath and charged it) — `[data-modal-overlay]`
makes them inert; the d-pad's arrows rendered at 11px on every portrait phone (a later
`.mobile-chip` rule at equal specificity) — the button rule is two classes deep; the landscape
fold dropped the diagonals and so made a landscape phone pay double — two rows of four; the NPC
editor's stat row went to five `nowrap` columns — it wraps, with an on-screen assertion; the
pointer-capture fix was proven by nothing on a browser engine — `mobile-move-pad.spec.ts` now
holds a finger over CDP and releases a mouse far off the chip; the NPC speed editor's id binding
was pinned only by a one-NPC spec — a two-NPC unit test names the second. Also: a right-click
stepped (button 2, menu suppressed); a pen without capture walked unbounded — `pointerleave` ends
it; the hold delay is 500 ms; the Enter throttle is per button; the initiative watchdog is cleared
on confirm (a second entry inside the first's window was reported as a timeout) and its newer-frame
road is described honestly; a token born over the delta channel gets a sprite; `MovableSelection`
lost its dead cells; the mobile speed spec commits by blur (a phone keypad has no Enter); the
nameplate floor sweep covers the budget line; the budget specs no longer pin the font size; the
slice-2 decisions carry their supersede banner; HANDOFF's stale chain sentence is gone.
RECORDED here, not fixed (server half):
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

## Review round 1 (2026-09-09) — six lenses, the defects fixed, the rest recorded

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
- ~~**A save per step.**~~ FIXED after the review (own commit): `step-object` rides the transform
  road, which is `save: true`, so a hold was ~6.7 full serialisations and tmp+rename writes a
  second (~0.4 ms and ~100 KB each on the dev table), N× that for a multi-select. `saveToDisk`
  is now a trailing debounce (`saveDebounce.ts`, 250 ms after the last request, the state as it
  is then); `awaitPendingWrites` flushes a pending save first, so the shutdown path and every
  test still see the latest state on disk. The timer is unref'd.
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

## Follow-up F1 — the phone pad no longer covers the token it moves (2026-09-10, on `dev`, NOT merged to `main`)

The owner chose (a), a camera follow, over a flipped plate: a flipped plate keeps the READOUT
visible while the token itself still walks under an opaque cover. Shape: **mobile-local**, like
the map-edit cancel counter — `useMovePadCameraFollow` (features/movement) runs in
`MobileLayout` only while the d-pad is up and the map is what is showing (`surface === "none"`;
a Screen at z 1700 covers the sheet without unmounting it, and the surface machine now DERIVES
"none" while a screen's role gate refuses it — "Stop being DM" lives inside the DM screen — never
latching, because `isDM` reads false during every reconnect blip and a latch would close a DM's
open menu on one). It follows the first movable token, else the first movable prop (the keys'
own `movableSelection` rule), as a world-px BOX: both carry CELL coordinates (a prop's scene
transform too — the first cut read it as pixels and three review lenses caught it); the box is
the larger of the cell and the sprite (0.75 cell × the size ladder × the gizmo scale from the
scene object, sign ignored; a token scales about its centre, a prop about its top-left corner so
it grows right and down — or left and up when mirrored), plus, for a token, the 36 screen px its
counter-scaled nameplate hangs below it (+4 slack) — the budget readout is what the follow exists
to show. It measures the sheet's, the combat strip's and the map surface's REAL rects (in the
surface's frame; the strip by its bottom edge only — it is 420px wide and centred, so the model
errs conservatively) and, when the box is no longer wholly inside the open band, issues one
`focus-point` carrying the SCREEN point to land on (`at`, the command's new optional field), per
axis — the axis that left the band is placed a LEAD (half the piece) inside the edge it crossed,
the other keeps its screen position; a diagonal step into a corner may move both. So the next
step in the same direction crosses again and the camera scrolls one step's worth — a scroll at
the edge, not a whip back to the middle (a 200px correction in 120 ms read as a strobe). The
vertical band is chosen so the piece FITS: below the strip and inside the 16px pad (the sheet's
glow) when there is room, giving up the strip (its box is transparent between two opaque
buttons, and it now lets taps through to the map there — only its buttons take them) when there
is not, the pad last; the lead goes first when the band is short, then the plate, and when
nothing fits the piece is leading-edge-aligned. Whenever some band can hold the piece the
predicate and the placement agree, so a placed piece is inside until the next step; a piece taller
than the whole open map stays out and is re-issued the same command on every trigger — safe only
because a bare camera change is never a trigger (do not add that dependency). An `at` command
GLIDES (120 ms ease-out, `CAMERA_GLIDE_MS`; motion off lands at once; jsdom glides; a hidden tab
freezes mid-ease until shown); any command — a reset, a focus — cancels a glide in flight. A pan
or pinch in progress absorbs an outside camera change by shifting its origin (the finger's own
travel is kept in full, however many frames the glide takes), and a wheel zoom mid-pan is such a
change; only touches that started on the stage are the gesture, so a thumb on the d-pad plus one
finger on the map is a pan, not a pinch. The follow evaluates on the box changing (a press, a
drag, a DM dragging your token — the pad is up, this is the piece being steered), on mounting over
a piece already under the band, on a resize, a rotation, the sheet changing size (ResizeObserver)
and combat starting, and once after an app-level camera command (focus self, reset, travel
arrival — which go FIRST) has moved the camera to a different one (a command that moved nothing
is forgotten on the next frame); never on a bare camera change — a finger pan is the player's
choice. `MainLayoutProps` grows nothing; the four desktop layout fixtures are untouched (the
mobile one gained cases).

Measured, so the next reader has the numbers (50px grid, scale 1): portrait 375×812 leaves a
player 469px of open map above the sheet (sheet 240.8px tall) and a DM 418px (Lock/Unlock add a
51px chip row); inside the pad the band is [16, 453] / [16, 402]; at the edge every held ↑/↓
step scrolls one cell (50px, glided) for player and DM alike, and a horizontal step scrolls
nothing until the piece meets a side. Landscape 812×375: the pad now folds to ONE row of eight
(394px of the 766 the sheet has; the arc's review had rejected a one-row fold that dropped the
diagonals — this keeps them), which takes the sheet from 191 to ~135px and the open map from ~88
to ~138px; the band [16, 122] holds the cell and its plate (106 ≥ 90) but not a lead as well, so
the piece is centred with its plate at 49 and the budget line is readable; every held step scrolls
one cell. With a combat strip (y 20–80) the band below it is 26px, so the strip is given up and
the token sits over the strip's transparent gap — tappable, since the strip's box no longer takes
pointer events. A notched iPhone in landscape (safe-bottom 21) leaves a 97px band — still holds
the plate. A 2× pinch in landscape holds the token alone (100 ≤ 106); past ~2.1× nothing fits and
the piece is leading-edge-aligned (recorded); in portrait the plate is dropped only past ~7.9× for
a medium token, the ceiling being 8×. **Not done, recorded:** a multi-select follows its FIRST
piece only (formation assumed); nothing announces the glide — the canvas has no accessible token
representation; a `role="status"` line in the sheet reading the followed token's budget would be
the honest addition, in both orientations; a shared prop walked into a player's unexplored fog is
followed sight-unseen; drag previews (off by default) would fire the follow mid-drag if ever
enabled; rotation is ignored (a 45°-rotated large token's box is ~106px, judged 75 — a corner can
sit under the sheet); an app-level command followed by the follow's correction is two camera
motions for one button; the kick screen's `props.kick` gate is not part of the surface machine's
role gate (narrow: the phone never sets the App-level flag). Fixed on the way, own commit: a
flipped token's nameplate rendered ABOVE its sprite (`scaleY` unsigned in the plate's anchor).

Tests (49 unit cases new to this slice): `movePadCameraFollow.test.ts` (20: both coordinate
spaces, both anchorings and both signs of gizmo scale, the plate, the scale factor, the pad pinned
to exactly 16 by a 391/392 literal pair, the lead on every edge, the strip with and without room,
the too-short band, the too-short surface, a piece bigger than the screen, the surface clamp),
`useMovePadCameraFollow.test.ts` (13, rects stubbed in a surface 60px down the viewport: mount, a
step, uid/isDM threading, no camera-change fire, resize + orientationchange + a capturing
ResizeObserver, the listeners' identity and the observer torn down on unselect and unmount, the
strip, combat starting, inactive/map-edit/heartbeat, app-first with the one re-evaluation and the
forgotten no-op arm, the DM's taller sheet, missing and zero-size elements),
`useCameraControl.test.ts` (7 `focus-point` cases: default lands at once, `at`, `at` at scale 2,
a nonsense `at`, the glide monotone and landing exactly vs motion off, a reset cancelling a glide,
unmount cancelling the frame), `MobileLayout.test.tsx` (the live camera threaded; inert behind a
Screen and resuming; the DM-screen de-elevation case also proves the follow resumes),
`useMobileSurface.test.ts` (4: the derived gate hides and RETURNS across a role blip; the props
switch gates only when supplied), `useCamera.pinch.test.ts` (4: a touch pan and a pinch absorbing
outside changes frame after frame, a mouse pan with a wheel zoom mid-pan, a thumb off the stage),
and `mobile-move-pad-follow.spec.ts` — portrait (parked off-centre, 20px inside the threshold: ↓
moves the camera's y and not its x; the PAINTED Konva rect, read after the glide and the tween,
sits a lead inside the band's bottom with 36px+ to the sheet; ↑ from there moves the camera by
nothing), landscape (centred with the plate above the sheet), landscape in combat with a DM in a
second context (over the strip's gap, `elementFromPoint` there is the canvas, combat ended and
confirmed in the teardown); `mobile-move-pad.spec.ts`'s landscape case now asserts one row. Sabotage, one rule at a time: 13 red before the review (3 in the browser); 12 unit + 2 browser after round 1's fixes; 20 unit + 1 browser after round 2's; 17 unit after round 3's — 65 in all. One stayed green in the last pass: the camera-identity guard on the post-command re-evaluation, because that effect cannot run while neither the camera nor the target changed — belt-and-braces, not load-bearing. The tap-through over the strip went red in the browser BEFORE its fix: the public-table chip and the status pill's wrapper were taking the tap, a pre-existing top-of-map tap swallow fixed in its own commit.

### Review round 1 (2026-09-10) — four fresh Opus lenses; 1 critical / 14 major / 25 minor

Static lenses on the working tree (defects, test validity, doc honesty, mobile reach), union of
findings. CRITICAL (all three code lenses, independently): a prop's scene transform is CELLS, not
world px — the first press on a selected prop aimed the camera at the map origin. FIXED. MAJOR,
fixed: the nameplate below the token outside the judged extent; token/prop size ignored; a
vertical step recentred both axes; no re-measure on rotation; the combat strip not counted as
cover; an unfitting band clipped both ends; `within.width` vacuous in its test; the scale factor
unpinned; the e2e's token rect from the feature's own arithmetic; the docs undecided in two places,
"the band is 100px" in landscape, "15 unit tests", "four fixtures untouched", "every press
charged", eleven commits summed as twelve. MINOR, fixed: active behind a Screen; `mapEditMode`,
the zero-size guard, the literal pad and the left/right payloads unpinned; help copy silent.

### Review round 2 (2026-09-10) — four fresh Opus lenses; 1 critical / 18 major / 38 minor raw → 1 / 14 / 30 deduplicated

Not dropping against round 1, so round 3 is the last (review-convergence: a plateau stops the
review and the owner gets the report). REGRESSION, CRITICAL (mobile, doc, tests, defects all saw
it): counting the strip as cover INVERTED the band in landscape with combat (strip bottom 96 vs
sheet top 72) and the piece was aimed behind the sheet — FIXED by the fitting-band rule above.
MAJOR, fixed: a token's gizmo scale invisible to the follow; a scaled prop modelled symmetric
when PropsLayer anchors top-left; the top-aligned placement failed its own predicate (a jump on
every step, 6.7/s, untweened → the predicate agrees now and `at` commands glide); a stale
`surface` after a screen closed itself left the follow inert with nothing covering the map; a
pending app-level command discarded the follow's (app first, then one re-evaluation); the `at`
clamp pinned a too-large piece to the far edge (the producer aims the screen middle instead;
only a nonsense value is caught); a pan/pinch mid-walk snapped the camera back (re-base); the
ResizeObserver, `orientationchange`, the cleanup, `at` at scale ≠ 1, the surface-frame conversion,
the strip selector, the live camera threading and the resume after a Screen were unpinned; the
e2e's portrait bound had 200px of slack (now the band's upper part), its frames mixed viewport
and stage, its preconditions were unasserted; the docs: "three desktop fixtures" (four), "once
per five held steps" (every fourth), "453px of open map" (the band's edge; 469 open), "~22px",
"373px", "4.5×" (unreproducible digits, dropped), the landscape claims, contradictory sabotage
counts, the help sentence. Recorded, not fixed: combat starting re-measures via a dependency, not
an observer on the surface; drag previews.

### Review round 3 (2026-09-10) — four fresh Opus lenses; 1 critical / 17 major / 36 minor raw → dropping, and the LAST round

Raw counts 1/17/36 against round 2's 1/18/38, lower again once duplicates across lenses are
merged (the glide cancel, the test counts, the sabotage arithmetic, the strip's pointer box and
the predicate claim each came from two or three lenses). Under review-convergence round 3 ends
the review whatever the count: everything flagged is fixed below or recorded above, and the owner
gets this report. REGRESSION, CRITICAL (defects): the surface-machine gate LATCHED on `isDM`,
which is snapshot-derived and reads false during every reconnect, so a DM's open menu (or a
half-filled kick form) closed for good on a socket blip — FIXED by deriving `surface` from the
gate instead (the map-edit guard's own rule). MAJOR, fixed: the portrait glide was still a whip
(a 200px correction in 120 ms, 33px/frame) — the placement now leads the crossed edge by half
the piece so every step at the edge scrolls one cell; the combat strip's `pointer-events: auto`
box swallowed taps on a token parked over it, and its buttons are opaque — the box lets taps
through now, only the buttons take them, and the "translucent" wording is corrected; the plan's
bolded "landscape cannot show a token and its plate" was refuted by the repo's own numbers — the
landscape pad is one row of eight (394px, the diagonals kept), which buys the 50px the plate
needs; a `reset` or `focus-token` during a glide was overwritten by its remaining frames — any
command cancels a glide; the re-base reset the drag origin every frame, so a pan during a glide
moved nothing — the origin now shifts by the outside delta and the finger's travel is kept in
full; a thumb resting on the d-pad plus one finger on the map read as a pinch (document-wide
`touches`) — only touches that started on the stage count; a wheel zoom mid-mouse-pan was
reverted by the pan; an app command that moved nothing left the re-evaluation armed against the
next pan — armed by camera identity, forgotten on the next frame; a flipped token's plate rendered
above its sprite (own commit); the pad was unpinned (any value 6–27 stayed green) — a 391/392
literal pair pins 16; the listener cleanup test checked names not handlers, and the unselect edge
and the observer's disconnect were unpinned; the mouse-pan re-base, negative gizmo scales, the
strict props switch, the glide's shape (now monotone within bounds) and "no `at` ⇒ no glide" were
unpinned; the combat e2e admitted any placement under the strip (now the centre is pinned and a
tap there must reach the canvas), mixed frames again (`stripBottom` now in the stage's frame),
and its teardown did not confirm combat ended; the docs: "24 of them at unit level" (42),
"every fourth held step" (a DM's band fired on the third — moot now the edge scrolls every step),
"the predicate and the placement agree" stated unconditionally, jsdom "lands at once" (it
glides), the test counts, "every held step scrolls one cell" (horizontal steps do not), the help
sentence ("keep" promised an invariant the follow does not hold — "on a step" now), the 2026-09-09
block's other stale clause, the PROMPT's enforcement branch for F2 and its "three Review round
sections". Recorded above: rotation, the two-motion app command, the kick gate residual, the
dead-branch-turned-comment in `place`, a `role="status"` budget readout.

## Follow-up F2 — a DM reset-budget control; the budget stays advisory (2026-09-11, on `dev`, NOT merged to `main`)

The owner's call (their gut, then "use your best judgment"): the budget does NOT enforce — "it's a
VTT, not an RPG game" — so a negative readout stays a red note, the overspending specs stay as
they are, and the DM gets the one lever besides the turn: a RESET that zeroes a character's spend
outside a turn boundary (a mis-press, a re-adjudication, a spell that restores movement).

Wire: `reset-movement-budget { characterId }`, DM-only like `set-character-speed` (a budget a
player could raise is not a budget), validated to a non-empty id, routed by the character
dispatcher to `movementBudgetMessages.ts` (its own module — `CharacterMessageHandler` is seven
lines from the 350-line guard and this, with its docblock, is ~40). The reset zeroes
`movementUsed` and `movementDiagonals` and leaves the per-round stamp ALONE: a stamp written
ahead of its event is a no-op at the event (review round 3 of the arc), so the character's next
turn start still resets it like anyone else's — pinned with a STALE stamp (round 2 in round 3),
the only fixture a pre-stamp can fail, and composed with a `next-turn`. Nothing spent, or no such
character, or a player asking, is a no-op — no broadcast, no save, asserted on the handler's own
result (the router shows only the save half). It does not check `combatActive`, defensively:
every ordinary road out of combat already zeroes every budget (end-combat, clear-all, travel, a
session load) and nothing is charged outside a fight, so out of combat a spend exists only if a
state file carried one in — and that is the case the test drives. The broadcast rides the
ordinary snapshot road, so the recipient filter's monster-budget redaction applies unchanged; the
contract test gained the reset road (the structural walk over `movementUsed`, `movementRound`,
`movementDiagonals` and `speed`, the speed's five-digit sentinel — the spend's is gone from the
state by the time a frame is built — and a second reset sending NOTHING).

Client: `MovementSpeedField` gained an optional `budget: { used, onReset }` — a "Used N ft"
readout (a phrase that never breaks mid-way; the row wraps instead) and a Reset button OUTSIDE
the label (inside one a click would also activate the input), inert at 0, on the 44px floor when
compact and at desktop density otherwise. Threaded the way the speed was: `resetCharacterBudget`
in `useSceneObjectActions` → `MainLayoutProps` (optional, so the layout fixtures stay untouched)
→ MainLayout / BottomPanelLayout / MobileSurfaces → the party lists (`EntitiesPanel`,
`MobileEntitiesList`) → `PlayerCard` / `MobilePlayerRow` → `PlayerSettingsMenu` (rendered WITH
the speed field, which the Movement panel keys on); and for monsters `onResetNPCBudget` on the DM
menu's props → `NPCsTab` → `NPCEditor` (whose portrait block moved to `NpcPortraitField.tsx` to
keep the editor under the guard). **The control shows where the plate shows a budget, or where
there is a spend to clear** — the plate's own gates from `tokenPlates.ts` (combat on, an
initiative on file, `shouldCharacterParticipateInCombat`; at the NPC tab the third is a
tautology for a monster and is not written), OR `movementUsed > 0`, because the server charges
any token moved in combat, initiative or not, and a spend made before a character entered the
order needs the lever too — so out of combat no card carries a dead "Used 0 ft", and a DM-owned
PC (not a combatant under today's rule) shows no spend on the card unless it has one — and then
it does, with the Reset: its token never reaches a turn start, so short of ending combat the
Reset is the only thing that clears that spend (the DM guide says so). The readout turns red past
the speed (or the default when none is on file), the plate's own overspend signal on the surface
where the DM acts. Off the
player lens: the DM menu is not part of the lens preview, so with the lens on a monster's plate
drops its budget while the NPC editor still reads it (recorded); the NPC editor also shows nothing when the frame carries no spend (the elevation
blip's redacted snapshot) rather than a fabricated 0. The panel's DM-section render site is
live today through the spend clause alone (a DM's own token charged in combat; also a co-DM's PC
in the order, which `shouldCharacterParticipateInCombat` — keyed on the FIRST DM — lets through);
its participation arm waits on F3. Pinned at that site (round 3). The server and client define
"spent" separately (the server also counts diagonals; the button disables on `used` alone) —
they cannot diverge through the charge road (a 0 ft charge bails before adding diagonals); a
hand-edited state file carrying diagonals without feet can (`coerceMovementBudgetFields` accepts
the pair independently), and there the control is inert while the handler would reset — recorded,
no product road reaches it. On the spend-only arm the control UNMOUNTS on success (the gate goes
false at 0) where the in-the-order arm goes inert — a decision: latching it would keep a dead
"Used 0 ft" in an open sheet after combat ends, the very thing round 1 removed; the vanished row
is the confirmation, and the phone's Token Lock panel moves up one row under the thumb. Help
copy says the budget is advisory and where the reset lives; the DM guide gained a Movement
bullet after Table Sight Default.

Tests: the validator (id shape); the routing (the DM zeroes and keeps a stale stamp; the handler's
own result for nothing-spent / unknown / a player; a diagonal count alone is a spend; reset then
`next-turn`; out of combat via the ordinary road and a file's stray spend); the secrecy contract
(reset frame, structural walk, a second reset emits nothing); the field (readout at 11px,
inert at 0, outside the label — the structural pin — absent without a budget, no inline 44px
without `compact` and 44px with it, red past the speed and past the default); the settings menu
(carries and fires it); the actions hook (both DM-only character messages' wire shapes);
`MobileEntitiesList` (binds the id; never for a player; none out of combat, without an initiative,
or on the legacy row; a spend with no initiative still gets it); `EntitiesPanel.budget.test.tsx`
(a real render of BOTH sites: the DM reads and resets a player's card; a player never sees it;
none out of combat or without an initiative; a spend with no initiative still gets it; the DM's
OWN character — in the order but no combatant shows none, a spend on its token gets the lever);
the NPC tab (names ITS monster of two; none out of combat, out of the order, or when the frame
carries no spend); the DM menu (it carries `combatActive` to the NPC tab); `MobileEntitiesList`
also pins the participation rule with a DM-owned character beside the player's row that does
carry it; `NpcPortraitField` (a broken URL hides, a corrected COMMIT recovers, typing does not
remount); the window caps (desktop `vh`, phone `dvh` + `height: 100%` + the safe-area band) and
the result card's rule read from the stylesheet (`80vh` before `80dvh`); and e2e:
`movement-budget.spec.ts` (desktop — two keyboard steps, the player's card on the DM's screen
shows "Used 10 ft", Reset, the plate reads full, the control goes inert) and
`mobile-movement-budget.spec.ts` (the phone's EDIT sheet: a step, "Used 5 ft" and the 44px Reset
on ONE line inside the viewport, again at 10 ft — the spend where a sized button once wrapped —
then tapped, the plate reads full; and the MONSTER's reset through the NPC editor's own button
and the real wire — placed, in the order, stepped, reset). Sabotage:
11 red before the review (a player may reset; the reset pre-stamps the round; a no-op broadcasts;
diagonals not cleared; an empty id accepted; the dispatcher drops it; the button fires at 0; the
row inside the label; compact not 44px; the NPC tab resets the first monster; the settings menu
drops the budget) — 14 more after it — 12 red, 2 green (the reset's own DM clause at each party list: the Movement panel already renders only behind the DM-gated speed handler, a second lock, recorded, not load-bearing) — and 7 more after round 2, all red (the spend clause dropped at the panel, the phone list and the NPC tab; the phone list's participation dropped; the handler pre-stamps; the validator takes an object id; the settings menu renders the budget without the speed handler). 32 in all, 30 red — and 14 more after round 3, all red (the DM-section spend clause; the 11px face; never red, and red by the wrong line; the preview keyed per keystroke, and not keyed; the desktop cap in dvh, the phone cap in vh, the safe-area band dropped; the result card's dvh before its vh, and its class dropped; extra fields refused; the hook's wrong message type; in the browser, the Reset taking the whole row — red at 5 ft). 46 in all, 44 red. Fixed on the way, own commit: the settings
overlay was sized in `vh` (the large viewport), so its bottom band sat under iOS Safari's toolbar
— `dvh` on its phone branch (an inline style cannot carry the CSS's `vh` fallback; a browser
without `dvh` drops the cap and `height: 100%` bounds the box, the old behaviour), `vh` kept on
its desktop branch (a desktop viewport has no dynamic chrome, and with `dvh` alone an old browser
would drop the cap with nothing else bounding `height: auto`), its content clears the home
indicator, and the dice result card's cap moved to `herobyte.css` where it can carry the
`80vh`-then-`80dvh` pair; the NPC portrait preview is keyed on its COMMITTED URL so a fixed URL
recovers from a broken one and typing does not remount it.

### Review round 1 (2026-09-11) — four fresh Opus lenses; 0 critical / 7 major / 24 minor raw → 0 / 5 / 16 deduplicated

Static lenses (defects + server semantics, test validity, doc honesty, mobile reach + privacy).
MAJOR, fixed: the readout and Reset had no combat/participation gate (a dead "Used 0 ft" on every
card out of combat; a DM's own non-combatant character showing a spend its plate hides) — the
plate's own three gates at all three homes; the desktop panel had no render test at all — one now covers the PLAYER site (the DM-section
site was called dormant here — wrong once round 2's spend clause landed; round 3 pinned it) and the phone list gained cases;
the reset's own DM clause at both lists is redundant behind the speed handler's gate — sabotaging
it alone stays green; what is pinned is that a player sees no Reset;
the no-op test could not see a broadcast — the handler's result is asserted directly and the
contract test counts frames; "a spend that survived combat's end" was false (every road out of
combat zeroes every budget) — the rationale and the test are honest now; the follow-ups prompt
still told the next agent to build the reset. MINOR, fixed: the vacuous spend sentinel; the
structural walk missing `movementDiagonals` and `speed`; the diagonals-only spend, the 44px
negative and the click-does-not-touch-the-input unpinned; the readout wrapping mid-phrase in the NPC
editor's speed cell (`STAT_CELL`: flex 1, min 88px — ~174px in the desktop DM menu, ~150px on a
375px phone; the row needs the span plus the button); the NPC editor's fabricated `?? 0`; the handler importing the reset from
the shared barrel instead of the documented home (`movementBudgetReset.ts`, whose header now
lists the manual road); the settings menu's coupling of the reset to the speed handler
undocumented; "sits at the 350-line guard" (seven lines from it); both e2e docblocks stale; no
user-guide mention of the budget; the phone overlay's `vh`. Recorded: two definitions of "spent";
the frame-cadence channel (the plan's standing item — the no-op guard limits it); the redaction
keys on `type === "npc"`, so a DM-run PC-typed character's budget ships to every player — F3's
territory, since F3 changes what a DM-owned character is.

### Review round 2 (2026-09-11) — four fresh Opus lenses; 0 critical / 4 major / 37 minor raw → 0 / 3 / 24 deduplicated

Majors down from 7 (5 deduplicated) to 4 (3); minors up, as every round's have. MAJOR, fixed: round
1's own gate cut the DM's lever off from the one spend it cannot otherwise clear — the server
charges any token moved in combat, initiative or not, so a character charged before entering the
order (or after clearing its own initiative, which keeps the spend) had a spend and no control —
the gate is now "in the order, or a spend to clear"; the participation clause was pinned at none
of the three homes (the phone list's fixture had no DM, so `shouldCharacterParticipateInCombat`
was always true) — a DM-owned character in the order now pins it; the monster reset's wire
(`DMMenuContainer`'s inline send) had no test at any level — the phone's NPC editor now places a
monster, steps it and resets it through the real wire; the plan's round-1 record claimed the
DM-section site and the DM clause as fixed — corrected to what is pinned. MINOR, fixed: the
compose test wrapped the round so a pre-stamp could never fail it — it advances without a wrap;
the decorative focus/onChange asserts in the field test; the settings menu's budget-without-speed
coupling; the validator's title ("nothing else" — extra fields pass, as everywhere) and two
shapes; the NPC-tab test's duplicated props builder; the readout's face (11px in both homes) and
the button's inline size (the row no longer re-wraps as the spend crosses 10 ft); the `vh`
sweep's leftovers (the window's desktop branch, its safe-area bottom, the dice result overlay);
the portrait preview's unrecoverable hide; "12 server cases" (8), "13" sabotages (14, 12 red),
"161px", "the 349-line guard" (the 350-line guard, seven lines of headroom), the missing DM-menu
case in both lists, four stale test docblocks, the DM guide's bullet placement, blank line and
the DM-owned sentence. Recorded: the player-lens gap at the NPC editor; the participation
conjunct at the panel's player site is dead code (`useCombatOrdering` applied it) — kept for
symmetry, said so; the handler's out-of-combat branch is reachable only by a hand-sent message;
`MobileSurfaces`' forwarding and the `dvh` line are e2e-only pins; the elevation-cache window
(`cachedDmSnapshot`, ≤2 s) can show a spend up to 2 s old — pre-existing cache design.

### Review round 3 (2026-09-11) — four fresh Opus lenses, the LAST round; 0 critical / 10 major / 30 minor raw → 0 / 4 / 25 deduplicated

Static lenses (correctness of wire + threading + gates, test rigour, DM/player experience on
both layouts, overclaim). One root cause under seven of the ten raw majors: round 2 widened the
gate to "in the order OR a spend to clear" and the prose was not re-swept, so the DM guide, this
section (twice), HANDOFF §0, the panel test's docblock and two prop docblocks still said the
round-1 gate — and called the panel's DM-section render site "dormant until F3" when the spend
clause makes it live today (a DM's own token charged in combat; the guide told the DM no Reset
would appear in the one case where it is the only lever). MAJOR, fixed: every one of those
sentences, and the DM-section site now has its own two cases (in the order but no combatant →
none; a spend → the lever, bound to that id); the phone's fit probe measured two constants
(`nowrap` and `flex-wrap`) and never reached the 10 ft spend where the sized button had wrapped —
it now reads the readout's and the button's tops at 5 ft and at 10 ft; the `vh`→`dvh` sweep and
the portrait preview's remount had no pin at any level ("e2e-only pins" was an overclaim: CI's
Chromium makes `vh` and `dvh` equal) — the window caps and the safe-area band are pinned on the
rendered style, the result card's `80vh`-before-`80dvh` rule is read from the stylesheet, and
`NpcPortraitField` has three cases. MINOR, fixed: the desktop window branch had gained `dvh` with
no fallback and nothing else bounding `height: auto` (back to `vh`, reasoned in place); the result
card's cap moved to CSS for the same reason; the portrait preview remounted per KEYSTROKE (keyed
on the committed URL now); the readout never went red where the plate does (red past the speed,
or the default); the 11px face, the validator's "extra fields pass" and the actions hook's two
wire shapes were asserted nowhere; the phone-list DM-owned case asserted half its title (the
player's row now opens too); the contract test read the FIRST DM frame, not the latest; the
`.last()` in the phone NPC block and the field test's inline-only `minHeight` negative say why;
"349-line guard", "review round" (singular), "beside Sight Radius", "the DM's card", "fires
without touching the input". Recorded: on the spend-only arm the control unmounts on success (a
decision, above); a state file carrying diagonals without feet leaves the control inert while the
handler would reset (above); the desktop e2e's closing plate assert is not filtered to the mover
(the exact `movementUsed === 0` before it is the load-bearing pin); "Used 15 ft" and the plate's
"15 / 30 ft" share digits at half speed (the word carries it; the plate reads what is LEFT);
`JRPGButton`'s disabled face is ≈3.25:1 (house-wide `opacity: 0.5`, not this slice's); every open
settings window's Reset shares one accessible name (one window per card is the ordinary case);
the desktop row holds one line below 1000 ft (a wrap, never an overflow, past it); the NPC editor
passes `compact` on desktop too (slice 3's shape); the reset writes no chat line (the speed's
pattern); a monster's Reset is in the NPC editor, not its panel card (where its speed lives).
Plateau: 0/4/25 against round 2's 0/3/24, every major a missing pin or a stale sentence, none a
wrong server result — no round 4, per the cap. Live-checked after the fixes with two clients on the dev table: the DM's own card (no initiative, DM section) read "Used 5 ft" with a live Reset after one step of its token in combat, and the reset emptied the row; a player's 35 ft on a 30 ft speed read red on the DM's card (`#d63c53`) while the player's plate read "-5 / 30 ft" in the same red; the DM's reset put "30 / 30 ft" back on the plate and left "Used 0 ft" inert on the card.

## Open after the arc (owner's calls)

- A "nothing selected → your own token" fallback for WASD in pointer mode.
- Whether a DM-owned PC with an initiative should be a combatant (today it is not, by the
  pre-existing participation rule), which decides whether its budget ever resets on a turn.
- ~~A DM "reset budget" control outside a turn boundary, and any enforcement (a red readout is
  advisory today).~~ — DONE as Follow-up F2 (2026-09-11): the reset control shipped; the
  budget stays ADVISORY by the owner's call.
- Hold-to-walk on the phone d-pad steps at the keyboard's cadence; a slower phone cadence is a
  one-constant change if thumbs find it fast.
- ~~**The pad covers the thing it moves** (round 3)~~ — FIXED by Follow-up F1 (2026-09-10, on
  `dev`, NOT merged to `main`; the camera follow — the plate below the token is inside the judged
  box, so the readout stays above the sheet too in portrait; in landscape only the sprite fits).
  See the F1 section above.
- Drawings are not steppable — `movableSelection` and the validator take tokens and props only
  (a drawing's transform is in pixels). A DM who marquee-selects a spline with a token moves the
  token alone; "any selected item" in the launch prompt meant tokens, props and NPCs.
- ~~A blanked number input resets a set speed to the default~~ — fixed in the client half: a
  rejected entry (`validity.badInput`) snaps back to the value on file; only a real clear means
  "back to the default".
- The initiative modal's newer-frame confirmation proves the STATE is what was asked, not that
  this request produced it; a walk's step can close the wait early in the no-op case (nothing
  wrong persists). A server ack would be the honest signal.
