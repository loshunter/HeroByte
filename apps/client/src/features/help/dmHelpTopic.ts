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
      detail:
        "Your row in the Party → your card's ⚙️ → Table role → DM MODE: OFF, then the table's DM password. On a phone: ◉ PARTY → ⚙️ EDIT on your row → Table role.",
    },
    {
      term: "+ Add NPC",
      detail:
        "DM Menu → NPCs. Name, HP, initiative modifier, portrait, token art and conditions — the same plumbing as a player. 🎯 FOCUS centres the map on a placed NPC; on a phone this tab (♛ DM → NPCs & Monsters) is where an NPC's conditions and Focus live.",
    },
    {
      term: "A player's character",
      detail:
        "Select its row, then on its card: click an HP number to set it. ⚙️ → Token settings → Owner moves it, token and all, to another player's seat (player characters only). On a phone: ◉ PARTY → the HP on its row, and ⚙️ EDIT → Owner.",
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
        "The library ships five mimic pairs — chest, barrel, door, sarcophagus, spellbook. Place the closed object and press 🎭 REVEAL MIMIC when the party disturbs it: the token swaps to the monster in the same cell. Either button sets the Stance to match the face it put on — Enemy on a reveal, Neutral on 🎭 DISGUISE — so the card never contradicts the art. A shell you add as a NEW NPC still arrives Enemy, like every monster in the pack.",
    },
    {
      term: "Stance",
      detail:
        "Enemy, Neutral or Ally — what an NPC’s Party row says and its card wears, in red, gold or green. Townsfolk arrive Neutral and monsters Enemy; change it on the NPC’s Stance select in the DM menu. Players see it, so a disguised enemy is one you set Neutral.",
    },
    {
      term: "CUSTOM (your own tokens)",
      detail:
        "The Library’s CUSTOM chip is this table’s own shelf: upload an image or paste an https link, give it a name, tags, a size and a stance, and it searches and picks like the pack’s. Keep a copy on this table is offered for any https link and tries to copy it into the table’s storage so the token outlives the host; some hosts (Discord) refuse, and then the link stays and a line says so.",
    },
    {
      term: "⧉ Duplicate",
      detail:
        "Copies an NPC's name, HP, art, size, stance and hidden flag into a new one under the next free number, so a tweaked goblin becomes five tweaked goblins. Temp HP, the initiative modifier, status effects and a set movement speed do not ride — the copy starts its own fight at the defaults. A copy of a hidden NPC stays hidden.",
    },
    {
      term: "PLACE ON MAP",
      detail:
        "Drops that NPC's token at the map's top-left corner cell, not where you are looking — recentre or drag it in. Pressing it again moves that same token rather than adding a second. The 👁️ eye hides an NPC from players entirely.",
    },
    {
      term: "⚔️ Encounter",
      detail:
        "DM Menu → Encounter (on a phone, DM → Encounter): the whole fight in one place. Setup lists who is in the order and who has not rolled — 🎲 Roll, Set…, ✕ to leave the order, 🎯 — with + Add NPCs… (it opens NPCs & Monsters) and the Monster HP players see. Initiative: Roll missing NPC initiative rolls only the NPCs without one (a hidden NPC's line, and while fog is on over a built map any placed NPC's, goes to your log only); players roll their own from INIT; whether they may type a roll by hand is set in Session. Run encounter: Start combat, Next / Previous, End combat (initiatives stay on file). Any initiative saved while no fight is running starts combat, on that character's turn — after End combat too, since initiatives stay; ⏮ Start at top of order moves the turn to the top, starts the round over and refills everyone's movement.",
    },
    {
      term: "Fog of War",
      detail:
        "DM Menu → Maps → Current table map. Needs a built map with walls; build one with 🏗️ Build map first (on a phone, DM → 🏗️ Edit the live map).",
    },
    {
      term: "👁 Player View",
      detail:
        "Renders your own table exactly as players receive it, while you keep every DM power.",
    },
    {
      term: "🏗️ Build map",
      detail:
        "The live map editor. Tool group offers Terrain, Structures, Objects, Lighting and Generate, remembering the last tool in each group. Select, Sample, Layers, history and Done stay separate from scrolling settings. Build edits the map on the table and names it. If you opened a different saved map in DM Menu → Maps, Build names both and offers Resume editing <table map>; it never swaps maps by itself. On a phone or tablet: DM → Edit the live map, then Tool opens the palette; Done returns to play. Select picks a piece, then Edit turns, resizes, re-layers or hides it. Layers controls ambient light through Lighting opacity. Place object, Scatter objects and Place light aim while your finger is down and commit when you lift. Stop cancels the active gesture.",
    },
    {
      term: "Decorate last room / hallway",
      detail:
        "In Structures, choose Room or Hallway. After drawing, the named outline marks the last region you placed; choose decoration category and density, then Decorate last room or Decorate last hallway. Each region can be decorated once, as one Undo step. Working means wait for the map to finish. An empty region or a locked placement layer cannot be decorated.",
    },
    {
      term: "SAVE GAME STATE",
      detail:
        "DM Menu → Session. The whole table as one file, images included. Save before every risky experiment. The toast says the table's wire weight (what a load sends; images not counted) and the file's disk size: a load must fit 1 MB, so mints are refused past 0.75 MB.",
    },
    {
      term: "REMOVE (a player)",
      detail:
        "DM Menu → Players. A player who is not at the table shows REMOVE (a browser still open on a login screen or at another table counts as here for five minutes; a seat dropped in the last minute reads 'dropped just now' and waits): their seat, character sheets and tokens go, and a fight in progress passes the turn on rather than skipping a round. Not a ban — the table password still lets them back in, as a new player.",
    },
  ],
};
