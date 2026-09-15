// The DM half of the in-app help. Its own module because helpTopics.ts grew
// past the 350-line guard when the Token Library added four entries, and this
// is the topic that keeps growing: every DM-only feature lands here.

import type { HelpTopic } from "./helpTopics";

export const DM_HELP_TOPIC: HelpTopic = {
  id: "dm",
  icon: "🛠️",
  title: "Running the game (DM)",
  entries: [
    {
      term: "Become the DM",
      detail: "Your card's ⚙️ → Dungeon Master Mode → DM MODE: OFF, then the table's DM password.",
    },
    {
      term: "+ Add NPC",
      detail:
        "DM Menu → NPCs. Name, HP, initiative modifier, portrait and token art — the same plumbing as a player.",
    },
    {
      term: "Adding a whole pack",
      detail:
        "Set the ×N field before + Add NPC to make up to 20 at once. They come out numbered — Goblin 1, Goblin 2 — and a second batch carries on from where the first stopped rather than repeating it.",
    },
    {
      term: "📖 Library",
      detail:
        "DM Menu → NPCs → 📖 LIBRARY. 244 bundled tokens — 184 monsters and 60 townsfolk — searchable by name, ancestry, trade and the pack’s own tags. A pick becomes an NPC with its art, portrait and size already set, and the ×N field applies.",
    },
    {
      term: "🎭 Reveal mimic",
      detail:
        "The library ships five mimic pairs — chest, barrel, door, sarcophagus, spellbook. Place the closed object, set its Stance to Neutral so the party sees a prop, and press 🎭 REVEAL MIMIC when they disturb it: the token swaps to the monster in the same cell and the Stance goes back to Enemy.",
    },
    {
      term: "Stance",
      detail:
        "Enemy, Neutral or Ally — what an NPC’s Entities card wears, in red, gold or green. Townsfolk arrive Neutral and monsters Enemy; change it on the NPC’s Stance select in the DM menu. Players see it, so a disguised enemy is one you set Neutral.",
    },
    {
      term: "CUSTOM (your own tokens)",
      detail:
        "The Library’s CUSTOM chip is this table’s own shelf: upload an image or paste an https link, give it a name, tags, a size and a stance, and it searches and picks like the pack’s. Keep a copy on this table copies a pasted link into the table’s storage so the token outlives the host.",
    },
    {
      term: "⧉ Duplicate",
      detail:
        "Copies an NPC's stats and art into a new one under the next free number, so a tweaked goblin becomes five tweaked goblins. A copy of a hidden NPC stays hidden.",
    },
    {
      term: "PLACE ON MAP",
      detail:
        "Drops that NPC's token at the map's top-left corner cell, not where you are looking — recentre or drag it in. Pressing it again moves that same token rather than adding a second. The 👁️ eye hides an NPC from players entirely.",
    },
    {
      term: "Fog of War",
      detail:
        "DM Menu → Map Setup. Needs a built map with walls; publish one in the live editor first.",
    },
    {
      term: "👁 Player View",
      detail:
        "Renders your own table exactly as players receive it, while you keep every DM power.",
    },
    {
      term: "🏗️ Map",
      detail:
        "The live map editor — rooms, walls, doors, terrain, lighting, generator. On a phone or tablet it lives at DM → 🏗️ Edit the live map, and the bottom dock becomes the palette: Exit, Tool, Undo, Redo, Abort. Every tool is reachable by finger — Paint, Erase, Room, Hall, Wall, Door, Place, Scatter, Light, Row, Spline and Gen — plus 👆 Select for picking a piece (then ✎ Edit to turn, resize, re-layer or hide it), 💧 Sample to arm Place with whatever you tap, and 🗂 Layers — where the Lighting layer’s opacity is the ambient light, so that is how a tablet makes it night. Place, Scatter and Light AIM while your finger is down and drop when you lift, because a phone has no hover to preview with. ⨯ ABORT discards the gesture in progress, because lifting a finger commits.",
    },
    {
      term: "SAVE GAME STATE",
      detail:
        "DM Menu → Session. The whole table as one file, images included. Save before every risky experiment. The toast says the table's wire weight (what a load sends; images not counted) and the file's disk size: a load must fit 1 MB, so mints are refused past 0.75 MB.",
    },
  ],
};
