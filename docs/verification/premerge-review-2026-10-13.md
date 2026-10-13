# Pre-merge review of main..dev, 2026-10-13

**Status: on `dev`, not on main.** The ladder before merging `dev` into main (production `12ec8989`):
`/verify-gates` → `evaluate-live` → `review-convergence`. The range under review was `12ec8989..3fbfaf90`
(27 commits: the 2026-10-11 housekeeping, the dice hand-entry switch, the locked-door feedback, the
cached-image backup fix, and the lesson videos), and the fixes it led to.

## What the ladder found

| Step | Result |
| --- | --- |
| Gates on `174bb901` | Green except e2e `boot-recovery.spec.ts:89` (timed out under load; 3/3 alone) and the two character-download specs that fail only on this machine. |
| Live, two clients (`evaluate-live`) | **Critical:** turning a 31st player away crashed the server. `rejectAuthentication` closed the socket with the 30-seat reason as the close text; `ws` throws past 123 bytes, inside a timer, and the process exited. Fixed in `3fbfaf90` (fixed close text; real-socket test seen red). With the fix: 7.9 / 10. |
| Review round 1 (4 reviewers) | 6 major, about 15 minor. All four FAIL. |
| Review round 2 (4 reviewers) | About 10 major, most from the seat reclaim built in round 1. All four FAIL. |
| Review round 3 (4 reviewers) | About 5 major, all in the seat cap and reclaim. All four FAIL. The round cap; escalated to the owner. |

Every review agent ran read-only (Opus, pinned), none errored, and the tree was unchanged after each round.

## Fixed (each with a test seen red with the fix taken out, except the staging-zone warning in `c6420033`)

| Commit | What |
| --- | --- |
| `3fbfaf90` | A login-screen reason longer than 123 bytes no longer crashes the server. |
| `a160a220` | A refused restore no longer throws: the router's error path had written the whole backup (hidden NPCs, GM notes, secret doors) to the server log. Password messages and load-session are logged by type only. |
| `b2d9fba5` | The message pipeline's error log omits a frame's `snapshot`, `mapDocuments`, `sceneStates` and `document`; map-studio-import is logged by type only. |
| `3134ce9b`, `db1fa3c4` | Restore table backup says "sent. The table changes for everyone once the server accepts it." on send, never "restored": the server can still refuse it whole. The refusal names the real path (DM Menu → Table → Players at this table). |
| `ed76effa` | A custom token made from art already on the table can read it (the same cached-CORS trap as the backup fix, on the reader it missed). |
| `bed939f3` | Every HTTP reply says `Vary: Origin`, so an `<img>` reply cached without CORS headers is never reused for a canvas read. The client's `cache: "no-store"` fetches stay for copies cached before this. |
| `c6420033` | Refusal wording for a hand-over and a claim; a non-DM's refused staging zone is an always-on warning again; stale "heartbeat line" wording. |
| `78d5a3c8` | The cached-image backup e2e waits for the upload itself (`/assets/<hash>`), not any `/assets/` file (the bundle matched at page load). Red with both fixes removed. |

## Taken out: the 30-seat cap (`dcb90a15`)

The owner's call after round 3. The strict cap (`c7f45eaa`) let a script fill the Main Hall for free and turned a DM on a
new browser away from their own full table. The reclaim built in review (`ba5ba506`, then `8042729e` with the owner's
answers: keep the characters, an hour on the Main Hall, at most 6 seats per network) still failed round 3:

- a given-away seat's characters, left unowned, had no card, Owner menu or Delete anywhere in the Party (both layouts
  build cards per seated player), yet stayed in the turn order and counted toward the 500;
- the public table's per-network count kept seats whose players had long gone, so a household or a phone carrier's
  shared address stayed locked out while anyone was at the table;
- the DM's notice was a whisper authored by the DM's own uid, so it read as one they had sent themselves;
- the per-network key rests on Render's last `x-forwarded-for` entry, which nobody has checked.

A table has no seat limit again, as on main, and so the gap the cap was meant to close is open again: past 100
seats a table writes a backup that fails its own load check (`SNAPSHOT_LIMITS.players`), and on the public table
repeated joins are all it takes. The seat cap needs its own slice: a Party group for unowned characters
(desktop and phone, Owner and Delete), a system author for notices, counting only present seats, failing open on a
proxy address, and the Render header read first.

## Not done, stated

- **A roster past 100 seats writes a backup that fails its own load check**, and the DM is told only "sent" (a
  load-session that fails the schema gets no refusal frame; below). Open on main too; the seat cap was its fix.
- **The owner's lesson videos now disagree with the app.** DM path 5's popup says "A click does nothing" at a locked
  door (players are told it is locked since `11ac4e6f`). DM path 2's narration and overlay say a table holds 30 seats
  and turns new players away; with the cap out there is no limit.
- A DM under 👁 Player View is told "Only the DM can open it" at a locked door (documented in the map editor guide).
- A joiner at a table already at 500 characters is seated with no character and told nothing.
- Bulk NPC creation at 500 characters is refused silently.
- A restore can leave a table past 1000 tokens, or give a seated player more than 5 PCs (DM only).
- A load-session that fails the message schema gets no refusal frame (the "sent" toast does not claim success).
- The replay ledger answers a retried refused command with a bare ack, without its refusal frame.
- A dismissed lock toast silences the same notice for the rest of its 4 s; character refusals carry no request id; a
  backup file arriving after the 15 s timeout is discarded.
- The `[pong]` line is always on (dead-socket step 1, by design).

## Gates

Full ladder on `c6420033` (before the seat removal): all green except e2e, 373 passed and 5 failed. Three of those (the
compact Party at 375 px, the U2 window annotation, the mobile Table screen) timed out under load and passed alone; the
other two are the local-only character-download pair. The final tree is gated again, pushed to `dev`, and its CI run
watched before any merge to main; the run number goes in the merge record.
