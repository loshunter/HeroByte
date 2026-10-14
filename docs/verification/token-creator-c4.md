# Token creator, slice C4: the picture

**Status: on local `dev` (2026-10-14), not pushed, not main.** The owner holds C4 off `main` until C5a
(the frame engine) lands, because until then a creator picture draws in today's rounded square box.
Handoff: `docs/planning/PROMPT-token-creator-c4.md` (untracked).

## What it does

- **Token picture…** replaces the Token Image URL field in the player's ⚙️ settings window, the NPC's
  ⚙️ window (the DM's, only once the viewer is known to be the DM), and the phone's ⚙️ EDIT sheet (the
  phone's first token picture control). The DM Menu's NPC editor keeps its raw URL field.
- The creator (`apps/client/src/features/players/token-creator/`) is a lazy chunk (19.6 KB; the token
  catalog no longer rides with it). A `DraggableWindow`, full screen on a phone, with one tab, Picture.
- **Sources:** a file, a drop (anywhere on the window, or a near miss anywhere on the page while a
  creator is open), a paste (any image; text pasted into a text field stays text; the newest creator
  takes it), a link (loaded through `<img crossOrigin="anonymous">`, never fetch; the table's own
  `/assets` uploads are fetched past the HTTP cache).
- **Crop:** drag, wheel, the Zoom slider, a two-finger pinch, arrow keys (Shift ×5) and +/−; ⟳ Rotate a
  quarter turn clockwise on screen (also while flipped), ⇋ Flip left to right on screen (outside the
  turn), Reset. Zoom 1 = the picture covers the square; range half the fit size to 8×.
- **Backdrop:** Auto (the mean of the solid pixels in the outermost ring, within a quarter of the way in,
  that has at least 8 of them and 5% of the ring; dark parchment `#2a2622` otherwise), None, Solid,
  Gradient (top lit +25%, foot shaded −35% from the auto colour).
- **Preview:** at token size on a dark map, a light map and under fog, drawn as other players see it:
  the map's corner for the token's size (the map keeps a 1/8-cell corner at every size) and no outline.
- **Accept** bakes (`bake.ts`), uploads (`POST /assets`) and sets the picture through the caller's
  existing apply: `update-token-image` for a player's token, `update-npc` for an NPC (the server copies
  the record's picture onto the token after every NPC edit, so a token-only write would be undone).
  **Cancel, ✕ and Escape** abandon a save in flight: a bake not yet uploaded is never uploaded, an
  upload that lands after the close is never applied.
- **"Use the link as is"** is offered, while idle, for any picture that came from a link and for a link
  that cannot be framed (the site refuses copies, or nothing loaded): it sets the normalized link
  unframed with nothing uploaded, as the old field did. Over 2048 characters it says the link is too
  long (the server's cap) and stays open.
- No server change.

## Choices, with numbers

- **Bake edge:** 512, or 768 for a Huge/Gargantuan token at the time of the bake (an unplaced NPC uses
  its recorded size). A later size change does not re-bake.
- **Upscale rule:** always the full edge, even from a smaller source: the map scales to the token box
  anyway, and one edge per size keeps C5a's input fixed. Smooth upscaled art costs WebP little.
- **Encode:** `toBlob("image/webp", 0.85)`, then the blob's **type** is read: a PNG answer (Safari) is
  kept and named `token.png`; a typeless answer is re-encoded as PNG. Unit-tested with a stubbed encoder.
- **Bytes** (Chromium, WebP 0.85, the cover crop; the owner's `01 Images` folder was not on this
  machine, so stand-ins from the repo):

  | Picture | Source | 512 (auto/none) | 512 solid | 768 |
  | --- | --- | --- | --- | --- |
  | Bust portrait (`site/video/capture/assets/rogue-portrait.png`, 400², opaque) | 294 KB PNG | 35.2 KB | 34.6 KB | 56.1 KB |
  | Figure painted in a ring (Heroic Token Eldryn render, 400², 24% transparent) | 331 KB PNG | 53.6 KB | 44.6 KB | 84.3 KB |
  | Transparent token art (`rogue-token.png`, 400², 28% transparent) | 231 KB PNG | 58.8 KB | 44.1 KB | 101.3 KB |

  Live on the dev server: the Eldryn render framed by a player uploaded as a 30.1 KB WebP; an Imgur
  photo (`https://i.imgur.com/OvMZBs9.jpg`) baked to an 11.7 KB WebP for an NPC.
- **Bake time at 768:** 66 ms (opaque bust) to 130 ms (transparent art), five runs each, headless
  Chromium on this machine.
- **Pinch:** two pointers on the crop square (`touch-action: none`, capture per finger); the zoom
  follows the ratio of finger distances about their midpoint, and the midpoint's travel pans. Fingers
  three times as far apart give about 3× (e2e band 250–350%).

## Verification

- **Gates:** final ladder on `ac785b02`: build, lint, format, structure, both typechecks and all unit
  suites green (shared 530, server 3003, client 8494 tests); e2e 379 passed, 3 failed in 36 min. Two
  are the known local-only character-file download specs. The third,
  `boot-recovery-interaction.spec.ts:96` (a held token drag during terminal cleanup), failed in both
  full local runs with different symptoms (no own token in the snapshot; `browserContext.newPage`
  timed out before the test began) and passed 12 of 12 alone (`--repeat-each=3` and a single run);
  it touches nothing C4 changed. Treated as a load flake: watch it on CI.
- **Live two-client** (`evaluate-live`, 2026-10-14), mode `live-two-client`, dev server 5174/8787,
  Main Hall. The built-in pane cannot upload to a local server (`net::ERR_FAILED` on `POST /assets`,
  the server's CORS answer correct), so the upload legs ran in the repo's Playwright against the
  same running server. Seen: a player's picture reached both clients' snapshots 268 ms after Accept;
  the Imgur link baked from `localhost` (Imgur answers `127.0.0.1` referrers with 403 and `localhost`
  with 200, so the pane's `127.0.0.1` tab could not load it at all); the NPC picture survived an NPC
  edit and the player saw it; a dead link was offered as is. Found and fixed: the dead-link wording,
  Accept below the fold at 1280×720, an overlapping button label. Score 8.3 (functionality 8.5,
  multiplayer 8.5, craft 8.0, reach 8.0).
- **Review** (`review-convergence`), 4 Opus reviewers a round (correctness, test validity, doc
  honesty, integration/privacy), fresh each round, read-only:

  | Round | Verdicts | Findings |
  | --- | --- | --- |
  | 1 (`13a79a7c`) | 4 FAIL | 1 blocker, ~10 major, ~25 minor |
  | 2 (`88edf604`) | 3 FAIL, integration PASS | 0 blocker, ~14 major (mostly test depth), ~25 minor |
  | 3 (`5566b22f`) | correctness PASS, integration PASS; test validity FAIL (3 major: drag scale, vertical direction, slider absolute); docs FAIL (1 major: where an abandoned upload's storage goes) | 4 major, ~20 minor |

  Round 3 was the cap. Its findings were fixed in `dc25346f`, `bba852f9`, `ac785b02` **after the last
  review round and not re-reviewed**; each new assertion was sabotaged once and went red.
- **Sabotage:** every key assertion broken once and seen red across the slice (about 70 mutations),
  including the crop math, rotate/flip in the bake, the `blob.type` fallback, the NPC record path,
  Cancel uploading nothing, cancel mid-save, and the phone wiring. Two vacuous tests found this way
  (a pointer test saturating against the clamp in jsdom's 1 px layout; an error-clearing test passing
  for another reason) were rewritten until their sabotage went red.

## Found bugs (their own commits)

- `150bd687` map studio: a WebP map download that Safari encodes as PNG kept the `.webp` name.

## Known debt and open items

- **Abandoned uploads (server): fixed after the slice, quota only** (`4226467b` refactor, then the
  reclaim commits; owner's choice 2026-10-14). The creator uploads with `x-herobyte-intent: apply`; the
  server stamps that room's claim (`StoredAsset.pendingApply`), and a sweep that sees the picture used
  drops the stamp. A stamped claim no sweep has seen used 15 minutes after its upload
  (`APPLY_ADOPT_WINDOW_MS`) stops counting against that table's storage limit (`roomChargedBytes`); the
  claim and the file are never released on that account, so the whole-store total still counts them
  until the table is cleared. A first design released such claims; three review rounds each found a
  new way for a picture a table still used to be deleted (identical bakes in two tables plus a late
  apply), so it was replaced. Uploads without the intent never add a stamp; an identical plain re-upload
  clears this table's stamp, an apply re-upload restarts it; a fork inherits a stamp with its clock.
- **Not automated:** a character file loaded at another table, and a backup restoring the picture,
  rest on the existing `/assets/<hash>` handling (`sessionAssets` scans absolute URLs); the Imgur bake
  was checked live only; drop is unit-tested (Playwright e2e covers file pick, paste is unit-only).
- **Lesson video Player Path 3** (`site/video/src/lessons/playerPath3.ts`, its capture script and
  narration) still shows the removed "Token Image URL" field and "token art is set on a computer":
  the owner's to re-record.
- `MobileSurfaces.tsx` is at 349 of 350 lines: C5a must split before adding to it.
