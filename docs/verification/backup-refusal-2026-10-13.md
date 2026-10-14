# Backup refusal, 2026-10-13

**Status: on `dev` (`ddeacebf`), not on main.** The owner's rule after the pre-merge review
([premerge-review-2026-10-13.md](premerge-review-2026-10-13.md)): "If it won't load it should refuse the save and
tell the user why. This would allow them to clear NPCs or unused seats before quitting and saving safely."

## What it does

**Download table backup** runs the backup through the restore's own test before handing it over: the shared
`loadSessionFrame` / `loadSessionFrameBytes` the client restores with, and the server's two load validators. When
Restore would refuse the file, no file is sent: `session-export-refused { reason }` goes to the requesting DM alone,
and the client's wait ends on it (15 s error toast). The reason is one sentence of what is over and one of what clears
it, for each cause:

- a collection past `SNAPSHOT_LIMITS` (in play: seats past 100, tokens past 1,000, drawings past 5,000, objects on the
  map past 5,000), with the count to clear and the control (Players at this table, Clear All Drawings);
- a waiting scene past those limits (`buildSessionFile` would leave it out), named by its map, with Use at table and
  the scene's own heaviest part;
- a frame past `SESSION_RESTORE_MAX_BYTES` (a KiB under the 1 MiB wire limit: the real frame adds a commandId), with
  its heaviest parts weighed from the real scene objects (maps, each waiting scene, drawings, tokens and characters,
  props, the Token Library, a pasted map background, the map on the table) and the control for each;
- anything else the validators reject: a malformed stored map is named ("Delete it"); the rest reads as a fault.

The same limit gates the client's restore guard and the map list's "Too big to restore" line. The client also
refuses (instead of downloading with a warning) a too-big file from an older server.

## Found and fixed on the way

| Commit | What |
| --- | --- |
| `61694bcc` | `SessionFile` / `SessionAsset` moved out of the shared barrel (it was at its 1401-line ceiling). |
| `025c3b84` | A restart deleted a waiting scene grown past a backup's limits (the disk load used the backup's schema): it is kept now, by shape. |
| `de5fae6e` | The barrel and router ceilings set to their sizes after the frame landed (an earlier `baseline:update` had lowered them first). |

## Review

Two reviewers per round, read-only, Opus: rounds 1–3 all FAIL (majors about 5, 3, 3), then one confirmation round the
owner approved (both FAIL on advice and copy only; the checks themselves confirmed correct), fixed in `ddeacebf`
without a further round. Every behaviour fix has a test seen red with it undone. Live (two clients, dev): a table at
105 seats was refused with the count and the path, the player saw nothing, five absent seats removed through Remove,
and the next download went through (the wording was since reworked; the server tests pin the current text).

## Lesson videos

DM path 2 (the 30-seat line removed) and DM path 5 (a locked door "tells them it's locked", with the real toast on the
player's screen) re-voiced on the VibeVoice temp track, re-aligned, re-captured and re-rendered (`33c62dce`,
`4d1c9120`). The two script lines live in `docs/website/narration-wren.md` and `video-scripts.md`, which hold the
owner's uncommitted edits and stay uncommitted.

## Gates

Full ladder with e2e on `1ed658a5`: 375 e2e passed; the two local-only character-download specs failed as always, and
one table-creation timeout passed alone. One server test failed there and is fixed in `ddeacebf` (the round trip's
malformed scene). Gates without e2e on `ddeacebf`: all green (server 3003, client 8422). CI #975 on `ddeacebf`: green, the full e2e suite included.

## Not done, stated

- The seat cap is its own slice (see the pre-merge record).
- Bulk NPC creation at 500 characters is refused silently; a joiner at 500 characters gets a seat and no character.
