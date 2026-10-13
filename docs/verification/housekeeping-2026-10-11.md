# Housekeeping, 2026-10-11

**Status: pushed to `dev` (`5c0d516f`), CI #966 green, including the full e2e suite; not on main.** Nine code commits on `f4623134` (production is main `12ec8989`). They close the
items left open after the colour review ([personal-colour-c1.md](personal-colour-c1.md), "Still open after round 3")
and the housekeeping list from the start of that session: the backup retry, the line-limit ratchet, the hot-path
logging, the dead code, and dead-socket step 1.

## What changed

| Commit | What |
| --- | --- |
| `e2b771fa` | A refused add, claim, hand-over or create says why: the server answers the sender alone with `character-refused` (`player-cap` or `table-full`), carried on the route result like `lockRefusal`. The client toasts it. "Creating..." stops at a refused add, and when no answer came at all it says so: "The table has not answered yet. Your new character may still appear: check the Party list before adding another." |
| `07a4f80f` | The table's 500 characters, at the two doors that did not check it. A new uid's join at a full table seats it without a character (its next join makes one once there is room). A restore that, with the seated players' own characters kept, would pass 500 is refused whole before anything changes. The merge's character rule is one function now (`mergeCharacters`), which the restore counts. A refused restore, and the map-document ceiling's refusal (which only reached a nack no screen showed), are said to the DM with `session-load-refused`. |
| `b8ddd569` | Download table backup (`session-export`) is sent once: no commandId, never retried. Its ack came after the file, so on a slow link the retries built and sent the backup 2 to 4 times. |
| `d52503e3` | The 350-line guard holds listed files to a ceiling. A listed file used to pass at any size: 17 of the 29 grew (MapBoard.tsx 562 → 1043, shared `index.ts` 544 → 1401). The baseline is now the 22 files still over, at today's sizes (a one-time reset), minus 7 stale entries. `pnpm baseline:update` only lowers ceilings and drops files under the threshold. |
| `d302ab94` | Per-message logging is opt-in. Server: the routing line for every message and the selection and staging-zone `[DEBUG]` lines go through `HEROBYTE_MESSAGE_LOG` (DEPLOYMENT.md); the per-heartbeat line is removed. (A non-DM's refused staging zone is an always-on warning again since the pre-merge review.) Client: three lines per send and one per ack go through `VITE_DEBUG_TRAFFIC`; the per-snapshot initiative dump and useCombatOrdering's order dump are gone. |
| `7fa1fe22` | `PlayerService.setDMMode` removed: dead, and it would have skipped `demoteDM` if wired. |
| `9d8dcc52` | Dead code: three unmounted map editors (452 lines), `sanitizeUrl` and `sanitizeImageDataUri` (never called, though ROOM_AUTH_FLOW.md listed them as protections; the doc is corrected), `packages/adapters-net`, and the server's unused `uuid` and `@hono/node-server`. |
| `c7f45eaa` | **Taken out before the merge (next row).** A table holds **30 seats** (the owner's number, 2026-10-11: "even 50 players is excessive"; every seat counts, connected or not). A new uid's join past it is turned away on the login screen ("This table is full: it holds 30 seats… Ask the DM to remove some"); a seat's own uid still gets back in, and the right password is refunded to the network's attempt budget. Nothing held the roster before, so scripted joins could pass the backup's 100. `rejectAuthentication` moved to `announceClosing.ts` for AuthenticationHandler's 350-line guard. |
| (later) | **Taken out before the merge to main, 2026-10-13** ([premerge-review-2026-10-13.md](premerge-review-2026-10-13.md)): turning a 31st player away crashed the server (the close-reason fix `3fbfaf90` stays), and three review rounds on the cap and a seat reclaim left it locking real players out. A table has no seat limit again, as on main; the seat cap waits for its own slice. Its reason is open again: past 100 seats a backup fails its own load check. |
| `f722f022` | Dead-socket step 1 (the owner's decision, 2026-10-10): each socket's pings and pongs are recorded and logged as one `[pong]` line at its close. Nothing is closed or terminated. |

Each behaviour fix has a test that was seen to fail with the fix taken out (a temporary edit, restored by copy):
the router's `character-refused` send, the restore's count, the join's check, the creation hook's refusal and
give-up, the backup's tracking, the ratchet (one line added to `messageRouter.ts`), and the recorder's ping count.

## Reading the `[pong]` lines (for step 2)

Each line reads, for example:
`[pong] <uid> closed (code 1006) after 412s: 16 ping(s), 16 pong(s), last pong 9s before close, longest run of missed pongs 0`.

- **pongs far below pings on ordinary sessions**: Render's proxy does not pass pongs through. Step 2 as planned would
  drop everyone; it needs another signal.
- **a socket closed by the heartbeat timeout (about 5 minutes silent) with a pong a few seconds before its close**:
  the proxy answers pings itself. Step 2 would change nothing.
- **"step 2 would have dropped it (N revival(s) after)"**: a socket missed 2 pongs in a row and answered later, so it
  was alive. Count these before choosing the limit.

Sockets that close before their first ping (25 s) log nothing.

## Not done, stated

- **The root `playwright` devDependency is kept.** `@playwright/test` provides the same binary, but the gitignored
  `temp/frames-research` scripts `require("playwright")` directly and would stop resolving.
- **Five more client files are used only by their own tests** (found by the dead-code sweep, not on the original
  list): `components/dice/RollButton.tsx`, `components/ui/EmptyState.tsx`, `components/ui/FormInput.tsx`,
  `components/ui/ImagePreview.tsx`, and `features/map-edit/mobile/mobileToolTiles.ts` (used by another component's
  live test). Left for a decision on whether they are a component kit in waiting.
- **The same class of bug as the 500, for the tokens (found here, older):** nothing holds a table to
  `SNAPSHOT_LIMITS.tokens` (1000), and a table past it writes a backup that fails its own load check.
- **Still open from the colour review:** a demoted DM keeps every PC made while DM; a DM password change does not
  demote a co-DM; the server's `clear-all-tokens` deletes unlocked role monsters; Ctrl mid-rotation applies one move
  late.
- **Not driven live in a browser.** The new toasts (hand-over at five, a refused restore, the give-up) are covered by
  unit tests only; `evaluate-live` has not been run on these commits.

## Gates

Full ladder on `f722f022` (the first eight code commits; the seat cap after it ran its own server suites, help tests and the structure guard, not the full ladder): shared build, lint, format, structure guard and both typechecks
pass; unit tests shared 530, server 2980, client 8400 (4 skipped); dev boot clean (server on 8787, Vite ready, no
missing-export error). e2e: 375 passed, 2 failed, 0 flaky. The two failures are the character-file download specs
(`interface-table-backups.spec.ts:191`, `mobile/mobile-table.spec.ts:323`) that fail only on this machine since
2026-10-02 and pass in CI. A second local run on `5c0d516f` (with the seat cap) stopped at 201 of 377 tests with 8
timeouts: the machine was saturated (a dozen idle MCP server processes at ~4% CPU each, plus Unity). All 8 passed
alone, and CI #966 ran the whole suite green.
