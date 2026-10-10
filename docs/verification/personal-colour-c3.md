# Personal colour, slice C3 — your colour everywhere

**Status: on local `dev`, not pushed (2026-10-09, overnight).** Built from
[`PROMPT-colour-everywhere-c3.md`](../planning/PROMPT-colour-everywhere-c3.md) (untracked: the link works on this
machine only) on top of C1 (`origin/dev` `f43368ab`). C1 goes to main only together with C3 (the owner's decision:
C1's darkest colours are unreadable as text until C3's lift). Pushing and merging are the owner's word.

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
  records. Then the token, then (one unlinked PC) the player's one loose token (`looseOwnToken`). The DM's colour is
  the DM's own PC's, never an NPC token. No PC with a colour: null, and every place keeps today's colour.
- **Found and fixed on the way (its own commit, `8ed08dff`):** the desktop roster ring and the card's colour read the
  token, so a party member who walked out of sight dropped to the default green ring and lost the card colour. Both
  read the record's colour first now.
- **Selection in your colour** (`features/map/selectionPalette.ts`, `components/SelectionRing.tsx`): tokens, props,
  drawings, templates, the transform handles and the count badge. MapBoard supplies the palette through React context
  (the stage bridges context; a thin wrapper does it, so MapBoard's own body is unchanged). No colour: `#447DF7`,
  exactly as before.
- **Pings** in their player's colour, so the DM pings in the DM's own PC's colour; the name label is drawn in the
  ping's colour outlined in its keyline (it was fixed dark text, unreadable on dark maps).
- **Chat and roll log names** in each author's colour, lifted for text; your own lines also carry a `▶` mark.
- **Voice glow** in the card's colour. The phone shows no speaking glow today (Party lists who is in the call), so
  there is nothing to recolour there.
- **The picker's preview** shows the name as names are drawn now (lifted).

## Chosen and stated

- **The fog-proof source:** `SnapshotCharacter.color`, C1's wire colour, derived at send time from each PC's token and
  carried on the party record, which the recipient filter never drops. A resolver that read `snapshot.tokens` would
  lose every party member out of the viewer's sight.
- **The keyline:** a selected token's own stroke becomes the keyline, dark `#0b0b16` or light `#f4f1e8`, whichever
  contrasts more with the colour, at twice the ring's width; a ring in the colour is drawn over it (it follows the
  token through drags, glides and the transform handles by listening to its attribute changes). The colour band has a
  contrasting edge on both sides. Measured over every window colour: the colour against its keyline (which is also
  what separates it from your own picture-less token, filled with your colour) is at least **4.16:1**; against the
  background, the ring's better edge is at least **3.19:1** on the dark map floor `#2a2622`, **4.16:1** in fog
  `#0b0b16`, **3.45:1** on parchment `#e8dcc0` and **4.70:1** on white. Props, drawings and templates get the colour
  with a thin keyline halo (a shadow); the count badge's number is the keyline colour on the colour.
- **The text-lift rule** (`readableOn`, shared `colorText.ts`): when a colour falls short of 4.5:1 on the panel, its
  OKLCH lightness moves (up on a dark panel, down on a light one) just far enough, hue kept, chroma cut to what sRGB
  shows there, judged on the stored `#rrggbb`. The panel is the theme's navy `#0f0e1e` (roll entries and the chat list,
  desktop and phone; see the live check). Every window colour reaches at least **4.50:1**. Worst cases: C1's darkest
  `#390076` (1.30:1) becomes `#8867d7` (4.51:1); the worst legacy colour `#2626d9` (2.14:1) becomes `#4d6eff`
  (4.53:1); `#0b0b41` (1.03:1) becomes `#6978b6` (4.50:1).
- **Your own chat lines:** your colour plus a `▶` cursor mark before your name (aria-hidden), a cue that does not rely
  on colour.

## Evaluation (evaluate-live)

**Mode achieved: `live-two-client`** on the local dev server, plus the phone layout for the player (375 × 812 with
touch). Player 20 (`localhost`) and Player 21 (`127.0.0.1`, a separate origin so a separate session; elevated to DM
with the dev DM password). C1's automatic colour gave the newcomer `#393600`, a deep olive from the darker window:
a good dark test colour. Canvas colours were read from the Konva nodes (`window.Konva` in dev); selection was made with
real clicks and taps; fog, vision and the DM token's move were set up through the dev seam (setup only).

- **Selection, per viewer.** Player 20 clicked their own token (`#00a4f9` then): the token's stroke became the dark
  keyline `#0b0b16` (width 6) with a ring in `#00a4f9` (width 3) over it, aligned. The DM selected their own token
  (filled `#393600`): light keyline `#f4f1e8` and an olive ring, so the ring stays apart from the same-coloured fill.
  The DM then selected Player 20's (now pink) token: light keyline and the DM's olive ring on the DM's screen, while
  Player 20's own screen showed it in pink with a dark keyline.
- **The DM's ping** reached Player 20 in `#393600` (the DM's PC), never an NPC's colour; its label "Player 21" in the
  olive, outlined in the light keyline.
- **Fog (the fog-proof source).** With fog on, a 30 ft default vision radius and the DM's token moved away, the DM's
  token left Player 20's payload while the DM's PC record kept `#393600`. On Player 20's screen: the roster ring and
  initial stayed olive (before the fix they fell back to the default green), the DM's ping was olive, and the DM's chat
  and roll log names were the olive lifted to `rgb(128, 126, 76)`.
- **Names.** The chat list and the roll entries both sit on `rgb(15, 14, 30)` (`#0f0e1e`), measured on desktop and
  phone, the background the text lift assumes. Player 20's own line read `▶ Player 20: …` in their colour.
- **Recolour, live.** Player 20 recoloured: their selection ring changed to the new `#ffc6c3` at once, and on the DM's
  screen their chat name and roster ring changed too, without a reload.
- **Phone.** Chat and roll log names matched the desktop's; the chat tabs are 44 px; a tap with the Select tool showed
  the dark keyline and the pink ring, with the movement pad below.
- **Found and fixed (`2fd0cfeb`):** a deep colour's selection glow and ping dot all but vanished on the dark map floor;
  the glow is now lifted to 3:1 there and the dot edged in its keyline.
- **Not driven live:** the speaking glow (no microphone in the pane; unit-tested); a ping on the phone; a light map.

| Criterion | Weight | Score | Why |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8 | Every listed place shows the colour; fallbacks hold; the DM ping quirk and the out-of-sight roster bug are gone |
| Multiplayer integrity | 0.30 | 8 | Selection per viewer; fog driven live with the colours intact on the other screen; recolour live on both |
| Craft | 0.20 | 7 | Two dark-colour visibility gaps found and fixed; a dark roster ring is still low contrast on the panel (C6) |
| Reach | 0.15 | 8 | Phone selection, chat and roll names live; ping on the phone not driven |

Weighted: **7.8** (given before the review; round 1 decides how far it holds).

## Gates

Full ladder on `05e6a3a8` (before the bundle fix and the live-pass fixes): **GATES: PASS** — shared 529, server 2943,
client 8297 (4 skipped); e2e 374 passed, 3 skipped (the three baseline skips), 0 flaky; dev boot clean.

Bundle: the production `pnpm build:check` showed the entry at **169.85 KB** gzip (167.00 on C1): `readableOn` imported
colorWindow's `maxChroma`, and Rollup keeps a module whole, so the picker's whole colour window moved into the entry.
`d595cbde` gave colorText its own gamut search: **169.30 KB of 175** (5.70 KB left); `ColorPicker-*.js` 4.31 KB gzip.
The remaining +2.3 KB is colour code the first screen now needs (colour space, text lift, resolver, the wiring).

## Commits (on `f43368ab`)

`66061c32` resolver and text/keyline helpers · `8ed08dff` roster and card colour out of sight (found bug) ·
`9b118ca0` selection in your colour · `986f2ccd` pings, chat and roll names, voice glow, preview · `7529659b` glow test
typing · `05e6a3a8` in-app help · `d595cbde` colour window out of the entry bundle · `2fd0cfeb` live-pass fixes (deep
glow and ping dot) · then this record.
