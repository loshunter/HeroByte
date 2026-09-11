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

## Open after the arc (owner's calls)

- A "nothing selected → your own token" fallback for WASD in pointer mode.
- Whether a DM-owned PC with an initiative should be a combatant (today it is not, by the
  pre-existing participation rule), which decides whether its budget ever resets on a turn.
- A DM "reset budget" control outside a turn boundary, and any enforcement (a red readout is
  advisory today).
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
