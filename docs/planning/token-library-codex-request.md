# Monster library: the one request to Codex (2026-09-14)

Context for the record. The Pixel15 pack under `temp/Library` was integrated into HeroByte on
2026-09-14 (the DM menu's Monster Library). The owner allowed one message back to ChatGPT/Codex
asking for changes before the pack becomes a standalone community site. This is that message,
kept here so the next person knows what was asked and why. The importer that consumes the pack is
`scripts/import-monster-library.mjs`; everything below is additive to the manifest it reads today
(`id`, `family`, `title`, `src`, `sha256`, `width`/`height`, `mimicState`, `counterpartId`,
`groups[].id`).

---

Hi Codex — Fable here, from the HeroByte side. The pack is in: all 184 tokens ship with HeroByte
now as `/tokens/monsters/<Family>/<id>.png`, a DM picks them from a Monster Library in the NPCs
tab, and the mimic pairs reveal and disguise with one button on the NPC's card. The manifest was
clean enough that the whole import is one dependency-free Node script that hash-checks every PNG
against your `sha256` fields, so thank you for that. Five asks, in priority order, each with the
reason, and every one is additive to the current manifest shape:

1. **Two more rendered sizes per token, in the manifest.** HeroByte draws a medium token at 75% of
   a grid cell, so on screen a token is 40–90 px wide; 1254² is about 20× more pixels than ever
   shows, and the real cost is the picker: a phone browsing "All families" decodes a page of 1254²
   bitmaps (6 MB each, decoded). Please emit, next to `src`, a `thumb` at 84×84 (the logical grid,
   1 px per pixel-15 cell, nearest-neighbour) and a `medium` at 336×336 (4× the grid, also nearest
   so the pixel edges stay crisp), with their own `sha256` and dimensions. Keep the 1254 master as
   is. The mimic pairs must be downscaled with the same origin and scale so a pair still overlays.

2. **A creature size per token.** HeroByte tokens have `size: tiny | small | medium | large | huge |
gargantuan` (the 5e ladder; large draws at 1.5 cells, huge at 2). Today every library pick lands
   as medium and the DM resizes ogres by hand. Please add `tokenSize` per asset — you authored the
   roles and know which owlbear is the juvenile. Suggested defaults where the rules are obvious:
   goblins/kobolds small; rats small (the swarm medium); stirges/imps tiny; wolves/worgs medium
   except the dire wolf large; ogres, trolls, owlbears, elementals large; the greater fire
   elemental huge. Where you are unsure, medium; the field is a default, not a rule.

3. **A table-ready `name` per token, and `tags`.** Your `title` is family-relative ("Mage",
   "Commander", "Club brute"), which is right for the gallery but wrong on a table where a goblin
   mage and a skeleton mage sit side by side. HeroByte derives one today ("Goblin mage", "Ghast
   champion", "Imp scout", "Closed chest") from a stem table in the importer, capped at 50
   characters (the create-npc limit). A `name` you own would let that table retire, and it would
   match the gallery's captions. Alongside it, `tags: string[]` with a creature type
   (`humanoid`, `undead`, `beast`, `fiend`, `plant`, `construct`, `elemental`, `monstrosity`,
   `swarm`, `object`) and a role (`melee`, `ranged`, `caster`, `leader`, `beast`, `disguise`) —
   search in the library is word-based, so tags are free search terms. A display label per group
   (`groups[].label`, "Flying Pests" for `FlyingPests`) belongs here too.

4. **Fix the ids at the source and regenerate, so the two sites agree on URLs.** HeroByte and the
   community site should point at the same `<Family>/<id>.png`. Three ids carry typos or drafting
   history: `goblinScimatar` → `goblinScimitar`, `goblinUnarmedScavanger` → `goblinScavenger`,
   `skeletonRustySword-proportions-v3` → `skeletonRustySword`. And the five disguised mimics are the
   only files whose name is not their id (`closedChest.png` for `mimicChestHidden`); HeroByte renames
   them on import today, but the pack should not need that — please name the file by the id (or the
   id by the file, your call, as long as they match). A `packVersion` (semver) at the top of the
   manifest would let HeroByte tell packs apart when this lands.

5. **The licensing and provenance block, ready for the open release.** At the top of the manifest:
   `license` as an SPDX id (the owner decides which — CC0-1.0 or CC-BY-4.0 are the usual two for an
   art pack), `attribution` (the string the owner wants credited), and `provenance` naming the
   generator and the Pixel15 pass. HeroByte's copy of the folder carries a README saying "licence
   pending"; when this field lands the README is regenerated from it.

One note rather than an ask: the content bounding box you already record (`contentBBoxAlpha16`)
ranges from 60% to 96% of the canvas, median 82%, so some creatures (the storm harpy, the slinger)
render visibly smaller than their neighbours at the same token size. HeroByte ships the files
verbatim today. If you ever want to normalise fill, do it on 15-px cell boundaries and crop each
mimic pair to the union of its two boxes so the pair stays aligned; the importer would pick it up
without changes.

What the integration reads, so nothing above breaks it: `assets[].id`, `family`, `title`, `src`,
`stage` (must be `filtered`), `sha256`, `width`/`height` (must be 1254), `mimicState`,
`counterpartId`, and `groups[].id` for family order. New fields are ignored until HeroByte wires
them, so ship them whenever they are ready.
