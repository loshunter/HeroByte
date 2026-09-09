# Keyboard movement arc — plan

Launch prompt: [PROMPT-keyboard-movement-arc.md](./PROMPT-keyboard-movement-arc.md). Owner's ask
(2026-09-08): WASD/arrows move the SELECTED token or item one grid cell per press; the fog cone
redraws per square; a movement budget ticks down per square, built alongside.

## Slices

| #   | Slice                                           | Status                                  |
| --- | ----------------------------------------------- | --------------------------------------- |
| 1   | Keystroke → one-cell move, guard, mobile d-pad  | **SHIPPED to `dev` 2026-09-09** (below) |
| 2   | Any selected item + the hold-to-repeat story    | **SHIPPED to `dev` 2026-09-09** (below) |
| 3   | Movement budget (diagonal rule, display, reset) | queued                                  |

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
- **Fast presses chain.** Two presses inside one round trip used to be a lost step (both computed
  from the same snapshot cell). The hook remembers the last SENT cell per object and chains from
  it while the snapshot still shows the cell it left, for up to 1.5 s (`stepOrigin`). A refused
  step (a wall) means the snapshot never catches up, and the TTL is what stops the chain drifting
  through the wall.
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
  five); the sheet exists exactly when a selection does. Eight 44×44 chips measured at 375×812
  (sheet 469–710 px, above the dock). Renders only when `movableCount > 0`, so a selection the
  player may not move shows the sheet without a pad.
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

## Open for slice 3

- Budget charge per press under the table's diagonal rule — `measureGridDistance` is
  path-independent (from/to), so a per-press charge under Pathfinder needs the count of diagonals
  taken THIS turn (alternating 1/2), and Euclidean needs the running sum; keep the MOVE (one cell)
  and the CHARGE separate. Reset on a turn boundary drags in initiative — scope with the owner.
- A "nothing selected → your own token" fallback (owner's call).
