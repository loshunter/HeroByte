# Housekeeping, 2026-10-11

**Status: on local `dev`, not pushed.** Eight commits on `f4623134` (production is main `12ec8989`). They close the
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
| `d302ab94` | Per-message logging is opt-in. Server: the routing line for every message, the heartbeat line, the selection and staging-zone `[DEBUG]` lines go through `HEROBYTE_MESSAGE_LOG` (DEPLOYMENT.md). Client: three lines per send and one per ack go through `VITE_DEBUG_TRAFFIC`; the per-snapshot initiative dump and useCombatOrdering's order dump are gone. |
| `7fa1fe22` | `PlayerService.setDMMode` removed: dead, and it would have skipped `demoteDM` if wired. |
| `9d8dcc52` | Dead code: three unmounted map editors (452 lines), `sanitizeUrl` and `sanitizeImageDataUri` (never called, though ROOM_AUTH_FLOW.md listed them as protections; the doc is corrected), `packages/adapters-net`, and the server's unused `uuid` and `@hono/node-server`. |
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
- **The same class of bug as the 500, for two other collections (found here, older):** nothing holds the roster to
  `SNAPSHOT_LIMITS.players` (100) or the tokens to `SNAPSHOT_LIMITS.tokens` (1000), and a table past either writes a
  backup that fails its own load check. Refusing a join at 100 seats changes who can enter, so it is the owner's call.
- **Still open from the colour review:** a demoted DM keeps every PC made while DM; a DM password change does not
  demote a co-DM; the server's `clear-all-tokens` deletes unlocked role monsters; Ctrl mid-rotation applies one move
  late.
- **Not driven live in a browser.** The new toasts (hand-over at five, a refused restore, the give-up) are covered by
  unit tests only; `evaluate-live` has not been run on these commits.

## Gates

Full ladder on `f722f022` (all eight commits): shared build, lint, format, structure guard and both typechecks
pass; unit tests shared 530, server 2980, client 8400 (4 skipped); dev boot clean (server on 8787, Vite ready, no
missing-export error). e2e: 375 passed, 2 failed, 0 flaky. The two failures are the character-file download specs
(`interface-table-backups.spec.ts:191`, `mobile/mobile-table.spec.ts:323`) that fail only on this machine since
2026-10-02 and pass in CI; CI has not run on these commits yet.
