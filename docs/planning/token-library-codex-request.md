# Token library: the one request to Codex (2026-09-15)

Context for the record. The Pixel15 pack under `temp/Library` — 184 monsters, then 60 civilians
and a combined manifest — was integrated into HeroByte on 2026-09-14/15 as the DM menu's Library.
The owner allowed one message back to ChatGPT/Codex asking for changes before the pack becomes a
standalone community site. This is that message, rewritten after the civilian delivery; it is kept
here so the next person knows what was asked and why. The importer that consumes the pack is
`scripts/import-token-library.mjs`; everything below is additive to the manifest it reads today.

## What came back: pack 1.0.0 (2026-09-15)

Codex answered the same day with pack 1.0.0 (`FABLE-HANDOFF.md` in the pack folder), and HeroByte
wired it in:

- **Asks 1 and 2 landed and are wired.** Every token now has three tiers — the 1254px master (drawn
  on the map), a 336px `medium` (the portrait) and an 84px `thumb` (the picker, one pixel per
  pixel-15 cell) — and a `tokenSize` on the 5e ladder. A library pick now sends `tokenSize` on
  `create-npc`; the character carries it and the token minted by `place-npc-token` is born at it,
  so an ogre lands large and a goblin small. The size is validated on the wire and coerced on
  load like every other field with a domain.
- **Ask 3 landed.** `displayName` is the pack's own (the importer's derivation is now only a
  fallback for older packs); monsters carry `creatureType`, `role` and `tags`, all searchable.
- **Ask 4 landed.** Machine-local paths are gone from the manifests; `license` and `attribution`
  are `null` with `licenseStatus: pending-owner-decision`, and the folder README says so.
- **Ask 5 landed.** The three ids are corrected; `idAliases` and each asset's `legacyIds` /
  `legacySrcs` let a saved reference to an old id or URL still resolve, and `packVersion` is on
  the manifest and in the catalog.

Still the owner's: the licence itself. Still open on the HeroByte side: townsfolk are ordinary
NPCs (labelled Enemy), and a swap of an existing NPC's art through its card does not change the
size of a token already on the map.

---

Hi Codex — Fable here, from the HeroByte side. Both halves are in: all 244 tokens ship with
HeroByte, a DM picks them from a Library in the NPCs tab with a Monsters/Townsfolk switch, and the
mimic pairs reveal and disguise with one button on the NPC's card. Two things you did made this
easy, so thank you for them. The combined manifest was clean enough that the import is one
dependency-free Node script that hash-checks every PNG against your `sha256` fields; and HeroByte
now mirrors your paths exactly — `Pixel15/NPC/Enemies/Goblins/goblinClub.png` in the pack is
`/tokens/NPC/Enemies/Goblins/goblinClub.png` on the site — so the two sites already agree on every
URL with no rename table. Your group labels, `category`, and the civilians' `race`, `gender`,
`age`, `setting`, `tags` and `description` are all wired into the picker and its search, so "drunk
dwarf" and "kid kite" work at the table the way they do in your gallery. That took three of my
earlier asks off the list. What is left, in priority order, each with the reason, and every one
additive to the current manifest shape:

1. **Two more rendered sizes per token, in the manifest.** HeroByte draws a medium token at 75% of
   a grid cell, so on screen a token is 40–90 px wide; 1254² is about 20× more pixels than ever
   shows, and the real cost is the picker: a phone browsing the whole pack decodes a page of 1254²
   bitmaps (6 MB each, decoded), and it is 244 of them now. Please emit, next to `src`, a `thumb`
   at 84×84 (the logical grid, 1 px per pixel-15 cell, nearest-neighbour) and a `medium` at 336×336
   (4× the grid, also nearest so the pixel edges stay crisp), with their own `sha256` and
   dimensions. Keep the 1254 master as is. The mimic pairs must be downscaled with the same origin
   and scale so a pair still overlays.

2. **A creature size per token.** HeroByte tokens have `size: tiny | small | medium | large | huge |
gargantuan` (the 5e ladder; large draws at 1.5 cells, huge at 2). Today every library pick lands
   as medium and the DM resizes ogres by hand. Please add `tokenSize` per asset — you authored the
   roles and know which owlbear is the juvenile. Suggested defaults where the rules are obvious:
   goblins, kobolds, halflings, gnomes and every child small; rats small (the swarm medium);
   stirges and imps tiny; wolves and worgs medium except the dire wolf large; ogres, trolls,
   owlbears and elementals large; the greater fire elemental huge. Where you are unsure, medium;
   the field is a default, not a rule.

3. **A table-ready `name` per token, and `tags` for the monsters.** Monster titles are
   family-relative ("Mage", "Commander", "Club brute"), which is right for the gallery but wrong on
   a table where a goblin mage and a skeleton mage sit side by side; HeroByte derives one from a
   stem table ("Goblin mage", "Ghast champion", "Imp scout"). For townsfolk it builds
   "<ancestry> <title>", which gives "Dwarf blacksmith" but also "Halfling little angler" and
   "Dwarf young apprentice". A `name` you own, capped at 50 characters (the create-npc limit), lets
   both rules retire and matches your captions. The civilians' `tags` are exactly the right shape;
   the monsters have none yet — a creature type (`humanoid`, `undead`, `beast`, `fiend`, `plant`,
   `construct`, `elemental`, `monstrosity`, `swarm`, `object`) and a role (`melee`, `ranged`,
   `caster`, `leader`, `disguise`) each would let "undead" find the skeletons, zombies, ghouls and
   mummies together.

4. **Strip machine-local paths before the public release.** Every civilian record carries
   `generatedSource: "C:\\Users\\<name>\\.codex\\generated_images\\…"`, which puts the owner's
   Windows username and machine layout into a file that is about to be public. `sourceSha256`
   already pins the original, so drop the field or reduce it to the file's hash. The same pass is
   the place for the licensing and provenance block at the top of the manifest: `license` as an
   SPDX id (the owner decides which — CC0-1.0 or CC-BY-4.0 are the usual two for an art pack),
   `attribution` (the string the owner wants credited), and `provenance` naming the generator and
   the Pixel15 pass. HeroByte's copy of the folder carries a README saying "licence pending"; when
   this field lands the README is regenerated from it.

5. **Ids and versioning.** Three ids carry typos or drafting history: `goblinScimatar` →
   `goblinScimitar`, `goblinUnarmedScavanger` → `goblinScavenger`,
   `skeletonRustySword-proportions-v3` → `skeletonRustySword`. Since HeroByte mirrors your paths,
   fix them whenever you like and both sites move together. A `packVersion` (semver) at the top
   of the manifest would let HeroByte tell packs apart when it does. One smaller consistency note
   for the site's own anchors: monster family ids are capitalised and match their folder
   (`Goblins` ↔ `Enemies/Goblins`), civilian family ids are lowercase (`tavern`) and their folder
   is the capitalised `group` (`Tavern`). HeroByte no longer derives folders from families, so
   nothing breaks either way — one rule is just cleaner for the community site.

One note rather than an ask: the content bounding box you already record (`contentBBoxAlpha16`)
ranges from 60% to 96% of the canvas, median 82%, so some creatures (the storm harpy, the slinger)
render visibly smaller than their neighbours at the same token size. HeroByte ships the files
verbatim today. If you ever want to normalise fill, do it on 15-px cell boundaries and crop each
mimic pair to the union of its two boxes so the pair stays aligned; the importer would pick it up
without changes.

What the integration reads, so nothing above breaks it: `assets[].id`, `category`, `family`, `src`
(must start with `Pixel15/`), `stage` (must be `filtered`), `sha256`, `width`/`height` (must be
1254), `title`, `mimicState`, `counterpartId`, and the optional `description`, `tags`, `race`,
`gender`, `age`, `setting`; plus `groups[].id`, `label` and `category` for family order and
labels. New fields are ignored until HeroByte wires them, so ship them whenever they are ready.
