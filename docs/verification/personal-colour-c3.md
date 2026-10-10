# Personal colour, slice C3 — your colour everywhere

**Status: on local `dev`, not pushed (2026-10-09, overnight).** Built from
[`PROMPT-colour-everywhere-c3.md`](../planning/PROMPT-colour-everywhere-c3.md) (untracked: the link works on this
machine only) on top of C1 (`origin/dev` `f43368ab`). C1 goes to main only together with C3 (the owner's decision:
C1's darkest colours are unreadable as text until C3's lift). Pushing and merging are the owner's word.

The player guide's colour lines (`docs/user-guide/player-guide.md`: the Colour and Recolor bullets, the voice line) are
**uncommitted**: that file also holds the owner's own unfinished edits, so committing it would sweep theirs in. They
go in with the owner's next commit of that file.

## The owner's decisions it builds

1. The places: selection outline and glow, pings (and the DM ping quirk), roster, chat names, the voice glow, plus roll
   log names (2026-10-09).
2. Selection takes the viewer's colour (2026-10-09): everything you select shows in your colour on your screen; the
   DM's selections in the DM's colour.
3. Not in this slice (2026-10-09): the phone's party rows, other players' measure lines, map nameplates.
4. Frames are any material (2026-10-09): readability never comes from a fixed bright rim.

## What it does

- **One colour resolver, fog-proof** (`features/players/playerColors.ts`). A player's colour is their first PC's (a
  later PC only while the earlier ones have none), read from the character record first: C1 puts each PC's token
  colour on its record (`SnapshotCharacter.color`), and fog drops other players' tokens from a payload but never party
  records. Then the token. A PC that predates linking, when it is its player's only PC, takes the colour of the one
  token that player owns that no character claims: the server puts it on the record (`loosePcColours`, review round
  1), and the client's `looseOwnToken` reads the same token. The DM's colour is the DM's own PC's, never an NPC
  token. No PC with a colour: null, and every place keeps today's colour.
- **Found and fixed on the way (its own commit, `8ed08dff`):** the desktop roster ring and the card's colour read the
  token, so a party member who walked out of sight dropped to the default green ring and lost the card colour. Both
  read the record's colour first now.
- **Selection in your colour** (`features/map/selectionPalette.ts`, `components/SelectionRing.tsx`,
  `components/SelectionOutline.tsx`): tokens, props, drawings, templates, the transform handles and the count badge.
  MapBoard supplies the palette through React context (the stage bridges context): a thin wrapper does it, and the
  body, now `MapBoardScene`, gained only the pings' `characters` prop. No colour: `#447DF7`, exactly as before.
- **Pings** in their player's colour, so the DM pings in the DM's own PC's colour. The name label is drawn in the
  ping's colour, lifted to 4.5:1 against its own keyline outline (it was fixed dark text, unreadable on dark maps).
- **Names in each author's colour, lifted for text:** chat and roll log names, and the card's name. Your own chat lines
  also carry a `▶` mark. A whisper dims only its text, never its name.
- **Voice glow** in the card's colour (on a PC). The phone shows no speaking glow today (Party lists who is in the
  call), so there is nothing to recolour there.
- **The picker's preview** shows the name as names are drawn now (lifted).
- **Older bug, fixed regardless (review round 1):** the desktop Party row's initial letter was white on its ring,
  1.3:1 on the default green; it is now the ring's keyline.

## Chosen and stated

- **The fog-proof source:** `SnapshotCharacter.color`, C1's wire colour, derived at send time from each PC's token and
  carried on the party record, which the recipient filter never drops. A resolver that read `snapshot.tokens` would
  lose every party member out of the viewer's sight.
- **The keyline:** dark `#0b0b16` or light `#f4f1e8`, whichever contrasts more with the colour. A selected token's
  own stroke turns transparent (same width, so the hit area is unchanged), and `SelectionRing` draws a keyline band
  (5/3 of the ring's width) with the colour ring over it, so the colour has a keyline edge on both sides; it follows
  the token's node through drags, glides and the transform handles by listening to its attribute changes, and
  re-subscribes when the node is swapped (a picture loading after selection). Props use the same ring. Drawings and
  templates draw a solid keyline copy of their outline under the dashed colour line. The transform handles' anchors
  are the colour edged in the keyline; the centre move handle is a keyline edge with the colour inside and the cross
  in the keyline; the gizmo's dashed border is off for a coloured viewer, since every selected piece carries its own
  edged outline. Measured over every window colour: the colour against its keyline (which is also what separates it
  from your own picture-less token, filled with your colour) is at least **4.16:1**; against the background, the
  ring's better edge is at least **3.19:1** on the dark map floor `#2a2622`, **4.16:1** in fog `#0b0b16`, **3.45:1** on
  parchment `#e8dcc0` and **4.70:1** on white. The count badge's number is the keyline colour on the colour.
- **The selection glow and the ping dot** (`2fd0cfeb`): the glow is lifted to 3:1 on `#2a2622`, the picker preview's
  stand-in for a dark map floor. Nothing lifts it on a light map, where a pale colour's glow is near 1:1 (for example
  `#68f7a4` on parchment); the keyline ring is what reads there. The ping dot has a 2 px keyline edge; the aim preview
  and the expanding ring are drawn over a keyline circle (review round 1). The dot and the label draw directly, never
  through Konva's stage-sized buffer canvas (`perfectDrawEnabled={false}`), the crash trap `AtlasLinksLayer.tsx`
  records.
- **The text-lift rule** (`readableOn`, shared `colorText.ts`): when a colour falls short of 4.5:1 on its background,
  its OKLCH lightness moves (up on a dark background, down on a light one) just far enough, hue kept, chroma cut to
  what sRGB shows there, judged on the stored `#rrggbb`. Chat and roll names sit on the theme's navy `#0f0e1e` (roll
  entries and the chat list, desktop and phone; see the live check); the card's name on the card's lightest stop
  `#3a3860`; a ping label on its own keyline. Every window colour reaches at least **4.50:1** on the navy, and each
  lifted one stops under 4.6:1. Worst cases on the navy: C1's darkest `#390076` (1.30:1) becomes `#8867d7` (4.51:1);
  the worst legacy colour `#2626d9` (2.14:1) becomes `#4d6eff` (4.53:1); a near-black outside the window (a file's or
  the DM's colour), `#0b0b41` (1.03:1), becomes `#6978b6` (4.50:1). On the card, `#390076` becomes `#b295ff` (4.51:1).
- **The speaking glow** (review round 1): a box-shadow at 35% around the portrait, on the card's `#2a2845`. Today's
  green is 10.98:1 there, so a colour is lifted to 10:1 on `#2a2845`, hue kept; the green comes back unchanged
  (`rgba(90, 255, 173, 0.35)`), a pastel brightens a little (`#ffc2d3` to `#ffccda`) and a deep colour much more
  (`#390076` to `#ddd4ff`). The turn's gold glow still wins.
- **Your own chat lines:** your colour plus a `▶` cursor mark before your name (aria-hidden), a cue that does not rely
  on colour.

## Evaluation (evaluate-live)

**Mode achieved: `live-two-client`** on the local dev server, plus the phone layout for the player (375 × 812 with
touch), before review round 1. Player 20 (`localhost`) and Player 21 (`127.0.0.1`, a separate origin so a separate
session; elevated to DM with the dev DM password). C1's automatic colour gave the newcomer `#393600`, a deep olive from
the darker window: a good dark test colour. Canvas colours were read from the Konva nodes (`window.Konva` in dev);
selection was made with real clicks and taps; fog, vision and the DM token's move were set up through the dev seam
(setup only).

- **Selection, per viewer.** Player 20 clicked their own token (`#00a4f9` then): a dark keyline `#0b0b16` with a ring
  in `#00a4f9` over it, aligned. The DM selected their own token (filled `#393600`): light keyline `#f4f1e8` and an
  olive ring, so the ring stays apart from the same-coloured fill. The DM then selected Player 20's (now pink) token:
  light keyline and the DM's olive ring on the DM's screen, while Player 20's own screen showed it in pink with a dark
  keyline. (Seen with the first keyline build; round 1 changed how the band is drawn, see the re-check below.)
- **The DM's ping** reached Player 20 in `#393600` (the DM's PC's colour). No NPC token was on the table during this
  check; an NPC placed before the DM's PC is unit-tested.
- **Fog (the fog-proof source).** With fog on, a 30 ft default vision radius and the DM's token moved away, the DM's
  token left Player 20's payload while the DM's PC record kept `#393600`. On Player 20's screen: the roster ring and
  initial stayed olive, the DM's ping was olive, and the DM's chat and roll log names were the olive lifted to
  `rgb(128, 126, 76)`. (That the ring used to fall back to green is read from the code `8ed08dff` replaced, not seen
  live.)
- **Names.** The chat list and the roll entries both sit on `rgb(15, 14, 30)` (`#0f0e1e`), measured on desktop and
  phone, the background the text lift assumes. Player 20's own line read `▶ Player 20: …` in their colour.
- **Recolour, live.** Player 20 recoloured: their selection ring changed to the new `#ffc6c3` at once, and on the DM's
  screen their chat name and roster ring changed too, without a reload.
- **Phone.** Chat and roll log names matched the desktop's; the chat tabs are 44 px; a tap with the Select tool showed
  the dark keyline and the pink ring, with the movement pad below.
- **Found and fixed (`2fd0cfeb`):** a deep colour's selection glow and ping dot all but vanished on the dark map floor;
  the glow is now lifted to 3:1 there and the dot edged in its keyline.
- **Seen live:** tokens, pings, the roster ring, chat and roll names, the picker preview. **Unit tests only:** props,
  drawings, templates, the transform handles, the count badge, the glow's motion gate, the no-colour fallback, the
  speaking glow (no microphone in the pane), a ping on the phone, a light map.

**Re-check after review round 1** (`live-two-client`, desktop only, on `47cdf285`; the same two players, Player 21
re-entered DM mode after the restart). Everything below was read off the live Konva nodes or computed styles, with
real clicks:

- **Party row initials:** every letter in its ring's keyline: `rgb(11, 11, 22)` on the light rings,
  `rgb(244, 241, 232)` on the deep ones (Player 21's olive, `hsl(238…)`, `hsl(358…)`).
- **Card name:** Player 21's card name `rgb(170, 169, 117)` (`#393600` lifted, 4.51:1 on `#3a3860`); its empty
  portrait keeps the raw `rgb(57, 54, 0)`.
- **Whisper:** on Player 20's screen, Player 21's whisper line at opacity 1, the name `rgb(128, 126, 76)` (4.54:1 on
  the navy), only the whisper's text at 0.85. (The two chat lines were sent through the dev seam: setup only.)
- **Ping:** Player 21's ping label `#393600` outlined `#f4f1e8` (10.93:1), round joins, drawn directly
  (`perfectDrawEnabled` false); the expanding ring over a 7 px keyline; the dot edged in a 2 px keyline, drawn directly.
  Read in the pinging tab: a background tab pauses animation frames, so the other tab's ping was not readable.
- **A drawing selected by the DM** (Select tool, real click): a solid 4 px `#f4f1e8` keyline under the 2 px dashed
  olive line, neither listening.
- **The DM's own token in Transform:** the gizmo border off, anchors olive edged `#f4f1e8`, the ring a 5 px keyline
  under a 3 px olive band (both drawn directly), the token's own stroke transparent at width 3, the glow `#747240`
  (3.02:1 on `#2a2622`); the centre handle edged `#f4f1e8` (3 px) with the olive inside at 0.85 and the cross in
  `#f4f1e8`.
- **Not re-checked live:** the phone, a prop or template selection, a picture token (the node-swap follow is
  unit-tested with real Konva nodes), the speaking glow.

| Criterion | Weight | Score | Why |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8 | Tokens, pings, roster, chat and roll names show the colour live; the DM ping quirk and the out-of-sight roster bug are gone; the rest is unit-tested only |
| Multiplayer integrity | 0.30 | 8 | Selection per viewer; fog driven live with the colours intact on the other screen; recolour live on both |
| Craft | 0.20 | 7 | Two dark-colour visibility gaps found and fixed; review round 1 then found more (card name, whisper names, pings' keylines) |
| Reach | 0.15 | 8 | Phone selection, chat and roll names live; ping on the phone not driven |

Weighted: **7.8**, given before review round 1, which found real defects the live pass missed (above and below).

## Review

**Round 1** (4 reviewers, opus, read-only, on `7aa5616c`): all four **FAIL**, about 45 findings in all. Fixed:

- **Selection** (`a6f8d416`): the ring stopped following a token whose node was swapped (a picture loading after
  selection, or after a reload with it selected), and the glow animated the destroyed node; the ring and glow now
  follow the node itself. Props, drawings, templates, the centre handle and the gizmo border had no edge that read on
  every map; each now has a solid keyline (above). The palette is memoised on the viewer's colour.
- **Pings** (`b1a50719`): the new dot and label went through Konva's stage-sized buffer canvas; the aim preview and
  the expanding ring had no keyline; the label reached only 4.16:1 against its keyline and used mitre joins. MapBoard's
  `characters` line had no test (PointersLayer's prop is now required).
- **Names and glow** (`6d2d07f6`): the card's name was never lifted (about 1.0–1.4:1 for the deepest colours); a
  whisper's 0.85 opacity took its lifted name under 4.5:1; the speaking glow was lifted on the wrong background; the
  roster initial was white on its ring.
- **Fog** (`b8ddd050`): an unlinked sole PC's colour came from the client's fogged token list, so screens disagreed.
- **Tests** (`1d91f72e`, `747d832d`): exact lifted values, per-cell lift bounds, the resolver's NPC and two-PC cases,
  `usePlayerColors`, the phone and desktop colour chains, the fogged teammate's card, the template's no-colour outline,
  the drag shade, the gizmo handle, the glow's selection gate and recolour.
- **Docs** (`47cdf285`, this record, the guide): the card has no colour portrait ring (the ring is on the Party row);
  the guide's voice line said green; "everywhere" and "other players see it too" said more than the code does.

Every fix was sabotaged and its test went red: 14 on selection, 5 on pings, 9 on names, glow and the server rule, 8
on the resolver, hook and lift, 1 on the desktop chain.

Not fixed, stated: the selection glow on a light map (above); baseline files grew (`TokensLayer.tsx` 836 → 875,
`MapBoard.tsx` 1020 → 1041, `DrawingsLayer.tsx` 621 → 636; all exempt from the 350-line rule, none split); a picture
token's ring band sits half over its picture, and its outer edge is 1 px further out, closer to the HP bar; a token
that REMOVE hands to the DM can become the DM's one loose token (shared with every other `looseOwnToken` reading); an
unlinked PC still holds no zone in the picker (C1's rule, unchanged).

## Gates

Before review: full ladder on `05e6a3a8` (before the bundle fix and the live-pass fixes): **GATES: PASS** — shared
529, server 2943, client 8297 (4 skipped); e2e 374 passed, 3 skipped (the three baseline skips), 0 flaky; dev boot
clean. `d595cbde` and `2fd0cfeb` were covered only by their own touched-test runs (and, for `d595cbde`, the
production build).

Bundle: the production `pnpm build:check` showed the entry at **169.85 KB** gzip (167.00 on C1): `readableOn` imported
colorWindow's `maxChroma`, and Rollup keeps a module whole, so the picker's whole colour window moved into the entry.
`d595cbde` gave colorText its own gamut search: **169.30 KB of 175** (5.70 KB left); `ColorPicker-*.js` 4.31 KB gzip.
The remaining +2.3 KB is colour code the first screen now needs (colour space, text lift, resolver, the wiring).

After round 1: full ladder on `47cdf285`: **GATES: PASS** — shared 530, server 2947, client 8316; e2e 374 passed, 3
skipped (the baseline skips), 0 flaky; dev boot clean. Production entry **169.39 KB of 175** (5.61 KB left, +0.09 KB
for round 1's fixes); `ColorPicker-*.js` 4.41 KB gzip.

## Commit-message corrections

- `05e6a3a8` ("card name and portrait ring") and `8ed08dff` ("the card's colour (name, portrait ring)"): the card has
  no colour portrait ring. The card's colour is its name, its empty portrait's fill and its speaking glow; the ring is
  on the desktop Party row.
- `9b118ca0` "TokensLayer.tsx 833 -> 870": it was 836 -> 870 (833 was the handoff's figure from before `cb7539c2`).
- `66061c32` describes the loose-token fallback without its condition: it applies only when that PC is its player's
  only PC.
- `2fd0cfeb` calls `#2a2622` "the map floor": it is the picker preview's stand-in for a dark map floor.

## Commits (on `f43368ab`)

`66061c32` resolver and text/keyline helpers · `8ed08dff` roster and card colour out of sight (found bug) ·
`9b118ca0` selection in your colour · `986f2ccd` pings, chat and roll names, voice glow, preview · `7529659b` glow test
typing · `05e6a3a8` in-app help · `d595cbde` colour window out of the entry bundle · `2fd0cfeb` live-pass fixes (deep
glow and ping dot) · `7aa5616c` this record · round 1: `a6f8d416` selection · `b1a50719` pings · `6d2d07f6` names and
glow · `b8ddd050` the unlinked PC's colour on the record · `1d91f72e` and `747d832d` tests · `47cdf285` help.
