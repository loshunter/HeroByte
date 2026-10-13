# Locked-door feedback

**Status: pushed to `dev` on top of `96de551e` (2026-10-12), not main.** Found 2026-10-11 while checking the lesson scripts (Player path 6,
chapter 4): a player's click on a locked door did nothing they could see. The server refused it ("Door is
locked") and the client wrote nack reasons only to the console, while the user guide promised players got
"Door is locked".

## What it does

- **The sprite says it before sending.** A player's click or tap on a locked door sends nothing. It toasts
  "This door is locked. Only the DM can open it." through lockNotice and plays a quiet latch clunk
  (`doorClunk` at 0.6 gain) that only the one who tried hears. One helper does both:
  `apps/client/src/features/map/lockedDoor.ts`.
- **The server stays the judge.** A view a moment stale (the DM locked the door after the player's last
  snapshot) cannot see the lock, so its toggle reaches the server. The server answers with `door-refused`, to
  the sender alone (`senderNotices`), and the door holds. The client answers it with the same toast and clunk.
- **The DM still forces any door** with a plain click and gets no notice.
- **Under 👁 Player View the DM gets the player's answer** (owner, 2026-10-12): lens doors were already
  player-grade since P4 (no Alt-click lock cycle). The DM guide now names doors as the exception to "every DM
  power".
- **A repeat is not stacked.** A lock notice already on screen (4 s) is not toasted again; the clunk still plays
  on every door click. This applies to every lockNotice control, not only doors.

## Live two-client evaluation (2026-10-12)

Mode: `live-two-client`. Dev server from the worktree (5174/8787), DM tab (`?sessionUid=eval-dm-1`, elevated
with the dev DM password) and player tab (`?sessionUid=eval-player-1`), same table. A kicked-in dungeon gave 40
closed doors.

| Case | Driven | Seen |
| --- | --- | --- |
| Player clicks a door their view shows locked | DM Alt-click locked `e208`; player clicked it | Toast in the player tab; no `toggle-door` sent (WebSocket send spy); door still locked |
| Stale view | Player's incoming snapshots held (wrapped `onmessage`); DM locked `e115`; player (still seeing it closed) clicked it | Client sent `toggle-door`; server replied `door-refused` then `ack`; toast shown; DM tab no toast; door locked on the server; on release the player's sprite turned locked |
| DM forces it | DM plain click on locked `e115` | Opened for both clients; no toast for the DM |
| Player View | DM with 👁 Player View on clicked locked `e208` | Player's toast; nothing sent; door still locked |
| Phone | Player tab at 375×812 with `?mobile=true`, tapped locked `e208` | Toast at the top (50–325 × 106–147), on top of the page (elementFromPoint), opacity 1 |
| Rapid clicks | Four quick clicks on a locked door | **Four identical toasts stacked** (finding; fixed, see above) |

Not verified live: the clunk is audible (the pane gives no sound); its call is pinned by unit tests.

| Criterion | Weight | Score |
| --- | --- | --- |
| Functionality | 0.35 | 9 |
| Multiplayer integrity | 0.30 | 9 |
| Craft | 0.20 | 7 (stacked toasts; fixed after scoring) |
| Reach | 0.15 | 8.5 |
| **Weighted** | | **8.5 (pass at 7.0)** |

## Commits

1. `11ac4e6f` `fix(doors): a player's click on a locked door says it is locked`
2. `bfdf10f8` `refactor(server): the sender-only frames come from one senderNotices()` (messageRouter.ts was at its
   structure ceiling; no behaviour change)
3. `38e5f9be` `fix(doors): a stale view's click on a locked door is told too (door-refused)`
4. `bd76bcda` `fix(toast): a lock notice already on screen is not stacked again`
5. This record.

Each fix's test was seen red without it. `packages/shared/src/index.ts` stays at its ceiling (one comment was
tightened to make room for the frame).
