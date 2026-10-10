# Personal colour, slice C1 — colour identity

**Status: pushed to `origin/dev` (2026-10-09), not on main.** Built from
[`PROMPT-personal-colour-c1.md`](../planning/PROMPT-personal-colour-c1.md) and against
[`personal-colour-arc-plan.md`](../planning/personal-colour-arc-plan.md) §3 and its §8 revisions (both untracked:
the links work on this machine only). The commits on top of `91c69b63` are listed at the end, including four
rounds of a pre-merge review's fixes. Round 3 was the review's cap and went to the owner, who chose darker colours
and a tap that picks in a zone, then allowed one more round (round 4) before a push to `dev`. **Round 4's fixes have
not been reviewed.** Main is the owner's word, and **C1 goes to main only together with C3**: its darkest colours are
unreadable as text on the dark panels until C3's text rule lifts them.

## The owner's decisions it builds

1. No two players share a colour. Each colour holds a zone; zones shrink as players join; a placed colour is never
   moved by someone joining.
2. A player's own characters may share a colour or sit close to it.
3. The DM is exempt both ways (their picks are not checked, their colours block no one). Finishes are C2's.
4. A free picker (not a palette), on desktop and phone in the same slice.
5. Darker colours (2026-10-09, after the review): the window runs down to L 0.30. Readability is C3's (text) and the
   frames' (lit facets), never a fixed bright rim: frames are any material and palette.

## What it does

- **New tokens get a colour.** A player's first character gets an open spot far from every other player's colour
  (a draw among the allowed colours within 8% of the most open one; DM and NPC colours do not count). Their further
  characters start in that player's colour. NPC tokens get a random colour that reads on a dark map (at least 3:1 on
  the map floor, about L 0.57 up: an NPC has no picker to fix an unreadable one). Stored as `#rrggbb`. The choice never
  fails, so it can never block a join.
- **⚙️ settings → Character → Colour** (desktop) and the row's **⚙️ EDIT** sheet (phone): a hue × lightness window,
  loaded on demand. Other players' colours hold striped zones (a dark and a light stripe, so a zone shows at any lightness); a mouse hovering one names whose it is
  without picking. A drag or a tap into a zone stops the handle at the edge that looks nearest and
  the line under the window reads `Too close to <name>`. Hue wraps left to right. A drag commits once, on release;
  a tap on the handle itself picks nothing; on a phone a vertical swipe on the window scrolls the sheet (only a drag
  from the handle, a tap anywhere else on the window, or a sideways drag picks); a tap commits the colour its press
  showed. A bump's notice holds three seconds; a mouse's hover labels return once no notice is held. Arrow keys step
  a cell (Shift: five; a step skips the few dark cells that round to the colour it left) and commit once the keys go
  quiet (and when focus leaves or the window closes); a tap on the handle leaves them to commit, a tap or drag
  elsewhere replaces them (one message, the pointer's), and a press the browser cancels as a scroll sends them. Every
  pick leaves the keyboard on the handle, so arrows never reach the table's own keys. The server's answer to an
  earlier pick never pulls the handle back from keys or a drag still choosing, and a pick it answered without showing
  (a snap, a refusal) stops showing after 1.5 s. Three dashed rings mark the most open colours (never the one you
  already have): one tap lands there. A preview row shows the name on navy, the portrait ring, and the token on a
  dark map floor and under fog; a hex readout below. The player's own other characters show as small white-edged
  squares. A player is offered a picker only for a token they own. The DM's picker has no zones, rings or bump.
- **The server is the authority.** A player's chosen colour (the picker, a loaded character file) is kept when it is
  the colour the token already has (the rule runs only on a change; an older hsl string is then kept as it is),
  kept when allowed, moved to the nearest allowed colour when it falls in another player's zone, and given the most
  open allowed colour when it cannot be read. The sender alone is told, with the character's name when it is a PC
  players can see (`color-adjusted` → toast, e.g. `Bors's colour was too close to Annika's, so it moved to the
  nearest free one.`). Other readable colours from files (`#rgb`, `hsl()`, and `#rrggbbaa` / `#rgba` with the
  alpha dropped) are stored as `#rrggbb`; `rgb()` and named colours are unreadable. The DM's picks and table restores
  are not checked (a DM's unreadable colour is ignored: the token keeps its colour, with no notice). Colour writes are
  budgeted per player (a burst of 10, then 5 a second); an over-budget write changes nothing and toasts `Too many
  colour changes at once: wait a moment and try again.` That reply goes only to someone who may colour the token (its
  owner, or the DM) and carries no colour: a write naming any other token gets no reply at all, so the budget says
  nothing about tokens the sender cannot see, and an owner who can no longer see their token (a hidden NPC an ex-DM
  placed) learns nothing of its colour.
- **Who holds a zone:** every owned PC visible to players whose token has a usable colour, on this map or (only
  from a restored file) waiting with another one. A PC with no owner, a PC hidden from players, NPCs and the DM's
  characters hold none. Colours that are not strings or are empty never reach the rule; one it cannot read
  (anything over 64 characters is never parsed) holds no zone but still counts its player in N. One colour blocks
  once, however many characters wear it.
- **Recolour** (double-click) picks a random colour no other player is using, at least max(r(N), ΔE 0.05) from the
  current one when a free colour that far exists (otherwise any free colour). The exemption follows whose
  colour it is: a PC's player for a PC's token, else the token's owner (the two differ only after a DM's link or in a
  restored file; "clear all" keeps a PC's locked token with its player). The DM's own tokens take a random colour that
  reads on a dark map; a player's stays out of other players' zones even when the DM recolours it. It returns `save: true`; it was already saved, because every broadcast requests a save
  (`RoomService.broadcast`).
- **Every PC's colour rides its character record on the wire** (`SnapshotCharacter.color`, derived at send time and
  never stored in room state; an exported session file carries it and the loader strips it). Fog drops another
  player's token from a payload but never a party record, so the picker's zones (and, in C3, pings and names) see
  every colour on every screen.
- **Existing colours are kept** until they change: the 16 legacy players on the local test table kept their
  `hsl(h, 70%, 50%)` strings, and loading your own file with your current colour changes nothing.

## Chosen and stated (numbers)

**Window.** OKLCH, target chroma **0.17**, lightness band **0.30–0.88** (light at the top), each point showing
`min(0.17, sRGB gamut)`; raster 180 × 100 cells (2° of hue × 0.0058 L, about square). About two-thirds of the
cells clip at C 0.17 (66.2–66.8% by tolerance); a clipped cell shows the most vivid colour sRGB has there.

**History.** The plan said 0.45–0.85. C1 was built and reviewed at 0.64–0.88, raised for contrast (the table below).
On 2026-10-09 the owner chose darker colours and the band now runs to 0.30, the owner's floor (below it the colours
crowd toward black). The darkest window colour now, `#390076`, on each surface: navy `#0f0e1e` 1.30, indigo 1.18, fog
1.34, `--hero-navy` 1.11, the preview's map floor 1.03, `--jrpg-panel` 1.02, the desktop card gradient 1.04–1.33, the
DM's card 1.13; the worst window colours on those two are other dark shades at 1.00 (`#00442d`, `#3a3100`). So most of
the dark half fails 4.5:1 for text on navy (no colour reaches it below about L 0.56), and below about L 0.50 even 3:1
as a bare fill: C3's text lift and the frames' lit facets carry it, and C1 waits for C3. The picker's zones were drawn
darkened; in the dark half that fell to 1.35:1 against the free colours beside them, so they are now diagonal stripes
(the colour × 0.2, and the colour washed 75% toward white): the better of the two stripes is at least 3.55:1 against
the free colour beside it at every lightness (all 18,000 cells measured). Your other characters' dots became small
white-edged squares (a dashed ring read as a suggested spot), and the suggested spots got a navy edge, so both show on
the dark half and the pastels.

The 0.64–0.88 band's worst colour (`#d9588e`), kept for comparison:

| Surface | Worst window colour | |
| --- | --- | --- |
| Navy `#0f0e1e` | 5.21:1 | text-readable |
| Indigo `#1c1734` (`--jrpg-indigo`) | 4.70:1 | text-readable |
| Fog `#0b0b16` | 5.34:1 | |
| `--hero-navy` `#202020` | 4.45:1 | just under 4.5 |
| Preview's map floor `#2a2622` | 4.10:1 | |
| `--jrpg-panel` `#232638` | 4.08:1 | |
| Desktop party card name (card gradient `#3a3860` → `#2a2845`) | about 2.9–3.9:1 (3.00–3.86 on the gradient; its 1.5% white noise takes the lighter pixels to 2.87) | **not text-readable** |
| The DM's gold-brown card and roster row (`rgba(60,48,10,.9)`) | about 3.5–3.8:1 | depends on what shows through |

So the card names C1 colours on the desktop party card are not text-readable for the worst window colours; C3's
text rule (lift the colour for text only) is where that is fixed. Bands measured at C 0.17: 0.55–0.86 gives 3.60 /
3.25 / 3.69 on navy / indigo / fog, 0.60–0.86 gives 4.43 / 4.00 / 4.55, and the chosen 0.64–0.88 gives 5.21 / 4.70 /
5.34. Light maps (parchment) were served by no band; the new dark half serves them (the top rows are light pastel,
chroma 0.06–0.17). Older `hsl` colours are kept as they are (`#2626d9`, 2.14:1 on navy, now sits inside the band),
and a player can still store an allowed colour off the window (darker than 0.30, grey) through a file or a crafted
message; C3's text rule has to handle any colour.

**Rule.** `r(N) = clamp(sqrt(A · 0.5 / (π · N)), 0.03, 0.25)` in ΔE, with A = 2π·0.17 × 0.58 = 0.620 (the window in
ΔE units, nominal: it ignores the clipped dark corner). The cap was 0.10 at first and 0.15 on the 0.64–0.88 band; on
the darker band it is 0.25, above r(2), so the zones still shrink from the second player on (0.222, 0.181, 0.157 for
N = 2, 3, 4), as the owner described. N counts the newcomer; the newcomer sees one zone of radius r(N) per other
player's colour (N−1 when each has one, as simulated). Simulated over 10 seeds each (worst shown): the k-th earlier player either picked a random colour allowed at r(k), the radius
in force when they picked, or joined automatically (the server's draw among colours allowed at r(k)):

| N | r(N) ΔE | free for the Nth player, random picks | free for the Nth player, automatic joins |
| --- | --- | --- | --- |
| 2 | 0.222 | 60% | 59% |
| 3 | 0.181 | 56% | 57% |
| 4 | 0.157 | 53% | 59% |
| 5 | 0.140 | 53% | 50% |
| 6 | 0.128 | 53% | 55% |
| 7 | 0.119 | 49% | 54% |
| 8 | 0.111 | 50% | 51% |
| 9 | 0.105 | 51% | 54% |
| 10 | 0.099 | 50% | 53% |
| 11 | 0.095 | 52% | 51% |
| 12 | 0.091 | 50% | 52% |
| 13 | 0.087 | 50% | 52% |
| 14 | 0.084 | 49% | 52% |
| 15 | 0.081 | 49% | 50% |
| 16 | 0.079 | 49% | 49% |
| 17 | 0.076 | 48% | 50% |
| 18 | 0.074 | 50% | 49% |
| 19 | 0.072 | 48% | 49% |
| 20 | 0.070 | 47% | 50% |
| 21 | 0.069 | 49% | 49% |
| 22 | 0.067 | 49% | 49% |
| 23 | 0.065 | 49% | 49% |
| 24 | 0.064 | 49% | 49% |
| 25 | 0.063 | 48% | 48% |
| 26 | 0.062 | 49% | 47% |
| 27 | 0.060 | 49% | 48% |
| 28 | 0.059 | 49% | 48% |
| 29 | 0.058 | 48% | 49% |
| 30 | 0.057 | 50% | 47% |

In these simulations (the 0.30–0.88 band) a newcomer kept at least 46.8% of the window (automatic joins, N = 30;
47.2% with random picks, N = 20); on the old band it was 51.8%. The nominal area overstates the window: cells are
densest in the dark, low-chroma corner, where one zone covers up to 43.5% of the window at N = 2 (25% nominal) and
10.5% at N = 10 (5.0% nominal). In exchange the zones are larger: they never go below ΔE 0.057 (about three
just-noticeable steps) up to 30 players, against 0.037 before. A reviewer's greedy adversary (each pick allowed when
made, chosen to cover the most window) left about 45% at N = 30 on the old band; on the new band a round-4
reviewer's left 40.5% at N = 30 (42.3% at N = 10, 45.8% at N = 5).

**Cost.** The rule's loops run over packed arrays with squared distances: about 8× faster than the first version at
100 other PCs and about 48× at 500 (reviewer measurements). The write budget bounds picks and recolours. A new
token for a player's first character still runs the rule once per creation (about 3 ms at 100 PCs, 12 ms at 500,
reviewer measurement), and such a message also broadcasts; a per-player character cap would bound that (a judgement
call below). The darker band has 18,000 cells instead of 10,800, so each figure is about 1.7× larger: about 5 ms per
snap, automatic colour or recolour at 100 other PCs and 21 ms at 500 (a local bench and a reviewer's full-path
times). Since round 4 one colour blocks once, so one player's flood of identical characters costs one blocker; the
server builds the window's cells at start (about 100 ms) instead of on the first token after boot.

**Bundle.** The picker is a lazy chunk: `ColorPicker-*.js` was 4.75 KB gzip after round 1's fixes and 5.14 KB gzip
plus 0.81 KB CSS on `29d09a99` (reviewer measurements on the e2e harness's build). The entry bundle was 166.71 KB of
the 175 KB budget after the lazy split (`d60d25d3`; it was 170.37 KB with the picker eager) and 166.84 KB on
`b98e4645`, both from the production `pnpm build`; the figures on the final tree (round 4) are in the gates section.

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
was not repeated for every later fix; the e2e specs cover the wire colour reaching the other client (and its taken
mark in their picker), the spot tap, the sender-only notice, and the phone's reach, fit (both sides and the sheet's
foot) and touch actions; the rest is unit and contract tests. After round 2 (`326e27de`), a desktop live check: a
real click in the window focused the handle, and three real ArrowRight presses sent one `set-token-color` and no
`step-object`. After round 3 (`fea03f5d`), desktop only (`live-single`, Player 20 with 16 other players' zones):
a real click inside Player 18's zone showed `Player 18's colour` in the live region, kept the colour, sent nothing and
left focus on the handle; after the 3 s label, hovering Player 19's zone showed `Player 19's colour` unannounced;
three real ArrowRight presses sent one `set-token-color` (`#ffc3ce`), which the server stored; a real drag from the
handle into Player 19's zone (`#00a7da`) stopped at its edge with `Too close to Player 19` and sent one message
(`#00a4f9`), stored as sent. The click-in-a-zone part is superseded by `7cc07377` (a tap in a zone now picks its
nearest edge): that has not been driven live, only unit-tested. The phone was not driven live after round 3; a
round-4 reviewer checked in real Chromium and WebKit that a touch tap, a mouse click on the canvas, a spot or the
handle all leave focus on the handle. After round 4, desktop: the canvas measures 235 × 90.4 px, exactly 2.6:1 (it
was 1.8:1 in Chromium before `min-height: 0`), and the loaded picker is 212 px tall.

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
fixes). The union was fixed in `53e7ed4c`, `326e27de` and `29d09a99` (`79cd57ac`, between the rounds, fixed the e2e
race the ladder found after round 1):

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
  every file load; see "Judgement calls".

Round 3 (the cap): four fresh reviewers. **Server: PASS** (3 minors). **Privacy and tests: FAIL** (1 critical, 1
major, 5 minors). **Docs: FAIL** (3 majors, 15 minors). **Client: FAIL** (3 majors, 10 minors). Two findings were
reported twice, so about 39 distinct, against about 54 in round 1 and 53 in round 2. The union was fixed in
`d8c7ae37`, `54a3df1b`, `38af0710` and the docs commit after them, each code fix sabotaged red; **none of it has been
reviewed**:

- **Critical:** an over-budget colour write was answered with the colour of whatever token id it named, before any
  ownership check, and an empty colour for an id that no longer existed. A player holding an old token id could tell
  whether a hidden or fogged token was still on the map, and its colour. Only a token the sender may colour is
  answered now; every other id gets silence. Introduced by round 2's throttle notice; local only, never pushed.
- **Major:** the server's answer to an earlier pick pulled the handle back from keys or a drag still choosing (every
  other key press was lost with a real round trip); hover labels never came back after the first pick; the help said
  a tap shows whose a zone is, but the tap recoloured you to the zone's edge (round 3 made a tap there name it and pick
  nothing; the owner then chose pick-and-name, below); the zone-shrink test passed with a frozen radius; the record lacked the final gates and had a stale chunk
  size.
- **Minor, fixed:** a PC's colour followed the token's owner instead of its player (the DM's recolour of a PC token it
  held ignored zones); `#rrggbbaa` and `#rgba` were unreadable; the nearest snap, a hidden own PC's name and the
  throttled toast were unpinned; keys were dropped by a tap on the handle or a cancelled press on it (a cancelled
  press elsewhere still dropped them until round 4); a tap on the handle threw back an
  in-flight pick; a jittery tap committed where the finger lifted; going back to the old colour mid-flight was not
  sent; a touch tap or a spot click moved focus off the handle; the live region only became live with its text; the
  phone spec never checked the sheet's foot; doc and comment wording.
- **Not fixed:** a scroll that starts on a free colour flashes the handle and preview before the browser cancels it;
  a drag that starts on a dashed ring does nothing; the loading placeholder is about 30 px shorter than the picker;
  no e2e drives a touch drag (live checks only). `rgb()` and the DM's silent unreadable colour were left as judgement
  calls (below).

## After the review: darker colours (owner, 2026-10-09)

Looking at the picker, the owner saw no dark shades ("I am a big fan of darker colors"). Asked whether frames should
carry the contrast, the owner pointed out frames are any material and palette, so a fixed bright rim is no answer.
Changed, and **not reviewed**:

- `colorWindow.ts`: lightness band 0.64–0.88 → **0.30–0.88**, raster rows 60 → 100.
- `colorRule.ts`: the zone cap 0.15 → **0.25**, so zones still shrink from the second player on (r(2), r(3) and
  r(4) all sat at the 0.15 cap on the bigger window; the shared test caught it).
- `drawColorWindow.ts`: zones drawn as stripes instead of darkened (darkening fell to 1.35:1 in the dark half);
  a new test paints the whole window as one zone into a fake context and checks every row at every 9th column,
  taking the best of the next six cells, for at least 3.5:1 (sabotaged red with the old darkening).
- `colorPicker.css`: your other characters' dots get a white dashed ring and a navy edge (round 4 made them small
  squares); the suggested spots a navy edge.
- Tests pinned to the old band now read `COLOR_WINDOW`; the "older colour's real lightness" test uses a colour
  darker than the new band (`#0b0b41`, L 0.20).
- Help and guide: "darkened patches" → "striped patches".
- Planning (untracked): the arc plan's band rule, C3's prerequisite (the text lift is what makes dark names readable;
  C1 and C3 go to main together), and a C5a acceptance check (the darkest colours as `plain.ring` and dark presets
  must show lit facets on the dark map and in fog, measured).

Seen live on desktop after the change: the window runs from pastels to deep violets, navies and crimsons; zones show
as striped patches in both halves; the spots' dashed rings show on the dark half.

## Round 4 (the owner's last round)

Four fresh reviewers on the same model, over `29d09a99..HEAD`. **Server: PASS** (8 minors). **Client: PASS** (6
minors). **Privacy and tests: FAIL** (1 major, 4 minors). **Docs: FAIL** (3 majors, 14 minors). Four findings were
reported twice, so about 36 distinct (54, 53, 39, 36 across the four rounds). No privacy leak was found for a sender
who does not own the token. The union was fixed in `f0448ce1`, `a1efc685`, `254b47e0` and the docs commit after them, each code
fix sabotaged red; **none of it has been reviewed**:

- **Major:** no test could fail if a drag committed where it was pressed instead of released (now pinned twice); the
  record claimed final-tree gates that did not exist, said "at least 47%" where it is 46.8%, and described keys and
  taps as before `7cc07377`.
- **Minor, fixed:** the throttled reply told an owner who can no longer see their token its colour (the reply now
  carries none); NPC and DM-recolour colours from the whole window (44% under 3:1 on a dark map floor; now drawn from
  the readable part); every identical PC was a separate blocker (one colour now blocks once); the first token after
  boot paid the 100 ms window build; `colorOwner`'s docstring premise; the DM's throttle reply and the chosen colour's
  owner were unpinned; the nearest-snap bound was weak (now equal to `nearestAllowedColor`); Chromium drew the window
  at 1.8:1 instead of 2.6:1 (`min-height: 0`; both colour e2e specs check it); a refused pick could stay on screen for
  good; 13 dark cells trapped single arrow steps; your other characters' dots looked like suggested spots; keys were
  lost when a press off the handle was cancelled; hover labels were off for 3 s after every pick; a key step's bump
  notice never cleared; the picker was offered for a token someone else owns; the loading placeholder was 170 px
  against a 212 px picker; picker mutants that survived (handle tap in flight, a second press on the same pick, keys
  superseded only by a press, a hover replacing a tap's notice); doc and comment wording.
- **Not fixed:** a request exactly at another player's colour snaps to an arbitrary edge of its zone (every edge cell
  is equally near), which can be a different hue; a vertical swipe while a pick is in flight shows the old colour
  until the answer arrives; a second tap in the same zone is not re-announced to a screen reader; the window's first
  build costs a few hundred ms on a phone; spots on the top row sit half outside the window (before C1); round 3's
  scroll flash and drag-from-a-spot.

## Gates

Full ladder on `d60d25d3` (before the review): **GATES: PASS** — shared 511, server 2918, client 8216 (4 skipped)
tests; e2e 373 passed, 3 skipped (the three baseline skips); dev boot clean. An earlier run on `2e956229` had one e2e
failure (`live-map-toolbar.smoke.spec.ts:125`, `ERR_CONNECTION_FAILED` to the e2e client rail) that passed alone and
in the next full run.

Full ladder on `b98e4645` (after round 1): every gate passed except one e2e test, the new
`personal-colour.spec.ts` snap test, which raced the broadcast (it read Bob's colour before the change arrived);
fixed in `79cd57ac` and 10/10 on `--repeat-each=5`.

Full ladder on `29d09a99` (after round 2): **GATES: PASS** — shared 518, server 2937, client 8235 (4 skipped); e2e
373 passed, 3 skipped; dev boot clean. Entry bundle 167.02 KB gzip of 175 KB and `ColorPicker-*.js` 5.14 KB gzip plus
0.81 KB CSS, measured on the e2e harness's `vite build --mode development` build, not the production `pnpm build`
that gave 166.71 and 166.84 above.

Full ladder on `38af0710` (after round 3): every gate passed except lint and format:check, both on one line of
`TokenDispatcher.ts` that prettier wraps; fixed in `fea03f5d` (formatting only), after which `pnpm lint` and
`pnpm format:check` pass. Shared 519, server 2940, client 8247 (4 skipped); e2e 373 passed, 3 skipped (the three
baseline skips), 0 flaky; dev boot clean. Entry bundle 166.98 KB gzip of 175 KB on the production
`pnpm build:check` of `fea03f5d` (167.06 KB on the e2e harness's development-mode build); `ColorPicker-*.js` 5.26 KB
gzip plus 0.81 KB CSS.

Full ladder on `c324c29e` (after the darker band): **GATES: PASS** — shared 519, server 2940, client 8249 (4 skipped);
e2e 373 passed, 3 skipped (the three baseline skips), 0 flaky; dev boot clean. Entry bundle 166.98 KB gzip of 175 KB
on the production `pnpm build:check`; `ColorPicker-*.js` 5.31 KB gzip plus 0.81 KB CSS.

`7cc07377` and `8cbbff52` (the tap decision and the record) had no full ladder of their own: format, lint, the client
typecheck and the three colour e2e specs passed on them; the round-4 ladder below covers them.

Full ladder on `a1efc685` (after round 4): **GATES: PASS** — shared 522, server 2943, client 8261 (4 skipped); e2e
373 passed, 3 skipped (the three baseline skips), 0 flaky; dev boot clean. The production `pnpm build:check` then
showed the entry at 168.28 KB gzip: the new `colorReadable.ts` parsed a colour at module load, which no bundler can
tree-shake, so the colour window's code rode in the entry. Parsing it lazily (`254b47e0`) brought the entry back to **167.00 KB of 175**, with `ColorPicker-*.js` 5.39 KB gzip plus 0.83 KB CSS; on
that commit shared 522 and the server colour suites passed, and lint, format, the structure guard, both typechecks
and a dev boot were clean.

Merge `cb7539c2` (origin/dev's phone double-tap recolour and auth test hardening, one help-text conflict): lint,
format, the structure guard, both typechecks, client 806 and server 60 tests in the touched areas, and e2e for both
colour specs, the phone colour spec and the new double-tap spec (4 passed). The full ladder on the merged tree is
CI's run on the push.

## Found on the way

- **Fixed:** condition medallions stroked `var(--jrpg-border-gold)`, which a canvas silently ignores (checked in the
  browser), so the rings were never gold — `2e956229`.
- **Changed, not a bug:** recolour now returns `save: true`. Plan §5's `save: false` lost nothing: the broadcast
  already saves the room (`room/service.ts` ~240). The same change to `delete-token` (`72be1566`) was reverted in
  `f2e6ddba` for that reason.
- **Not fixed, reported:** `.player-portrait` (with the shimmer that ignores `data-motion`) is dead CSS — no
  component uses the class (`theme/herobyte.css` ~644-723). `TokenModel.randomColor` (`packages/shared/src/models.ts`)
  still makes hsl colours and has no callers outside its own test.
- **Landed elsewhere:** a double-tap recolour on phones (`9da4011b`, another session), merged in `cb7539c2` before
  the push; its help line is folded into `RECOLOR_ENTRY`.
- **Not touched:** `add-player-character` has no per-player cap (characters are capped only on session load, at 500).

## Corrections to commit messages (unpushed; not rewritten)

- `4e012cad`: ">= 53%" holds only when every earlier pick is checked at the newcomer's radius; checked at the radius
  in force when each picked, the worst was 51% (at that commit's 0.10 cap; 51.8% at the 0.15 cap, table above). "So names stay readable" is false on the desktop party card (3.00:1).
- `a436bb73`: "a recolour was lost if the server died" is false (every broadcast saves); an unreadable colour's
  replacement is the most open allowed colour, not "the nearest"; "existing colours are kept until changed" was false
  at that commit (the rule re-ran on an unchanged colour, fixed in `51dbd41f`).
- `72be1566` (reverted by `f2e6ddba`): its premise, that a deleted token came back after a restart, was false.
- `51dbd41f`: "38% of 3-player tables" was measured with the 0.10 cap; with the 0.15 cap in force at that commit it
  is about 44% (77% for 5 players holds). Its "this bounds what a spamming client can spend" covers picks and
  recolours, not new tokens.
- `5b2cc0ad`: "the screen-reader lightness is the real OKLab lightness" was false for any colour outside the
  window's band (most older hsl colours, off-band file colours) until `326e27de`.
- `d60d25d3`: "the colour e2e specs pass against the production build" is false: they ran against the e2e harness's
  development-mode build (the seam the specs use is compiled out of production).
- `53e7ed4c`: "sabotaged and red: … the parser cap and separators": only the cap can turn that test red. With the
  64-character cap in place the old separators cost about 0.16 ms at that length, so the separator change is
  harmless but unpinned.
- `c324c29e`, `46f1a826`: "at least 47%" is 46.8% (automatic joins, N = 30). "At least 3.56:1 at every lightness"
  holds for the better of the two stripes (3.555 measured). "Checks every zone edge": the test checks every row at
  every 9th column, the best of the next six cells.
- `54a3df1b`: "keys not superseded by … cancelled presses" held only for presses on the handle (and, until
  `7cc07377`, in a zone); a cancelled press elsewhere dropped them until `a1efc685`.

## Decided after the review (owner, 2026-10-09)

- **Darker colours:** the window runs down to L 0.30 (above); C1 goes to main with C3.
- **A tap in another player's zone picks the nearest free colour and names whose zone it was** (`Too close to
  <name>`, held three seconds), like a drag into it. Round 3's "a tap names it and picks nothing" is reverted; keys
  still waiting are superseded by such a tap (one message, the tap's), and a tap still commits the colour its press
  showed. Hover still names a zone without picking.
- **One more review round (round 4), then push to `dev`.** Main is the owner's word, after C3.

## Judgement calls (made, not asked)

- **Colours off the window stay as they are.** A player's allowed colour darker than 0.30, grey or near-white (only
  a file or a crafted message can carry one) is kept: moving it would also move older colours on every file load,
  against decision 1's "a placed colour is never moved". C3's text lift has to handle any colour anyway.
- **`rgb()` and named colours stay unreadable.** HeroByte never writes them; only a hand-edited file carries one. A
  player's gets a free colour with a toast; a DM's is ignored (the token keeps its colour) without a word, which is
  rare enough to leave.
- **No per-player character cap now.** Colour writes are budgeted, a new token's rule costs about 5 ms at 100 other
  PCs, and a session load caps characters at 500. A cap is a table rule; it can wait for a table that needs one.
- **Colours nobody picked read on a dark map** (round 4): an NPC's automatic colour and the DM's double-click recolour
  of their own token come from the window's cells at least 3:1 on the map floor. Players still pick any colour. On
  parchment those are the weaker end, as before the darker band.
- **A colour request exactly at another player's colour** (a file, a crafted message) snaps to an arbitrary edge of
  that zone, possibly a different hue: every edge cell is equally near. Left as it is.
- **Light maps and automatic colours on legacy tables** need nothing in C1: the dark half reads on parchment, C3's
  text lift and keyline handle the rest, and on the local test table (mid-tone legacy colours) newcomers now get
  deep shades automatically, which anyone can change.

## Left for the owner

- The **player guide** and the **character-card lesson script** (`docs/user-guide/player-guide.md`,
  `docs/website/video-scripts.md` Player path 3, chapters 5 and 7) are edited but **left uncommitted**: your own
  uncommitted edits sit in the same hunks. `docs/website/narration-wren.md` (also yours, uncommitted) still narrates
  "a new random colour" in chapter 5, lacks the script's picker lines there (the script films the picker), and lacks
  "your colour" in chapter 7; it was not touched.

## Commits (on `91c69b63`)

`4e012cad` shared colour module · `a436bb73` server rule, notice, wire colour · `72be1566` delete-token save
(reverted) · `5e6416f6` MobileRowHeader split · `6102d674` the picker · `6cffa30b` live-pass fixes · `2378e7c8` in-app
help · `2e956229` medallion rings · `ec31b4f3` e2e specs · `d60d25d3` lazy picker · `f2e6ddba` revert of `72be1566` ·
`3f65acd8` rule: cost, stored-hex judging, allowed draws, r cap 0.15 · `51dbd41f` server: unchanged colours, NPCs,
inheritance, write budget, holders · `5b2cc0ad` picker: keys, taps, batching, notices, a11y · `b98e4645` record, help,
schema · `79cd57ac` snap spec race · `53e7ed4c` parser bound, non-strings, DM recolour, hidden names, budget · `326e27de`
picker: phone swipe, focus, timeouts, labels, memo · `29d09a99` round-2 docs · `d8c7ae37` throttle privacy, colour
owner, alpha hex · `54a3df1b` picker: a tap names a zone, answers, labels, keys · `38af0710` phone sheet foot · `fea03f5d`
prettier wrap · `75d217e1` round-3 docs · `c324c29e` darker window, striped zones · `46f1a826` darker-window record ·
`7cc07377` a tap in a zone picks and names · `8cbbff52` owner decisions, judgement calls · `f0448ce1` round 4: throttle
without colour, readable drawn colours, one colour blocks once · `a1efc685` round 4: picker shape, refused picks,
interrupted keys · `254b47e0` lazy floor parse (entry bundle) · `3b3e0402` round-4 docs · `cb7539c2` merge of
origin/dev · then this status note.
