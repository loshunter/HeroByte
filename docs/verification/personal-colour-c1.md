# Personal colour, slice C1 — colour identity

**Status: on local `dev`, not pushed (2026-10-09).** Built from
[`PROMPT-personal-colour-c1.md`](../planning/PROMPT-personal-colour-c1.md) and against
[`personal-colour-arc-plan.md`](../planning/personal-colour-arc-plan.md) §3 and its §8 revisions (both untracked:
the links work on this machine only). The commits on top of `91c69b63` are listed at the end, including two rounds
of a pre-merge review's fixes. Pushing and merging are the owner's word.

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
  loaded on demand. Other players' colours hold darkened zones; a mouse hovering one names whose it is, and on a
  phone a tap names it for three seconds. Dragging into a zone stops the handle at the edge that looks nearest and
  the line under the window reads `Too close to <name>`. Hue wraps left to right. A drag commits once, on release;
  a tap on the handle itself picks nothing; on a phone a vertical swipe on the window scrolls the sheet (only a drag
  from the handle, a tap or a sideways drag picks). Arrow keys step a cell (Shift: five) and commit once the keys go
  quiet (and when focus leaves or the window closes); every pick leaves the keyboard on the handle, so arrows never
  reach the table's own keys. Three dashed rings mark the most open colours (never the one you already have): one
  tap lands there. A preview row shows the name on navy, the portrait ring, and the token on a dark map floor and
  under fog; a hex readout below. The player's own other characters show as dashed dots. The DM's picker has no
  zones, rings or bump.
- **The server is the authority.** A player's chosen colour (the picker, a loaded character file) is kept when it is
  the colour the token already has (the rule runs only on a change; an older hsl string is then kept as it is),
  kept when allowed, moved to the nearest allowed colour when it falls in another player's zone, and given the most
  open allowed colour when it cannot be read. The sender alone is told, with the character's name when it is a PC
  players can see (`color-adjusted` → toast, e.g. `Bors's colour was too close to Annika's, so it moved to the
  nearest free one.`). Other colours from files are stored as `#rrggbb`. The DM's picks and table restores are not
  checked. Colour writes are budgeted per player (a burst of 10, then 5 a second); an over-budget write changes
  nothing and toasts `Too many colour changes at once: wait a moment and try again.`
- **Who holds a zone:** every owned PC visible to players whose token has a usable colour, on this map or (only
  from a restored file) waiting with another one. A PC with no owner, a PC hidden from players, NPCs and the DM's
  characters hold none. Colours that are not strings, empty, or longer than 64 characters never reach the rule.
- **Recolour** (double-click) picks a random colour no other player is using, at least max(r(N), ΔE 0.05) from the
  current one when a free colour that far exists (otherwise any free colour). The exemption follows the token's
  owner: the DM's own tokens take any colour, a player's token stays out of other players' zones even when the DM
  recolours it. It returns `save: true`; it was already saved, because every broadcast requests a save
  (`RoomService.broadcast`).
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
| Desktop party card name (card gradient `#3a3860` → `#2a2845`) | 3.00–3.86:1 | **not text-readable** |
| The DM's gold-brown card and roster row (`rgba(60,48,10,.9)`) | about 3.5–3.8:1 | depends on what shows through |

So the card names C1 colours on the desktop party card are not text-readable for the worst window colours; C3's
text rule (lift the colour for text only) is where that is fixed. Bands measured at C 0.17: 0.55–0.86 gives 3.60 /
3.25 / 3.69 on navy / indigo / fog, 0.60–0.86 gives 4.43 / 4.00 / 4.55, and the chosen 0.64–0.88 gives 5.21 / 4.70 /
5.34. Light maps (parchment) are not served by any band: the top row is light pastel (chroma 0.06–0.17). Older
`hsl` colours are kept as they are and can be much darker (the worst, `#2626d9`, is 2.14:1 on navy), and a player
can still store an allowed colour off the band through a file or a crafted message; C3's text rule has to handle any
colour.

**Rule.** `r(N) = clamp(sqrt(A · 0.5 / (π · N)), 0.03, 0.15)` in ΔE, with A = 2π·0.17 × 0.24 = 0.256 (the window in
ΔE units). The cap was 0.10 at first; at 0.15 the zones shrink from the second player on (0.143, 0.117, 0.101 for
N = 2, 3, 4), as the owner described. N counts the newcomer; the newcomer sees N−1 zones of radius r(N). Simulated
over 10 seeds each (worst shown): the k-th earlier player either picked a random colour allowed at r(k), the radius
in force when they picked, or joined automatically (the server's draw among colours allowed at r(k)):

| N | r(N) ΔE | free for the Nth player, random picks | free for the Nth player, automatic joins |
| --- | --- | --- | --- |
| 2 | 0.143 | 70% | 72% |
| 3 | 0.117 | 67% | 67% |
| 4 | 0.101 | 61% | 67% |
| 5 | 0.090 | 59% | 62% |
| 6 | 0.082 | 58% | 65% |
| 7 | 0.076 | 55% | 62% |
| 8 | 0.071 | 59% | 62% |
| 9 | 0.067 | 55% | 59% |
| 10 | 0.064 | 54% | 59% |
| 11 | 0.061 | 54% | 59% |
| 12 | 0.058 | 55% | 57% |
| 13 | 0.056 | 52% | 58% |
| 14 | 0.054 | 55% | 55% |
| 15 | 0.052 | 54% | 57% |
| 16 | 0.050 | 52% | 55% |
| 17 | 0.049 | 56% | 56% |
| 18 | 0.048 | 54% | 53% |
| 19 | 0.046 | 53% | 55% |
| 20 | 0.045 | 54% | 55% |
| 21 | 0.044 | 54% | 56% |
| 22 | 0.043 | 54% | 55% |
| 23 | 0.042 | 52% | 55% |
| 24 | 0.041 | 55% | 56% |
| 25 | 0.040 | 54% | 56% |
| 26 | 0.040 | 54% | 56% |
| 27 | 0.039 | 53% | 54% |
| 28 | 0.038 | 53% | 55% |
| 29 | 0.038 | 53% | 55% |
| 30 | 0.037 | 53% | 54% |

In these simulations a newcomer kept at least 52% of the window (51.8% at N = 16). A reviewer's greedy adversary
(each pick allowed when made, chosen to cover the most window) left about 45% at N = 30 with these constants; the
true worst may be lower. Zones never go below ΔE 0.037 (about twice a just-noticeable difference) up to 30 players.

**Cost.** The rule's loops run over packed arrays with squared distances: about 8× faster than the first version at
100 other PCs and about 48× at 500 (reviewer measurements). The write budget bounds picks and recolours. A new
token for a player's first character still runs the rule once per creation (about 3 ms at 100 PCs, 12 ms at 500,
reviewer measurement), and such a message also broadcasts; a per-player character cap would bound that (open below).

**Bundle.** The picker is a lazy chunk (`ColorPicker-*.js`, 4.75 KB gzip plus 0.8 KB CSS after the review's fixes,
reviewer measurement). The entry bundle was 166.71 KB of the 175 KB budget after the lazy split (`d60d25d3`; it was
170.37 KB with the picker eager) and 166.84 KB on `b98e4645`; the final figure is in the gates section.

## Evaluation (evaluate-live)

**Mode achieved: `live-two-client`** — two clients on the local dev server (desktop 1100 × 760 as Player 17;
phone preset 375 × 812 with touch as Player 18), plus three Playwright two-client/phone specs. Fog was **not**
driven live; it is pinned by a server contract test (a fogged-out token's colour still on its record).

What was driven live (before the review):

- Join gave Player 17 `#fbacff` automatically; the 16 legacy players kept their hsl colours; DMs (Players 9, 13,
  15) showed no zones.
- A real click on Player 1's colour bumped the handle to the zone's edge (`#00ecb7`), showed `Too close to …`,
  sent one `set-token-color`; the server kept it.
- A crafted message carrying Player 1's exact colour was moved to `#00c7ba` with the (then) toast
  `Moved to the nearest free colour: too close to Player 1's.`
- Player 18 (phone) saw Player 17's zone; Player 17's recolour moved it in Player 18's open picker without a reload.
- Phone: window 317 × 124 px, spots 44 × 44, a handle touch target 50 px across (11 px past its 28 px content box,
  8 px past its 3 px border); one tap on a spot sent one message and set `#b98aff`.
- Player 17 elevated to DM: their picker lost every zone and spot; Player 18's picker stopped showing them.
- Server restart (tsx watch): both colours survived; the colour is stored on the token and its scene object only,
  never on the character record.

Live-pass findings, fixed in `6cffa30b`: suggestion 1 sat under the handle; the bump notice outlived the server's
answer; the notice wrapped to two lines and pushed the preview down.

**The score was given before the review, and was too high.** The review then found, among others, two majors that
were live at the time (arrow keys on the colour handle walked a selected token; loading your own file moved your
colour), and later a phone swipe that recoloured you. Functionality should have been about 6, not 8. The live pass
was not repeated for every later fix; the e2e specs cover only the spot tap, the sender-only notice, the phone's
reach, fit and touch actions, and the rest is unit and contract tests.

| Criterion | Weight | Score (before review) | Why |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8 (should have been ~6) | Two live majors were not found by the live pass |
| Multiplayer integrity | 0.30 | 8 | Two clients agree live; snap notice to the sender only (e2e); fog pinned by contract test, not driven live |
| Craft | 0.20 | 7 | Notices for bump and snap, lazy-chunk loading and failure states; the window is small in the 280 px desktop window |
| Reach | 0.15 | 8 | Phone sheet, 44 px spots, one-tap path; WebKit not run |

## Pre-merge review (review-convergence)

Round 1: four read-only reviewers (server rule, client picker, docs against code, privacy and test validity). **All
four returned FAIL.** The union was fixed in `f2e6ddba`, `3f65acd8`, `51dbd41f`, `5b2cc0ad`, `b98e4645`:

- **Major:** arrow keys on the handle walked the selected token; loading your own file moved your colour; NPC tokens
  were steered onto the next player's colour; colour writes had unbounded cost; the "NPCs never count" test could
  not fail; the record and commit messages claimed recolour and delete were never saved (every broadcast saves; the
  delete commit is reverted).
- **Minor:** unrounded snap checks; automatic draws inside zones; one player's characters spreading zones; owner-less
  and hidden PCs; waiting tokens; tap, right-click and second-finger picks; keys per press and lost on blur; stuck
  picks; the aspect; tooltip-only labels; the memo key; toast copy; lazy-chunk styles; weak tests; doc numbers.

Round 2: four fresh reviewers. **All four returned FAIL**, with new defects (several introduced by round 1's
fixes). The union was fixed in `79cd57ac`, `53e7ed4c`, `326e27de` and the docs commit after them:

- **Major:** the hsl parser backtracked super-linearly (22.7 s on 128k characters) and a restored table's colours
  are unchecked; a non-string token colour crashed every rule caller, blocking every join; the DM's recolour of a
  player's token ignored zones; a phone swipe on the window recoloured you; after a click in the window arrow keys
  walked your token; an earlier pick's timeout erased later key steps (a round-1 regression); the "own characters may
  share" test passed without running the rule; the record's numbers (the simulation method, a missing contrast row).
- **Minor:** a hidden NPC's name could reach an ex-DM in the notice; a stale waiting copy beat a live token; a
  dropped write was acked as a silent success; the budget mis-handled a backwards clock and never pruned; tap labels
  vanished on phones; the tap slop; held keys; keys and pointer double-sending; slow answers clearing later picks;
  PlayerCard's memo ignoring the picker; the screen-reader lightness for older colours; doc and comment wording.
- **Not fixed (owner question):** a player can store an allowed colour that is off the window's band (black, greys)
  through a file or a crafted message. Snapping such colours onto the band would also move legacy hsl colours on
  every file load; see "Open for the owner".

Round 3 (the last before escalation) follows.

## Gates

Full ladder on `d60d25d3` (before the review): **GATES: PASS** — shared 511, server 2918, client 8216 (4 skipped)
tests; e2e 373 passed, 3 skipped (the three baseline skips); dev boot clean. An earlier run on `2e956229` had one e2e
failure (`live-map-toolbar.smoke.spec.ts:125`, `ERR_CONNECTION_FAILED` to the e2e client rail) that passed alone and
in the next full run.

Full ladder on `b98e4645` (after round 1): every gate passed except one e2e test, the new
`personal-colour.spec.ts` snap test, which raced the broadcast (it read Bob's colour before the change arrived);
fixed in `79cd57ac` and 10/10 on `--repeat-each=5`. The ladder is re-run on the final tree before round 3.

## Found on the way

- **Fixed:** condition medallions stroked `var(--jrpg-border-gold)`, which a canvas silently ignores (checked in the
  browser), so the rings were never gold — `2e956229`.
- **Changed, not a bug:** recolour now returns `save: true`. Plan §5's `save: false` lost nothing: the broadcast
  already saves the room (`room/service.ts` ~240). The same change to `delete-token` (`72be1566`) was reverted in
  `f2e6ddba` for that reason.
- **Not fixed, reported:** `.player-portrait` (with the shimmer that ignores `data-motion`) is dead CSS — no
  component uses the class (`theme/herobyte.css` ~644-723). `TokenModel.randomColor` (`packages/shared/src/models.ts`)
  still makes hsl colours and has no callers.
- **Not touched:** a double-tap recolour on phones (plan §5 says another task is checking it).
- **Not touched:** `add-player-character` has no per-player cap (characters are capped only on session load, at 500).

## Corrections to commit messages (unpushed; not rewritten)

- `4e012cad`: ">= 53%" holds only when every earlier pick is checked at the newcomer's radius; checked at the radius
  in force when each picked, the worst was 51%. "So names stay readable" is false on the desktop party card (3.00:1).
- `a436bb73`: "a recolour was lost if the server died" is false (every broadcast saves); an unreadable colour's
  replacement is the most open allowed colour, not "the nearest"; "existing colours are kept until changed" was false
  at that commit (the rule re-ran on an unchanged colour, fixed in `51dbd41f`).
- `72be1566` (reverted by `f2e6ddba`): its premise, that a deleted token came back after a restart, was false.
- `51dbd41f`: "38% of 3-player tables" was measured with the 0.10 cap; with the 0.15 cap in force at that commit it
  is about 44% (77% for 5 players holds). Its "this bounds what a spamming client can spend" covers picks and
  recolours, not new tokens.
- `5b2cc0ad`: "the screen-reader lightness is the real OKLab lightness" was false for older hsl colours until
  `326e27de`.

## Open for the owner

- The **player guide** and the **character-card lesson script** (`docs/user-guide/player-guide.md`,
  `docs/website/video-scripts.md` Player path 3, chapters 5 and 7) are edited but **left uncommitted**: your own
  uncommitted edits sit in the same hunks. `docs/website/narration-wren.md` (also yours, uncommitted) still narrates
  "a new random colour" in chapter 5, lacks the script's picker lines there (the script films the picker), and lacks
  "your colour" in chapter 7; it was not touched.
- **Colours off the band:** should the server snap a player's allowed-but-off-band colour (black, greys, a legacy
  dark hsl from a file) onto the window? It would make every colour readable, and move older colours on file loads.
- **Light maps:** the band serves dark maps, fog and the panels; a light pastel colour on a parchment map is low
  contrast. C3's selection keyline is the place to handle it if it matters.
- **Crowded legacy tables** push newcomers' automatic colours into the light pastels. Anyone can move with the
  picker.
- **A per-player character cap** for `add-player-character` would bound new-token cost and the table further.

## Commits (on `91c69b63`)

`4e012cad` shared colour module · `a436bb73` server rule, notice, wire colour · `72be1566` delete-token save
(reverted) · `5e6416f6` MobileRowHeader split · `6102d674` the picker · `6cffa30b` live-pass fixes · `2378e7c8` in-app
help · `2e956229` medallion rings · `ec31b4f3` e2e specs · `d60d25d3` lazy picker · `f2e6ddba` revert of `72be1566` ·
`3f65acd8` rule: cost, stored-hex judging, allowed draws, r cap 0.15 · `51dbd41f` server: unchanged colours, NPCs,
inheritance, write budget, holders · `5b2cc0ad` picker: keys, taps, batching, notices, a11y · `b98e4645` record, help,
schema · `79cd57ac` snap spec race · `53e7ed4c` parser bound, non-strings, DM recolour, hidden names, budget · `326e27de`
picker: phone swipe, focus, timeouts, labels, memo · then the docs commit for round 2.
