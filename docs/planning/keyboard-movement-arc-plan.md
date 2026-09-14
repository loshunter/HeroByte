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
DM-owned PC is one once it has rolled — F3; under slice 3's rule it never was). Every road a
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
  DM-OWNED PC was not a combatant under the rule as slice 3 shipped: its plate was suppressed
  while the SERVER still charged it. **F3 (2026-09-11) reversed this** — rolled, it is a
  combatant and wears the plate; unrolled, the spend is cleared by F2's Reset or the end of
  combat.

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
- **A player elevated to DM mid-combat** keeps its plate and its place in the order (F3: a rolled
  DM-owned character is a combatant). Under slice 3's rule it stopped being one and the plate
  vanished — recorded then, reversed by F3.
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
PC (not a combatant under today's rule — F3 changed this: rolled, it is one) shows no spend on
the card unless it has one — and then it does, with the Reset: an UNROLLED one's token never
reaches a turn start, so short of ending combat the Reset is the only thing that clears that
spend (the DM guide says so). The readout turns red past
the speed (or the default when none is on file), the plate's own overspend signal on the surface
where the DM acts. Off the
player lens: the DM menu is not part of the lens preview, so with the lens on a monster's plate
drops its budget while the NPC editor still reads it (recorded); the NPC editor also shows nothing when the frame carries no spend (the elevation
blip's redacted snapshot) rather than a fabricated 0. The panel's DM-section render site is
live today through the spend clause alone (a DM's own token charged in combat); its
participation arm never arrived — F3 moved a rolled DM character (a co-DM's too, the rule keyed
on any DM) into the order and reduced the bench site to the spend clause. Pinned at that site
(round 3). The server and client define
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
OWN character — the cases F3 rewrote: rolled → in the order, the control inert at 0; unrolled →
the bench, no control; unrolled with a spend → the lever; out of combat → none);
the NPC tab (names ITS monster of two; none out of combat, out of the order, or when the frame
carries no spend); the DM menu (it carries `combatActive` to the NPC tab); `MobileEntitiesList`
also pins the participation rule with a DM-owned character (F3: rolled, its row carries the
reset beside the player's; unrolled, none); `NpcPortraitField` (a broken URL hides, a corrected COMMIT recovers, typing does not
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

## Follow-up F3 (2026-09-11) — a DM-owned character with an initiative is a combatant

**The owner's call** (2026-09-10): "a dm owned npc could be either. A npc could be a villain,
could secretly be a villain tagging along in disguise as an ally and will eventually turn on
them, it could be 100% an ally, the dm controls all that is not a player." So the DM's own
character is treated like a monster: **in the fight once it has rolled, on the bench until
then** — regardless of `type`. Statement: `shouldCharacterParticipateInCombat` (shared, the ONE
home — the server's `character/service.ts` carried a private copy, now deleted) returns true for
a PC owned by ANY DM iff `initiative !== undefined` (round 1: keyed on any DM, not the first found
— the panel groups on `player.isDM`, and the rule must agree with the grouping); a player's PC
and every NPC as before. What the rule decides is "may be in a fight", not "is in the order":
every caller but the party panel's ordering hook also asks for an initiative (`isInInitiativeOrder`),
so the DM clause is load-bearing only at the hook's bench split — the hook's two eligibility lists
read the rule without a roll gate, and the DM clause never fires there (their entities are non-DM
PCs and NPCs).
Round 2 gave "in the order" one spelling too — `isInInitiativeOrder` (the rule AND a roll), which
the server's order, the plates and both reset controls read, so a future exclusion added to the
rule reaches every one of them through it (the four sites' own `initiative !== undefined`
restatements are gone). Consequences: the server's initiative order includes it, so `next-turn` lands on it and
`startTurnBudget` refills its budget; the plate wears its budget in combat (tokenPlates); the
party panel's ordering hook moves a rolled DM character out of the DM group into the ORDER while
combat is on (kind `dm` kept, so its card carries the DM's affordances there; the turn counter
and the current-turn mark can land on it) — the bench is "DM-owned and not in the ACTIVE order",
so after END COMBAT, which keeps initiatives on file, the card comes home rather than leaving the
DM's column unmounted for the rest of the session (round 1); the reset controls' participation
arm fires for it, and the panel's bench site is reduced to the spend clause (the only live arm
there now).
**Redaction stays keyed on `type`**: `type` is the secrecy axis for HP as well, a DM-run PC-typed
character is a party member the players see the whole of, and a DM who wants an ally's numbers
hidden makes it an NPC — pinned by the secrecy contract so a later change is deliberate. What F3
adds to that: the ally's budget was already on the wire; now it is DRAWN on every player's map
and the ally stands in their order — a disguised villain run as a PC-typed character looks
like a party member on the map — plate and all — while its CARD wears the DM's gold face and reads
"Dungeon Master" in the order (round 3: decided to keep that face — the table could already see
whose card it was on the bench, and hiding it for players is one line if the owner wants the
disguise to hold at the card too; the DM guide says the table can see it is yours). The remedy the docs name
has no UI gesture today (the DM-only `update-npc` message does flip `type` to "npc", unguarded —
`CharacterService.updateNPC` — but the NPC list never offers a PC; the guide says: make it an NPC
from the start, or delete and recreate) — recorded in the DM guide, and in the prompt's item 4 as
the owner's to reopen.

Found live before the review, with a second DM at the dev table: the rule keyed on the FIRST DM,
so a co-DM's character participated like a player's — and the hook's first cut of the bench
("every DM-owned character the rule admits leaves the bench") sent an UNROLLED co-DM character
nowhere: off the bench, not in the order (out of combat the order carries only rolled and regular
entities). Fixed first with a second conjunct on the hook; round 1 then moved the fix to its
home — the rule keys on ANY DM — and the bench is "DM-owned, not in the active order", pinned by
three hook cases (a co-DM in combat, the fight ended with the roll kept, nothing rolled anywhere).

Tests: the shared rule (unrolled false, rolled true — 0 included — and a player's PC needs no
roll; the filter keeps a rolled DM PC); the server's initiative order (the rolled ally in, the
understudy out); the character handler (`next-turn` lands on the DM's rolled character and its
turn start zeroes its spend and writes the round stamp; unrolled, the turn wraps past it and its
spend stands); the secrecy contract (a DM-owned PC-typed character's speed AND spend reach a
player's frame while the monster beside it is stripped — the `type` axis, decided); the plate
(rolled: `{ speed 30, used 5, remaining 25 }` on the DM's screen, on a PLAYER's, and under the
DM's player lens; unrolled: none, spend or not; a player's own PC on a player's screen); the
ordering hook (the rolled DM character stands in the order at its initiative with kind `dm` and
the current-turn mark; a co-DM's character benched unrolled and in the order rolled; after END
COMBAT with the roll kept, home on the bench while the players' order still sorts; nothing rolled
anywhere, every DM-owned character on the bench); the desktop panel (rolled: in the ordered grid,
out of the DM group, the control inert at 0; a PLAYER sees it in the order wearing the DM face
with no settings entry; unrolled: the DM group, no control; unrolled with a spend: the lever; out
of combat: none even with a spend; after END COMBAT with the roll kept: home on the bench); the phone
list (rolled: its row's reset beside the player's; unrolled: none); and e2e — `dm-combatant.spec.ts`
(desktop, two clients on a table the spec quiets first and gives the character a speed of its
OWN, 35 — so the plate's numbers are this character's, not the default every other plate wears:
exactly one card carries the name; the DM's own card leaves the DM group once combat is on and
stands in the ordered grid on both screens, wears the current-turn mark, its plate — keyed by the
nameplate beside it, the ONLY plate — reads 35 / 35 on the DM's screen and the player's, a step
charges it (`movementUsed` 5 in the snapshot, 30 / 35 on both screens), `next-turn` wraps onto it
(0, 35 / 35), and END COMBAT sends it home with the roll still on file and no plate) and
`mobile/mobile-dm-combatant.spec.ts` (375px: no plate on the quiet table, then the keyed plate at
35 / 35, the snapshot's 5 ft and 30 / 35, PARTY → the DM's own row → EDIT reads "Used 5 ft" with
the Reset on the 44px floor, the turn refills it and the sheet reads "Used 0 ft" inert, END COMBAT
drops the plate). Both specs mutate the shared table inside their `try` and restore only what
they changed (the speed, and the reverse step only after the step landed). Sabotage, one rule at a time: 10 red before the review (the old rule back; the ownership check ignored; a truthy check on the roll; the server's private copy back; the hook leaving DM combatants out of the order, and keeping a rolled one on the bench too; the panel dropping kind `dm` from the ordered branch; the bench gate losing its combat conjunct; the redaction keyed on ownership; the bench's initiative conjunct dropped — the co-DM hole back). One was green first — the bench gate's combat conjunct had no out-of-combat case — so the panel gained one (a bench card with a stray spend, combat off: no lever) and it went red. After round 1: 5 more, all red (the rule keyed on the first DM again; the hook's combat conjunct dropped — END COMBAT keeps the card in the order; the bench emptied into the order regardless; a PC's plate budget hidden from a player's screen; the ordered branch rendering the DM's card without its DM flag — observable then only once the fixture gave it a token, since the menu's token controls were what the flag hid; after round 2 the menu gates on nothing but handlers, so that sabotage has no observable and the `isDM` prop is pinned by nothing — recorded). A sixth, the server's rule filter deleted, is GREEN today by design: every rolled character passes the rule, so the order test asserts the composition and that sabotage turns red the day the rule grows a real exclusion — recorded, not a hole. 16 in all, 15 red; the 16th green by design (round 2 replaced it: the
service now reads the shared `isInInitiativeOrder`, and a test that MOCKS the helper pins that the
order consults it at all). After round 2: 8 more — 7 red (the helper ignoring the roll; the order reading a bare initiative filter instead of the helper — the mocked case; `isDMCharacter` on the first DM again; the banner's denominator dropping the DM's combatant; the hook putting a rolled DM character in the order with combat off; the menu's token-size gate back; the ring gold again) and 1 green by construction: the helper ignoring its RULE conjunct, unobservable while the rule admits every rolled character — the conjunct is the helper's reason to exist, and the day the rule excludes a rolled character the shared cases (an unrolled and a rolled character of every kind) are where it lands. 24 in all, 22 red.

### Review round 1 (2026-09-11) — four fresh Opus lenses; 1 critical / 12 major / 28 minor raw → 0 / 6 / 16 deduplicated

Static lenses (correctness, test rigour, DM/player experience, overclaim). The CRITICAL was the
co-DM hole found live and fixed before the lenses finished reading (they read a moving tree; the
round's counts are provisional for that reason, and the fix is listed above). MAJOR, fixed: after
END COMBAT (which keeps initiatives) the DM's rolled character stayed in the order and, with one
character, the DM's whole column unmounted for the rest of the session — the bench is now
"DM-owned, not in the ACTIVE order" (a combat conjunct on the hook's split; pinned on the hook,
the panel and the desktop e2e); the rule keyed on the FIRST DM while the panel groups on any —
keyed on any DM now (`isDMCharacter` too), the hook's stopgap conjunct gone; the player-facing
half of the decision had no render pin — the plate is asserted on a player's screen and under the
DM's player lens with exact values, the panel renders the rolled DM character for a PLAYER viewer
(in the order, the DM face, no settings entry), and the desktop e2e opens a second context; the
e2e's plate reads were a global `toContain` that another combatant's plate could satisfy — keyed
by the nameplate beside each readout, asserted as the ONLY plate on a table the spec quiets
first, with the snapshot as the charge's witness; both specs mutated the shared table outside
their `try` — inside now, the reverse step only after the step landed; the server's second order
filter is a no-op today (every rolled character passes the rule), which the docblock claimed as
the point — the order test now asserts the COMPOSITION (rule ∘ initiative filter), so a real
exclusion is covered the day it exists, and the docblocks say what the rule decides; prose still
stating the old rule in slice 3's section (twice), HANDOFF's "by that rule alone", F2's test list
(cases F3 rewrote), two seam comments, `isDMCharacter`'s docblock (no production caller; it now
says so). MINOR, fixed: the guide names the bulk roll's NPC-only scope, the phone's lack of a
bench/order, the end-of-combat return, and that a character on the DM's card is visible to the
table; the "Turn 1 of N" banner while nobody held the turn (own commit, pre-existing);
`PlayerCard`'s memo comparator omitting the movement fields (own commit, latent); the plate's F3
assertion made exact; the bench halves of two server cases retitled as the initiative filter's
pins, not F3's; the co-DM hook case's "three branches" claim (three cases, two paths — reworded);
the mobile spec's wait order; the prompt's item 4; the service test's header. Recorded: the
`isFirstDM` flag is written and read by nothing (pre-existing; the separator is gated on the
bench's length; the F3 assertion on it dropped — the pre-existing separator case still asserts it); `filterCombatEligibleCharacters` and
`isDMCharacter` have no production caller (barrel exports, said so in place); the four readers'
own `initiative !== undefined` gates restate the order's admission beside the rule (the rule
decides "may", the roll decides "in") — a `isInInitiativeOrder` helper would fold them, not done;
the disguise case (above). NOT filed against the decision: a rolled DM character IS a combatant.
(Round 3: the F2 record\'s "kept for symmetry, said so" and "in the order but no combatant → none"
describe comments and cases F3 rewrote — see Follow-up F3.)

### Review round 2 (2026-09-11) — four fresh Opus lenses; 0 critical / 9 major / 28 minor raw → 0 / 7 / 17 deduplicated

Static lenses (correctness PASS 0/0/3; test rigour 0/2/12; DM/player experience 0/3/5; overclaim
0/4/8). Nothing regressed. MAJOR, fixed: the bench was documented as "no initiative" at four
seams (the hook's docblock, the panel's bench comment, the panel test's two docblocks) where the
code says "not in the ACTIVE order" — the comments invited deleting the combat conjunct two
sabotages had just proven load-bearing; the two e2e specs asserted the DEFAULT speed (30), which
every plate on the table wears — each now sets 35 in its quiet block (and restores it), so the
numbers are this character's; the server's "composition assertion" recomputed the production
expression over the same fixture and could not detect its own filter's removal, today or on the
day the rule grows an exclusion — replaced by the shared `isInInitiativeOrder` helper (one
spelling of "in the order" for the server's order, the plates and both reset controls; the four
restatements gone) plus a server test that MOCKS the helper to pin that the order consults it;
the plan claimed no message changes a character's `type` — `update-npc` does, unguarded (the NPC
list never offers a PC; corrected, the guide names the workaround); the guide's remedy was
unactionable (it now says: make it an NPC from the start, or delete and recreate); HANDOFF's F2
entry still called the card "the only lever" for a DM's own spend (unrolled, now); the DM card's
own gold border collided with the current-turn ring the moment F3 put that card in the order —
the ring is white now, in the gold glow (own commit `7b7827cb`, the player guide says so);
the phone has no initiative control for a character at all, and the guide's phone clause named
only the missing group and order — it now says the roll needs the desktop (the missing phone
initiative for players too is the initiative slice's, recorded there); the settings menu hid a
DM's card's token image, size and lock behind "DM players don't have tokens" — the only route to
a PC token's art, size and lock, so F3's combatant could not be made Large or given art, and a
co-DM lost the controls on their own character — the caller's handler is the gate now (own
commit `24c5f5b8`). MINOR, fixed: the guide lists HP among what the table sees; the
`InitiativeMessageHandler` comment's "elevated" (an elevated holder stays in the order under
F3); the panel test's vacuous tail (assertions on a menu never opened) and its "Dungeon Master
Mode" comment (gated on ownership, not `isDM`); `isDMCharacter`'s any-DM change pinned; the turn
banner's denominator counts the DM's combatant (1 of 2); the desktop e2e asserts the order
positively on both screens and that exactly one card carries the name; the phone spec's two
bookends (no plate before, none after END COMBAT); the phone-list contrast asserted by each
sheet's readout, with the count kept as a second check, and its titles no longer name a bench the phone does not have; the
hook's "combat off, only the DM rolled" case; the dead `isFirstDM` assertion in the F3 case
dropped (the sentence corrected); "spend or not" → "even with a spend"; "on the roll" → "once
combat is on"; "waits on F3" → "never arrived"; the sabotage arithmetic (16 in all, 15 red); a
player could open the initiative modal on any card (the server refused, silently or after the
5 s hand-entry timeout) — own card or DM only now (own commit `991c8697`, pre-existing).
Recorded: the panel reflows by a card-plus-gap when the DM's only character rolls and back on
END COMBAT (the separator and gap hang off the bench's length); 🧹 Clear Initiative from the DM's
own card's settings relocates the card and closes the menu (two render sites, local menu state);
out of combat the client's bench and the server's order now disagree on a rolled DM character —
invisible today (no turn mark, counter or controls out of combat), and the prompt's item 4
("next/prev turn ignoring `combatActive`") carries the coupling; the hook's two eligibility lists
read the rule with no roll gate (their grid carries unrolled players and NPCs at the bottom,
pre-existing); the `.player-card--dm` class has no stylesheet rule (a test hook; the DM face is
PlayerCard's inline style). Not a plateau (0/7/17 against round 1's 0/6/16, but every major a
prose or pin defect and none a wrong server result) — round 3 is the last, per the cap.

### Review round 3 (2026-09-11) — four fresh Opus lenses, the LAST round; 1/14/27 raw → 0/9/20 deduplicated

Static lenses (correctness 0/4/4; test rigour 0/2/9; DM/player experience 0/4/4; overclaim 1/4/10 — its critical the lint error).
REGRESSED, fixed: round 2's initiative-badge gate (`991c8697`) hid the whole badge without a
handler — and the badge is the only place an initiative number is drawn, so a player lost every
other combatant's count (the DM's ally's included). The badge now READS on every card and ACTS
only with a handler (a disabled, value-named element otherwise) — own commit `4c2e7e1a`, pinned
with rolled cards for a player viewer. Also fixed: the tree did not lint (a dead binding round 2
left behind); the server still said "DM players should never have tokens" at three sites (the
join road, the reconnect road, add-player-character), so a DM who pressed their own card's
Delete Token was left with a combatant pointing at a dead token and no road back — a DM is
tokened like anyone's now, a DM's added character gets a token, and both delete roads unlink the
character (own commit `65c7cd67`); "+ Add Character" was hidden on a DM's card, so the only
DM-run combatant could ever be the one joined with (own commit `44875505`; the `isDM` prop is
no longer read by the menu); the Token Image field rendered where its Apply could do nothing
(own commit `0d0fb5bb`); the memo comparator compared a closure the panel mints per render
(own commit `1e0fb3cf`); the bench split and the travel pointer read the helper too (six sites,
one spelling); the desktop's by-owner token fallback gained the phone's ambiguity guard (one
character only); the contract pins HP on the same `type` axis; the ring test pins the variable
and the DM card's gold half, not one string; the e2e arms its restore at the send and guards the
player's card count; the panel fixture's `as never` typed; `handleEndCombat`'s docblock; the DM
guide says where a DM's character comes from and that the table can see the card is the DM's;
the player guide's phone section says initiative and turns are desktop-only. Recorded: the
combat-active screenshot in the player guide still shows the old gold ring (`pnpm
docs:screenshots` regenerates it — the owner's run); the DM card's "Dungeon Master" caption and
gold face in the order (a decision, above); the bench sabotage of the `isDM` prop has no
observable now; `isInInitiativeOrder`'s six cases in one `it`; the turn banner's index beyond
position 1; the join/reconnect DM-token road is pinned by inspection and the live check, not a
unit fixture (the auth handler has none); the `readouts` helper throws rather than returns if a
plate ever lacked its nameplate (structurally impossible today). Sabotage after round 3: 11 attempts — 8 red (the badge hidden without a handler again; the badge live for everyone; + Add Character hidden on a DM card; the image handlers always passed — red only once BOTH handlers were un-gated, the menu keys the panel on the pair; the owner-token fallback for any count of characters; add-character skipping a DM's token; a delete leaving the link dangling; `--jrpg-white` undefined), 2 green by construction (the comparator's presence clause — subsumed by the `used` comparison, `undefined` never equals a number, kept for readability; the travel pointer's bare roll — identical behaviour while the rule admits every rolled character, the same class as the helper's own conjunct), 1 with no single-line sabotage (HP's axis is the recipient filter's, pre-existing; the contract case pins presence). 35 in all, 30 red. Live-checked after the round with two clients on the dev table: the DM's card offers + Add Character; the DM rolls 17 and the player's screen shows the card in the order with the DM face, the "Dungeon Master" caption and a read-only "Initiative 17" badge beside their own live one; the DM's Delete Token nulls the character's link, and a reload re-tokens it on the reconnect road with the roll kept and the plate back at 30 / 30. The round's verdict on the tree it read was FAIL on every lens; every major is fixed above and the tree lints, typechecks and passes every suite after them — no round 4, per the cap: the owner decides on this record.

## Follow-up F4 (2026-09-13) — nothing selected → your own token

**The owner's call** (2026-09-13, from the follow-ups prompt's item-4 list — the ONLY one of the
four queued): the pointer-mode fallback. Under the plain cursor a click on a piece selects it (the
selection persists until the tool changes — `useSelectionManager` clears it on a mode switch), but
nothing is selected until something is clicked, so a player had to click their own token — or arm
🖱️ Select and pick it — before a key did anything. Statement, **as corrected by review rounds 1
and 2**: with an EMPTY selection the keys stand in for "my token". The rule is `ownTokenFallback`
(the pure half, `keyboardMovement.ts`): the actor must run exactly ONE `pc` character owned by
their uid (zero or two-plus → nothing: with two characters a guess is wrong for one of them); that
character's linked `tokenId` answers when the snapshot has the token, and a link to a token the
snapshot lacks (stashed by a scene capture) answers nothing rather than guessing; only when the
character predates linking does ownership decide, and "owned by me" alone is NOT enough — every
NPC token carries the uid of the DM who placed it and is linked to its NPC character by every road
the client drives (`placeNPCToken`; only a crafted `link-token` frame can orphan one), so the
by-owner road reads `looseOwnToken` — the ONE token the uid owns that NO character claims (two
loose is a guess; a token another uid's character claims is not loose, and the keys go quiet
rather than guess — fail closed, on purpose). A DM's NPC characters never count (production NPCs
are unowned); a DM's own PC does (F3 made it a combatant). The same helper now serves the party
panel's ordering hook and the phone's party list, whose by-owner fallbacks still handed a DM's
card the first goblin (round 2, fixed in its own commit). The resolved id then goes through
`movableSelection` exactly as a clicked one would — so a locked own token stays a DM's alone, and
a PC linked to a token someone else OWNS is refused for a player and moves for a DM — and map-edit
mode zeroes it with the rest. A NON-empty selection the actor may not move is a deliberate
selection of someone else's piece, not "nothing": it stays inert and the key is left alone.

**The fallback speaks for the board, and the board is always there** — so it yields a key only to
a surface that would actually USE it (round 1: the listener had gone from "a piece is selected"
to always-on for every seat, and an arrow pressed to page the roll log walked the token and
charged its budget; round 2: round 1's "last click on the stage" witness over-corrected — the ⚔️
button that finds your token, or any button, took the keys away, a keyboard-only player lost them
at their first Tab, and the rationale that "the login click takes the witness down" described a
mechanism that does not exist, the hook mounting only after login). Three yields, for the
fallback road only — a selected piece was a deliberate click and keeps its reach: (1) a typing
surface (`isEditableTarget`) or a focused ARROW WIDGET (tab, listbox, tree, menu, slider, radio —
`KEY_CONSUMER_ROLES`) keeps every movement key; a focused BUTTON keeps none, because buttons do
nothing with them — so ⚔️ then W, SNAP then W, NEXT then W, and Tab-to-a-button then W all walk;
(2) the ARROWS — only the arrows — page the scrolling panel the last pointer landed in (the
browser's own arrow-scroll target: a panel that overflows, found by walking up from the
pointerdown target, never the stage), while the letters and the numpad, which mean nothing to a
panel, stay the board's; a click on the stage, on a button or in a panel with nothing to scroll
clears it; (3) a tool that owns the keys or the selection (`toolOwnsKeys`, threaded from
`App.tsx`: draw, align, atlas-link, select, transform — in Select or Transform an empty selection
means NOTHING selected, not "my token"; map-edit was already inert) makes the fallback register
nothing. Nothing yields on a fresh join, and no invisible state has to be learned: the copy names
the three yields and nothing else. The one-paint window between an emptied movable set and the
listener's removal swallows nothing. The wire is unchanged (`step-object` naming the own token;
the server guards as always). **Keyboard-only in effect, by the owner's wording:** the phone's
d-pad lives in the selection sheet, which mounts only with a selection in Select/Transform
(`MobileLayout`), so a `movableCount` of 1 with nothing selected lights nothing there — pinned by
the region's own role with an inline control that mounts the sheet AND the pad; the phone's road
stays TOOLS → □ Select → tap → d-pad. The camera follow computes its own movable set and is gated
on the same sheet, so the fallback branch is never live there. Docs: the help topic's Move entry
(the keyboard rule leads it: one character; not while typing; the arrows page a scrolling panel
you last clicked into; SELECT, TRANSFORM and the drawing / placement tools keep the keys; the
phone's real road with the tile's own □) and the player guide — the Move bullet (which had never
mentioned the keyboard) plus, in the phone section, the d-pad road no guide had carried (the map
scrolls to keep the piece in view when the strip above the sheet is tall enough to hold it); the
DM guide gains nothing yet (a sentence there would overclaim until a DM's second character is
handled).

Pinned by the rule (9 cases: the LINKED token, not merely the first owned; a link the snapshot
lacks → nothing; a stranger's token sorting first; the DM's goblin — claimed by its NPC — is not
loose, beside a loose own token it is the own token that answers; a token of mine another uid's
character claims → nothing, fail closed; two loose → nothing; two PCs / none / no snapshot; an NPC
character recorded as owned — a fixture-only shape — never counts; someone else's PC; a lone
unlinked PC with no owned token), the hook (20 cases: the step and the swallow with nothing
selected; two PCs → left alone; an unmovable selection → no fallback; the locked own token is the
DM's alone; map-edit inert; a composing tool owns the keys; one PC linked to the SECOND of two
owned tokens steps that one; a link to a gone token is inert; a DM running only NPCs — even one
recorded as theirs; a PC linked to a token someone else owns — refused for a player, stepped by a
DM; a tool taking the keys mid-session on the SAME snapshot object; the one-paint window; a second
character arriving mid-session takes the listener down; a drawing selected is not "nothing"; and
the yields — a key at the body or the root steps; a focused button keeps nothing; a focused tab
keeps letters and arrows; the arrows page an overflowing panel the last pointer landed in while
`s` still walks and a stage click clears it, with the panel stopping propagation; a panel with
nothing to scroll takes no arrows; a SELECTED piece keeps its reach after a click in a scrolling
panel — plus 2 pre-existing cases re-pinned), the App (1: the fallback is WIRED — a bare `d` steps
the one PC — and draw, select, transform, align and atlas-link each take it down, the plain cursor
brings it back), the two precedents (3: the party panel's DM card never resolves to the goblin and
does resolve a loose own token; the phone list's DM row shows no sight control with only the
goblin's token owned and binds the loose one beside it), the phone (1), e2e (2 in
`keyboard-movement.spec.ts`: no tool armed, no click, the selection entry settled null before and
after, the LINKED token measured; and SNAP clicked then `w` — a button keeps nothing) and the
server (10 in `characterService.ensureToken.test.ts`: live link kept; a stashed link kept with no
phantom; a dead link cleared and re-tokened; a gone character spawns nothing; another player's
loose token never adopted; two PCs adopt nothing; a new token beside the goblins; one loose token
adopted; two loose → spawned; none → spawned — plus the auth road itself in
`connectionHandler.test.ts`: a DM who owns a goblin token and deleted their own is re-tokened on a
reconnect that is a NEW socket). Sabotage, all red and on the named case, sources restored
byte-identical: before round 1, 10/10; after round 1, 14/14; after round 2, 19/19 (8 at the hook, 2 at the App threading, 1 at the shared helper, 2 at the precedents, 5 on the server, 1 under the e2e spec — its two F4 cases red, the three others green). Both real
typechecks clean; the structure guard clean (`helpTopics.ts` is at 345 of the guard's 350 — four
lines of headroom, not enough for the three-way split round 1 asked for; the keyboard rule LEADS
the entry instead, and the entry was cut to ~530 characters).

### Review round 1 (2026-09-13) — four fresh Opus lenses; 1 critical / 13 major / 13 minor raw → 1 / 8 / 11 deduplicated; every lens FAIL

Lenses: correctness (1 critical / 2 major / 3 minor), test validity (0 / 3 / 4 + 5 coverage
gaps), doc-vs-code honesty (0 / 4 / 4; 64 sentences audited, 41 holding), client UX + mobile
(0 / 4 / 2). `agents_error: 0`; all read-only (the tree audited by `git status` after each);
all `MODE: static`. What mattered, and what was done:

- **CRITICAL (three lenses) — the by-owner branch handed a DM a goblin.** `tokens.find(owner ===
uid)` — and every NPC token carries the placing DM's uid (`placeNPCToken` → `createToken(state,
senderUid, …)`, the `sceneSuspend` C3 record). A DM whose own PC was unlinked (own token
  deleted, or a legacy character) pressed `d` and the first goblin walked — accepted by the server
  (a DM may move any token) and charged. The live check could not see it: its DM's PC was linked.
  FIXED: resolve-then-verify — the link when the snapshot has the token, else the ONE token of
  the actor's that no character claims. The correctness lens found the part that made it STICKY:
  the reconnect re-token was gated on `findTokenByOwner`, which a goblin satisfies, so a DM who
  deleted their own token never got one back. FIXED in its own commit (fix-bugs-regardless-of-
  origin): `CharacterService.ensureToken` — kept when linked (a link survives a scene capture that
  stashes the token, so no phantom), adopted when exactly one own token is loose, else spawned and
  linked; the auth road delegates to it. Pinned 5 ways, sabotaged 4, and LIVE-CHECKED in the
  discriminating scenario: a goblin placed by the DM, the DM's own linked token deleted, a
  reload — the PC adopted the one loose own token, no phantom, the goblin's link intact.
- **MAJOR (two lenses) — the listener went from opt-in to always-on and swallowed 20 bindings
  from every non-input surface** (the roll log, the entities panel, the help popover, every phone
  screen body; only three components carry `[data-modal-overlay]`). FIXED by the three yields
  above (bare target, board witness, `toolOwnsKeys`), the selected road untouched; pinned 4 ways;
  the e2e now clicks the stage rather than fabricating the focus state with `blur()`. Trade-off,
  stated: after clicking a button or a panel the first key is ignored until the map is clicked.
- **MAJOR (two lenses) — the link clause and the owner predicate were unpinned:** every fixture's
  linked token was also the first token the actor owned. The lens's 10-mutation matrix had exactly
  the two survivors my eight sabotages stopped short of. FIXED with fixtures where the linked
  token is not the first owned and a stranger's token sorts first, plus the goblin case the
  original "NPC never counts" case only pretended to cover (a fixture-only shape — production NPCs
  are unowned; renamed to say so).
- **MAJOR (three lenses) — the copy promised the fallback unconditionally**, false for a
  two-character player the same documents invite; "d-pad on phones after a tap-select" named a
  road that does not exist (TOOLS → Select → tap); SELECT named where TRANSFORM also holds a
  selection. FIXED in the help entry and the guide; "the one token they own" is now literally
  true (uniqueness is checked); the plan's "doc gap closed" was an overclaim (the d-pad was in
  no guide) — the phone section gained the d-pad road.
- **MAJOR (UX, F3) — no on-screen affordance that the keys are armed, and no desktop camera
  follow: a token two screens away walks unseen.** RECORDED, not built: both are feature
  widenings of the owner's one-line item (a one-shot toast on the first fallback step; reuse the
  ⚔️ focus command when the target cell leaves the viewport). The selected road has had the same
  off-screen exposure since S1. Owner's call.
- **MINOR, fixed:** the re-registration case coupled to the fixture default (now on an unmovable
  selection); the misnamed "leaves the key alone when nothing movable is selected" (renamed,
  strong fixture); the e2e polling a token never proved to be the linked one (asserted); the
  phone pin through a text proxy (the region role + an inline control); test comments saying "one
  token" for "one PC character"; the one-paint `preventDefault` on an emptied set (m5, the early
  return); `draw` / `align` / `atlas-link` firing the fallback (`toolOwnsKeys`); the help entry's
  order (the keyboard rule leads).
- **MINOR, recorded:** the help entry's LENGTH (723 chars vs a median of 83) — the split waits on
  a `helpTopics` extraction, the file being at the 350 cap; the arrows-scroll-a-focused-panel
  property is now guaranteed by the witness rather than by the old inertness.
- **Observed on the way, not this slice:** on the public dev table (33 tokens, 30 stale players,
  fog on) a step's snapshot reached the clients seconds late — every "refused" reading during the
  live re-pass was a 1.5–3 s sample of a step that landed later, while the server log's send
  counts were exact (armed presses sent, yielded presses did not). A broadcast-latency item for
  the owner, if it reproduces on a table that is not thirty ghosts deep.

Round 2 next, on the whole diff with fresh lenses.

### Review round 2 (2026-09-13) — four fresh Opus lenses; 0 critical / 14 major / 28 minor raw → 0 / 7 / 17 deduplicated; every lens FAIL — and two of round 1's fixes had regressed

Lenses: correctness (0 / 2 / 6, two REGRESSIONS), test validity (0 / 5 / 10, one regression),
doc-vs-code honesty (0 / 2 / 8; 75 sentences audited, 48 holding, six regressions), client UX +
mobile (0 / 3 / 4, three regressions). `agents_error: 0`; read-only; all `MODE: static`. The
count did not drop from round 1 (1 / 8 / 11) — but the substance did: round 2's majors are
round 1's own fixes, not the feature.

- **REGRESSION (three lenses) — the board witness over-corrected.** "The last pointer landed on
  the stage" killed the flows the feature exists for: ⚔️ _Focus camera on token_ then W, any
  chrome button then a key, and a keyboard-only player's first Tab; its rationale ("the login
  click takes the witness down") named a mechanism that cannot fire (the hook mounts after
  login), so the pre-first-click window was still round 1's always-on. FIXED by replacing the
  witness with yields to surfaces that USE the key (§ above): buttons keep nothing; arrow widgets
  keep everything; the arrows alone page an overflowing panel the last pointer landed in; the
  stage clears it. Pinned 6 ways at the hook, plus the body/root targets the suite had never
  pressed (test validity: every case had dispatched on `window`).
- **REGRESSION (two lenses) — `ensureToken` stranded a DEAD link.** "Kept when linked" treated
  every unresolvable link as stashed; a table saved before `unlinkDeletedToken` shipped
  (2026-09-11), or `clearAllTokensExcept`, leaves links to tokens that are gone, and the road it
  replaced spawned for those. FIXED: stashed is "some scene capture holds it" (`state.sceneStates`),
  a dead link is cleared and the character re-tokened. Also from the lens: adoption now requires
  exactly ONE owned PC (the client rule's twin — two is a guess); another player's loose token is
  never adoptable (the owner predicate was unpinned; now pinned); `findTokenByOwner` deleted (dead,
  and a ready-made copy of the bug); the auth road itself pinned through the real handler on a
  reconnect that is a NEW socket (the same socket takes the heartbeat path).
- **MAJOR (UX) — in Select/Transform, deselecting then pressing an arrow walked your OWN token.**
  FIXED: `toolOwnsKeys` covers select and transform; the fallback is the cursor modes' — faithful
  to the owner's item. Pinned at the App level (the threading had no pin at all: `toolOwnsKeys:
false` was green everywhere).
- **MAJOR (test validity) — the e2e could pass through the SELECTED road**: its stage click could
  land on the token (a click selects under the plain cursor too) and its "nothing selected" guard
  read the server once, unsettled. FIXED: no click and no `blur()`; the selection entry polled
  null before and after; the LINKED token measured (the first-owned equality asserted a fixture,
  not the code); a second case clicks SNAP then presses `w`.
- **MAJOR (honesty) — the record's own claims:** the login-click sentence (wrong, see above); the
  pin counts ("10 rule / 18 hook" were 8 / 14 — recounted above); "clicks the stage rather than
  `blur()`" (it did both); "at the 350 cap" (345 of 350); "NPC tokens are always linked" (by every
  road the client drives; `link-token` can orphan one); "TOOLS → 🖱️ Select" on a phone whose tile
  reads □; "the map scrolls to keep the piece above the sheet" (only when the strip is tall enough
  — F1's own numbers); the by-owner precedents cited as authority while still carrying the goblin.
  All corrected; the precedents FIXED (own commit: `looseOwnToken`, shared by the rule, the party
  panel and the phone list, pinned at each).
- **MINOR, fixed:** the tool-flip pin reusing the same snapshot object (a fresh one per render
  masks a dropped memo dependency); the one-paint early return pinned from a render-phase press
  (round 1 called it green by construction — wrong); the DM-only-NPCs case on an NPC recorded as
  the DM's; a PC linked to a token someone else owns (the ownership axis of "a click's road");
  the phone control proving the pad half; a gone character on the server spawns nothing; the stashed
  case through a real `linkToken`.
- **Recorded, still:** an on-screen affordance for the keys (a one-shot toast) and a desktop
  camera follow for an off-screen token — feature widenings, the owner's call; the four silences
  (a wall, a yield, two characters, a composing tool) look alike to the player, and the copy is
  the only place the rule lives. The help entry's split waits on a `helpTopics` extraction.
- **Withdrawn from round 1's record:** "the login button's click takes the witness down" and
  "the e2e clicks the stage rather than fabricating focus".

Round 3 next — the cap. If its count does not drop against round 2's 0 / 7 / 17, the owner
decides on the record.

## Open after the arc (owner's calls)

- ~~A "nothing selected → your own token" fallback for WASD in pointer mode.~~ — DONE as
  Follow-up F4 (2026-09-13): `ownTokenFallback`, keyboard-only in effect, yielding only to a
  surface that would use the key; two review rounds so far; see its section.
- ~~Whether a DM-owned PC with an initiative should be a combatant (today it is not, by the
  pre-existing participation rule), which decides whether its budget ever resets on a turn.~~
  — DECIDED yes and DONE as Follow-up F3 (2026-09-11): rolled, it is a combatant; its budget
  resets on its turn like anyone's.
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
