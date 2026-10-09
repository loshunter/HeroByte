# Personal colour, slice C1 — colour identity

**Status: on local `dev`, not pushed (2026-10-09).** Built from
[`PROMPT-personal-colour-c1.md`](../planning/PROMPT-personal-colour-c1.md) (untracked) against
[`personal-colour-arc-plan.md`](../planning/personal-colour-arc-plan.md) §3 and its §8 revisions. Fourteen commits on
top of `91c69b63` (listed at the end), including a pre-merge review's fixes. Pushing and merging are the owner's word.

## The owner's decisions it builds

1. No two players share a colour. Each colour holds a zone; zones shrink as players join; a placed colour is never
   moved by someone joining.
2. A player's own characters may share a colour or sit close to it.
3. The DM is exempt both ways (their picks are not checked, their colours block no one). Finishes are C2's.
4. A free picker (not a palette), on desktop and phone in the same slice.

## What it does

- **New tokens get a colour.** A player's first character gets an open spot far from every other player's colour
  (a draw among the allowed colours within 8% of the most open one; DM and NPC colours do not count). Their further
  characters start in that player's colour. NPC tokens get any window colour. Stored as `#rrggbb`. The choice never
  fails, so it can never block a join.
- **⚙️ settings → Character → Colour** (desktop) and the row's **⚙️ EDIT** sheet (phone): a hue × lightness window,
  loaded on demand. Other players' colours hold darkened zones; hovering one names whose it is; dragging into one
  stops the handle at the edge that looks nearest and the line under the window reads `Too close to <name>`. Hue
  wraps left to right. A drag commits once, on release; a tap on the handle itself picks nothing; arrow keys step a
  cell (Shift: five) and commit once the keys go quiet (and when focus leaves or the window closes), and never reach
  the table's own keys. Three dashed rings mark the most open colours (never the one you already have): one tap
  lands there. A preview row shows the name on navy, the portrait ring, and the token on a dark map floor and under
  fog; a hex readout below. The player's own other characters show as dashed dots. The DM's picker has no zones,
  rings or bump.
- **The server is the authority.** A chosen colour (the picker, a loaded character file) is kept when it is the
  colour the token already has (the rule runs only on a change), kept when allowed, moved to the nearest allowed
  colour when it falls in another player's zone, and given the most open allowed colour when it cannot be read. The
  sender alone is told, with the character's name (`color-adjusted` → toast, e.g. `Bors's colour was too close to
  Annika's, so it moved to the nearest free one.`). Legacy `hsl(...)` colours from files are read and normalised.
  Table restores are not re-checked. Colour writes are budgeted per player (a burst of 10, then 5 a second).
- **Who holds a zone:** every owned PC visible to players, with its token on this map or waiting with another one.
  A PC with no owner, a PC hidden from players, NPCs and the DM's characters hold none.
- **Recolour** (double-click) picks a random colour no other player is using, at least max(r(N), ΔE 0.05) from the
  current one when a free colour that far exists (otherwise any free colour). It returns `save: true`; it was
  already saved, because every broadcast requests a save (`RoomService.broadcast`).
- **Every PC's colour rides its character record on the wire** (`SnapshotCharacter.color`, derived at send time and
  never stored in room state; an exported session file carries it and the loader strips it). Fog drops another
  player's token from a payload but never a party record, so the picker's zones (and, in C3, pings and names) see
  every colour on every screen.
- **Existing colours are kept** until they change: the 16 legacy players on the local test table kept their
  `hsl(h, 70%, 50%)` strings, and loading your own file with your current colour changes nothing.

## Chosen and stated (numbers)

**Window.** OKLCH, target chroma **0.17**, lightness band **0.64–0.88** (light at the top), each point showing
`min(0.17, sRGB gamut)`; raster 180 × 60 cells (2° of hue × 0.004 L). Measured with the gamut maximum below the
target, about two-thirds of the cells clip at C 0.17 (58% at 0.16, 74% at 0.18); a clipped cell shows the most vivid
colour sRGB has there. The band was raised from the plan's 0.45–0.85 for contrast. Worst window colour (`#d9588e`):

| Surface | Worst window colour | |
| --- | --- | --- |
| Navy `#0f0e1e` | 5.21:1 | text-readable |
| Indigo panels `#1c1734` (settings window, phone rows) | 4.70:1 | text-readable |
| Fog `#0b0b16` | 5.34:1 | |
| `--hero-navy` `#202020` | 4.45:1 | just under 4.5 |
| Preview's map floor `#2a2622` | 4.10:1 | |
| `--jrpg-panel` `#232638` | 4.08:1 | |
| The DM's gold-brown card and roster row (`rgba(60,48,10,.9)`) | about 3.5–3.8:1 | depends on what shows through |

Bands measured at C 0.17: 0.55–0.86 gives 3.60 / 3.25 / 3.69 on navy / indigo / fog, 0.60–0.86 gives 4.43 / 4.00 /
4.55, and the chosen 0.64–0.88 gives 5.21 / 4.70 / 5.34. Light maps (parchment) are not served by any band: the top
row is light pastel (chroma 0.06–0.17). Older `hsl` colours are kept as they are and can be much darker (the worst,
`#2626d9`, is 2.14:1 on navy); C3's text rule has to handle any colour.

**Rule.** `r(N) = clamp(sqrt(A · 0.5 / (π · N)), 0.03, 0.15)` in ΔE, with A = 2π·0.17 × 0.24 = 0.256 (the window in
ΔE units). The cap was 0.10 at first; at 0.15 the zones shrink from the second player on (0.143, 0.117, 0.101 for
N = 2, 3, 4), as the owner described. N counts the newcomer; the newcomer sees N−1 zones of radius r(N). Simulated
over 10 seeds each (worst shown), with each earlier player either picking a random allowed colour or joining
automatically (the server's draw among allowed colours):

| N | r(N) ΔE | free for the Nth player, random picks | free for the Nth player, automatic joins | about how many more zones fit (worst random) |
| --- | --- | --- | --- | --- |
| 2 | 0.143 | 70% | 72% | 2.8 |
| 3 | 0.117 | 66% | 67% | 4.0 |
| 4 | 0.101 | 62% | 67% | 5.0 |
| 5 | 0.090 | 59% | 62% | 5.9 |
| 6 | 0.082 | 62% | 65% | 7.5 |
| 7 | 0.076 | 60% | 62% | 8.4 |
| 8 | 0.071 | 58% | 62% | 9.3 |
| 9 | 0.067 | 56% | 59% | 10.1 |
| 10 | 0.064 | 56% | 59% | 11.2 |
| 11 | 0.061 | 56% | 59% | 12.3 |
| 12 | 0.058 | 55% | 57% | 13.3 |
| 13 | 0.056 | 56% | 58% | 14.4 |
| 14 | 0.054 | 56% | 55% | 15.6 |
| 15 | 0.052 | 55% | 57% | 16.6 |
| 16 | 0.050 | 55% | 55% | 17.5 |
| 17 | 0.049 | 55% | 56% | 18.7 |
| 18 | 0.048 | 55% | 53% | 19.9 |
| 19 | 0.046 | 54% | 55% | 20.6 |
| 20 | 0.045 | 54% | 55% | 21.8 |
| 21 | 0.044 | 55% | 56% | 23.1 |
| 22 | 0.043 | 54% | 55% | 23.9 |
| 23 | 0.042 | 54% | 55% | 25.0 |
| 24 | 0.041 | 56% | 56% | 26.8 |
| 25 | 0.040 | 55% | 56% | 27.4 |
| 26 | 0.040 | 55% | 56% | 28.6 |
| 27 | 0.039 | 53% | 54% | 28.8 |
| 28 | 0.038 | 55% | 55% | 30.7 |
| 29 | 0.038 | 53% | 55% | 30.9 |
| 30 | 0.037 | 54% | 54% | 32.6 |

In these simulations a newcomer kept at least 53% of the window. Picks chosen deliberately to cover the most window
(each allowed when made) can leave about 46% (measured by a reviewer with the 0.10 cap). Zones never go below
ΔE 0.037 (about twice a just-noticeable difference) up to 30 players.

**Cost.** The rule's loops run over packed arrays with squared distances: a reviewer measured the old version at
22.7 ms per colour write at 100 other PCs and 539 ms at 500, and the packed form about 10× faster. With the
per-player write budget and later characters inheriting their player's colour, a spamming client cannot spend the
server's time.

**Bundle.** The picker is a lazy chunk (`ColorPicker-*.js`, about 4 KB gzip plus 0.8 KB CSS). The entry bundle was
**166.71 KB** of the 175 KB budget after the lazy split (170.37 KB with the picker eager); re-measured after the
review's fixes below.

## Evaluation (evaluate-live)

**Mode achieved: `live-two-client`** — two clients on the local dev server (desktop 1100 × 760 as Player 17;
phone preset 375 × 812 with touch as Player 18), plus three Playwright two-client/phone specs. Fog was **not**
driven live; it is pinned by a server contract test (a fogged-out token's colour still on its record). The live pass
ran before the review's fixes; the e2e specs cover them.

What was driven live:

- Join gave Player 17 `#fbacff` automatically; the 16 legacy players kept their hsl colours; DMs (Players 9, 13,
  15) showed no zones.
- A real click on Player 1's colour bumped the handle to the zone's edge (`#00ecb7`), showed `Too close to …`,
  sent one `set-token-color`; the server kept it.
- A crafted message carrying Player 1's exact colour was moved to `#00c7ba` with the (then) toast
  `Moved to the nearest free colour: too close to Player 1's.`
- Player 18 (phone) saw Player 17's zone; Player 17's recolour moved it in Player 18's open picker without a reload.
- Phone: window 317 × 124 px, spots 44 × 44, handle touch target 50 px (28 px dot, 11 px reach each side); one tap
  on a spot sent one message and set `#b98aff`.
- Player 17 elevated to DM: their picker lost every zone and spot; Player 18's picker stopped showing them.
- Server restart (tsx watch): both colours survived; the colour is stored on the token and its scene object only,
  never on the character record.

Live-pass findings, fixed in `6cffa30b`: suggestion 1 sat under the handle; the bump notice outlived the server's
answer; the notice wrapped to two lines and pushed the preview down.

| Criterion | Weight | Score | Why |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8 | Every path works, error states included; character-file load not driven live (the pane cannot upload), pinned server-side |
| Multiplayer integrity | 0.30 | 8 | Two clients agree live; snap notice to the sender only (e2e); fog pinned by contract test, not driven live |
| Craft | 0.20 | 7 | Notices for bump and snap, lazy-chunk loading and failure states; the window is small in the 280 px desktop window |
| Reach | 0.15 | 8 | Phone sheet, 44 px spots, one-tap path; WebKit not run |
| **Weighted** | | **7.8** | Pass (threshold 7.0) |

## Pre-merge review (review-convergence), round 1

Four read-only reviewers (server rule, client picker, docs against code, privacy and test validity). **All four
returned FAIL.** Every finding was taken (the union), and all of them are fixed in `f2e6ddba`, `3f65acd8`,
`51dbd41f`, `5b2cc0ad` and the docs commit after them, each fix with a test that went red under a sabotage:

- **Major:** arrow keys on the colour handle walked the viewer's selected token; loading your own character file
  moved your long-held colour (the rule re-ran on an unchanged colour); NPC tokens were steered onto the colour the
  next player would get; every colour write scanned 10,800 cells × every PC with no bound on PCs; the "NPCs never
  count" test could not fail; the record and two commit messages claimed recolour and delete were never saved (every
  broadcast saves: the delete commit is reverted, the claims corrected here).
- **Minor:** snap checks used the unrounded request; the automatic draw could land in a zone; one player's many
  characters spread zones; a PC with no owner held a zone the picker never drew; a hidden PC could be named in a
  notice; a waiting token's PC lost its wire colour; a tap on the handle committed; right-clicks and second fingers
  committed; keyed colours were lost on blur and sent one message per press; a pick answered unchanged kept showing;
  the edge-stop used the wrong aspect; zone labels were tooltip-only; the memo key missed renames; the toast said
  "nearest" for an unreadable colour and named nobody; loading styles shipped inside the lazy chunk; several tests
  were too weak to fail; and the doc and number corrections now in this record.

Round 2 (fresh reviewers on the whole diff) follows.

## Gates

Full ladder on `d60d25d3` (before the review's fixes): **GATES: PASS** — shared 511, server 2918, client 8216
(4 skipped) tests; e2e **373 passed, 3 skipped** (the three baseline skips), no failed or flaky lines; dev boot clean.
An earlier run on `2e956229` had one e2e failure (`live-map-toolbar.smoke.spec.ts:125`, `ERR_CONNECTION_FAILED` to
the e2e client rail at test #141 of 373) that passed alone and in the next full run. The ladder is re-run on the
fixed tree before round 2.

## Found on the way

- **Fixed:** condition medallions stroked `var(--jrpg-border-gold)`, which a canvas silently ignores (checked in the
  browser), so the rings were never gold — `2e956229`.
- **Changed, not a bug:** recolour now returns `save: true`. Plan §5's `save: false` lost nothing: the broadcast
  already saves the room (`room/service.ts` ~240). The same change to `delete-token` (`72be1566`) was reverted in
  `f2e6ddba` for that reason.
- **Not fixed, reported:** `.player-portrait` (with the shimmer that ignores `data-motion`) is dead CSS — no
  component uses the class (`theme/herobyte.css` ~644-723).
- **Not touched:** a double-tap recolour on phones (plan §5 says another task is checking it).
- **Not touched:** `add-player-character` has no per-player cap (characters are capped only on session load, at 500).

## Corrections to commit messages (unpushed; not rewritten)

- `a436bb73` says recolour "was broadcast-only since the first commit, so a recolour was lost if the server died".
  False: every broadcast saves. It also calls an unreadable colour's replacement "the nearest allowed colour"; it is
  the most open one.
- `72be1566` (reverted by `f2e6ddba`): its premise, that a deleted token came back after a restart, was false.
- `4e012cad` says a newcomer keeps ">= 53%" of the window; with that commit's constants the worst simulated case was
  51%. The current table is above.

## Open for the owner

- The **player guide** and the **character-card lesson script** (`docs/user-guide/player-guide.md`,
  `docs/website/video-scripts.md` Player path 3, chapters 5 and 7) are edited but **left uncommitted**: your own
  uncommitted edits sit in the same hunks. `docs/website/narration-wren.md` (also yours, uncommitted) still narrates
  "a new random colour" for that chapter and was not touched.
- **Light maps:** the band serves dark maps, fog and the panels; a light pastel colour on a parchment map is low
  contrast. C3's selection keyline is the place to handle it if it matters.
- **Crowded legacy tables** push newcomers' automatic colours into the light pastels (the open space left by many
  mid-lightness hsl colours). Anyone can move with the picker.
- **A per-player character cap** for `add-player-character` would bound the table further; the write budget and the
  inherited colours already bound the rule's cost.

## Commits (on `91c69b63`)

`4e012cad` shared colour module · `a436bb73` server rule, notice, wire colour · `72be1566` delete-token save
(reverted) · `5e6416f6` MobileRowHeader split · `6102d674` the picker · `6cffa30b` live-pass fixes · `2378e7c8` in-app
help · `2e956229` medallion rings · `ec31b4f3` e2e specs · `d60d25d3` lazy picker · `f2e6ddba` revert of `72be1566` ·
`3f65acd8` rule: cost, stored-hex judging, allowed draws, r cap 0.15 · `51dbd41f` server: unchanged colours, NPCs,
inheritance, write budget, holders · `5b2cc0ad` picker: keys, taps, batching, notices, a11y.
