// ============================================================================
// HELP TOPICS
// ============================================================================
// Content for the in-app help panel, authored as data so the panel component
// stays a renderer.
//
// Why this is hand-written rather than the guide markdown itself: the full
// guides live in docs/user-guide/, which is OUTSIDE apps/client (what the
// Pages build sees), their 36 screenshots are ~4.8 MB, and the client has no
// markdown renderer. So the panel carries a curated task-oriented subset —
// "I am at the table and I want to do X" — and links out to the full guides
// for everything else. Keep the two in step when a slice changes behaviour.

import { DM_HELP_TOPIC } from "./dmHelpTopic";
import { TABLE_MENU_HELP_TOPIC } from "./tableHelpTopic";
import { CORRECT_A_ROLL_ENTRY, DELETE_ENTRY, HP_ENTRY } from "./phoneHelpEntries";

/** One "how do I…" line inside a topic. */
export interface HelpEntry {
  /** The control or concept, as it is labelled in the UI. */
  term: string;
  /** What it does, in one sentence. */
  detail: string;
}

export interface HelpTopic {
  id: string;
  icon: string;
  title: string;
  entries: HelpEntry[];
}

export interface HelpLink {
  label: string;
  href: string;
  detail: string;
}

/** Guides live on GitHub; the screenshots are why they are not bundled. */
const GUIDE_BASE = "https://github.com/loshunter/HeroByte/blob/main/docs/user-guide";

export const HELP_LINKS: HelpLink[] = [
  {
    label: "Getting Started",
    href: `${GUIDE_BASE}/getting-started.md`,
    detail: "Joining a table, private tables, invite links, becoming the DM",
  },
  {
    label: "Player Guide",
    href: `${GUIDE_BASE}/player-guide.md`,
    detail: "Every player-facing feature, with screenshots",
  },
  {
    label: "DM Guide",
    href: `${GUIDE_BASE}/dm-guide.md`,
    detail: "The DM Menu, fog, NPCs, initiative, the Table tab and backups",
  },
  {
    label: "Map Editor Guide",
    href: `${GUIDE_BASE}/map-editor-guide.md`,
    detail: "Rooms, walls, doors, terrain, lighting, the dungeon generator",
  },
];

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "atlas",
    icon: "🗺️",
    title: "World: locations, linked maps & travel",
    entries: [
      {
        term: "The World tab",
        detail:
          "DM Menu → World. Your campaign as a tree of locations and their linked maps: create locations, link saved maps, or generate a dungeon or a building for an empty one. The tab says where the party is; nothing here moves them except Travel here and Kick in a door.",
      },
      {
        term: "Promises",
        detail:
          "A location without a map (⬒) is a promise — pick 🎲 Generate map for location… or 🔗 Link existing map to make it real when the party gets there. Generating creates a saved map; the party stays where it is. It costs nothing until then.",
      },
      {
        term: "🚩 Travel here",
        detail:
          "Moves the whole table to that location, after asking. The scene you leave — tokens, open doors, drawings, combat — is suspended exactly as it stands, and coming back resumes it. Two exceptions, both named in the confirmation: a scene whose map was deleted has nowhere to be kept, so only the player characters come along; and a table with no saved map (a background image only) suspends nothing — on a first visit its background, NPCs, props and drawings come along.",
      },
      {
        term: "Discovery",
        detail:
          "Players only see locations you've marked 👁 Discovered (first travel discovers automatically). Hidden locations never reach their screens at all.",
      },
      {
        term: "🗺 World Map & links",
        detail:
          "Players carry the discovered world: the 🗺 WORLD button (on a phone, Tools → World). The DM can also pin door/stair/signpost sprites onto the map itself — ⚓ in the World tab, then click where it sits — and click one to travel there.",
      },
      {
        term: "The recipes",
        detail:
          "Dungeon — rooms, corridors, doors, braziers, and a DM-only key per room. Building — a tavern, shop, warehouse or house, partitioned by real walls with one front door you arrive just inside. Same seed and dials, same place, forever.",
      },
      {
        term: "🚪 Kick in a door",
        detail:
          "The party kicked in a door you never prepped? Press G (or 🚪 KICK IN A DOOR in the World tab; on a phone, DM → 🚪 Kick in a door): name it, pick the dials, 🚪 Generate & enter — the whole table is standing in a fresh, stocked scene under the location you were on, with a door back. A table that was never in World is adopted by its first kick.",
      },
    ],
  },
  {
    id: "moving",
    icon: "🧭",
    title: "Getting around the map",
    entries: [
      {
        term: "Pan",
        detail: "Drag empty map space, or middle-mouse drag even with a tool active.",
      },
      { term: "Zoom", detail: "Mouse wheel, toward the cursor (0.1× to 8×)." },
      {
        term: "🧭 Reset view",
        detail:
          "Moves the view back to the map's top-left corner (the origin, 0, 0) at 1× zoom (100%) — " +
          "not the middle of the map, and not where you arrived.",
      },
      {
        term: "Find your token",
        detail:
          "🎯 on your row in the Party jumps the camera to it — each of your characters with a token on the map has its own (on desktop a row without one shows —; a phone row shows no 🎯 FOCUS).",
      },
      { term: "Touch", detail: "One finger pans, two fingers pinch-zoom." },
    ],
  },
  {
    id: "character",
    icon: "🧙",
    title: "Your character card",
    entries: [
      {
        term: "Open it",
        detail:
          "Select your row in the Party at the bottom; your card opens beside the rows. ✕ or Esc closes it. ▦ CARDS shows every card at once. On a phone, ◉ PARTY lists your rows, and ⚙️ EDIT on one opens its settings.",
      },
      { term: "Name", detail: "Click it to rename inline (on a phone: ⚙️ EDIT → Character Name)." },
      HP_ENTRY,
      {
        term: "Portrait & token art",
        detail:
          "⚙️ → ⬆ UPLOAD IMAGE takes a file from your device — on a phone, the camera roll. A pasted image URL still works. Token art is set from the desktop window only.",
      },
      {
        term: "Status effects",
        detail:
          "⚙️ → 38 conditions; up to three show as medallions, the rest roll into a +N bubble.",
      },
      {
        term: "Token size",
        detail:
          "⚙️ → Token settings → Tiny through Gargantuan (half a cell up to three cells). A DM can resize anyone's.",
      },
      {
        term: "A second character",
        detail: "⚙️ → ➕ ADD CHARACTER gives you another row, card, token, HP and initiative.",
      },
    ],
  },
  {
    id: "tokens",
    icon: "♟️",
    title: "Tokens",
    entries: [
      {
        term: "Move",
        detail:
          "Drag it, or step it with WASD / arrows (QEZC diagonal; hold to walk). With nothing selected the keys move your own token if you run just one character — except while typing, and ↑/↓ page a panel you last clicked into or scrolled (WASD and ←/→ still walk). 🖱️ SELECT and 🔄 TRANSFORM move only the piece you picked (nothing picked, nothing moves); ✏️ Draw, the grid-alignment wizard and World link placement (⚓ AIM ON MAP) take the keys. Phone: TOOLS → □ Select, tap the piece, use the d-pad.",
      },
      { term: "Recolor", detail: "Double-click your own token for a new random colour." },
      {
        term: "Select several",
        detail: "🖱️ Select drags a marquee; Shift-click adds, Ctrl/Cmd-click toggles.",
      },
      {
        term: "Resize / rotate",
        detail: "🔄 Transform gives handles; rotation snaps to 45°, hold Ctrl/Cmd to go free.",
      },
      DELETE_ENTRY,
      {
        term: "🔒 Locked",
        detail:
          "Pinned by the DM; it cannot be moved or deleted until unlocked. The DM unlocks a token with Token Lock in its ⚙️ settings (on a phone: ◉ Party → ⚙️ EDIT); a locked map element can only be unlocked on a computer.",
      },
      { term: "Ping", detail: "Double-click (or double-tap) empty space in any tool mode." },
    ],
  },
  {
    id: "dice",
    icon: "⚂",
    title: "Dice",
    entries: [
      {
        term: "Build a roll",
        detail:
          "⚂ Dice → click dice to add them, click again for more; the ×N badge takes an exact count.",
      },
      {
        term: "Modifiers",
        detail: "+1 / −1 chips; click a chip to type anything from −99 to +99.",
      },
      {
        term: "ADV / DIS",
        detail:
          "Rolls the first die term twice and keeps the better (or worse) subtotal. The discarded dice stay in the breakdown, struck through.",
      },
      {
        term: "Who sees it",
        detail:
          "TABLE is everyone at the table, DM is you and whoever is in DM mode (now or later), ME is you alone — no other player or DM is sent it. A hidden roll is not sent to anyone outside its audience: there is no copy in their browser. (Someone with the table password could claim your seat once you have been gone more than six hours, or right after the server restarts for an update, and read the hidden rolls still stored for it.)",
      },
      { term: "Macros", detail: "+ SAVE names a built roll. Macros live in this browser only." },
      CORRECT_A_ROLL_ENTRY,
      {
        term: "📜 Chat & Rolls",
        detail:
          "Chat opens first; choose Rolls for dice history, newest first. Your last tab is remembered. On a phone, open Chat in the dock.",
      },
      {
        term: "The server rolls",
        detail:
          "Your browser sends only the formula. There is no total in the message to tamper with, and your name is stamped from the connection.",
      },
    ],
  },
  {
    id: "drawing",
    icon: "✏️",
    title: "Drawing, templates, measuring",
    entries: [
      {
        term: "✏️ Draw",
        detail:
          "Freehand, Line, Rectangle, Circle, Erase drawings, plus colour, stroke width, opacity and Filled.",
      },
      {
        term: "Undo / redo",
        detail:
          "Buttons, or Ctrl+Z / Ctrl+Y while draw mode is active. Yours only. Erasing a whole line or shape cannot be undone (Undo skips it and takes back your latest remaining drawing); erasing part of a freehand stroke can.",
      },
      {
        term: "Area templates",
        detail:
          "AoE Burst (a circle), Cone, Cube (a square) and Bolt (a line); a line beside the buttons (under them on a desktop, above them on a phone) says what the active one draws. Drag out from the origin: a Burst, Cone or Bolt starts at the nearest cell centre, grid corner or cell-edge middle to where you press, and a Cube at the nearest grid corner; the size snaps to whole squares and lands labelled by its shape (“15 ft cone”; a Burst reads “20 ft circle”, its radius; a Cube reads “15 ft square” and a Bolt “30 ft line”).",
      },
      {
        term: "📏 Measure",
        detail:
          "Click to start, click again to freeze the reading, a third time to start over. The whole table sees your line while you drag it.",
      },
      {
        term: "Diagonals",
        detail:
          "Counted by the table's rule, which the DM sets — 5e by default, so a two-square diagonal is 10 ft.",
      },
      {
        term: "👆 Ping",
        detail:
          "Click to plant a ping for three seconds. A player’s ping reaches the DM and the players who can see that spot; a DM’s ping reaches everyone.",
      },
      { term: "✥ Move", detail: "Return to moving tokens and panning the map after using a tool." },
    ],
  },
  {
    id: "fog",
    icon: "🌑",
    title: "Doors, fog, and what you can see",
    entries: [
      {
        term: "Fog of war",
        detail: "Vision radiates from the tokens YOU own and is blocked by walls and closed doors.",
      },
      {
        term: "Sight radius",
        detail:
          "Your token may have a limit in feet — a torch, darkvision, a blindfold — and beyond it you see nothing even down an open corridor. Only the DM can set it, because a limit can only ever narrow what you see. The DM can also darken the whole table at once, which applies to every token that has no limit of its own.",
      },
      {
        term: "Explored ground",
        detail:
          "Somewhere you have already been stays dimly lit so you can find your way back. It remembers the GROUND only — anything that wandered in since is still hidden.",
      },
      {
        term: "Doors",
        detail: "Click to open or close. A small gold square means locked (DM only).",
      },
      { term: "Secret doors", detail: "They read as plain wall until the DM reveals one." },
    ],
  },
  {
    id: "table",
    icon: "🎲",
    title: "Voice, initiative, and combat",
    entries: [
      {
        term: "🎤 Voice",
        detail:
          "Desktop only: press it on your own card and allow the microphone. Peer-to-peer; a speaker's portrait glows. Needs https:// or localhost.",
      },
      {
        term: "INIT",
        detail:
          "Set the modifier (drag it, or − / +) and ROLL D20 NOW, or — where the table allows it — ENTER A ROLL BY HAND to type what you rolled at the real table and SAVE INITIATIVE. On a phone: Party → ⚔️ INIT on your character's row. To take a character out of the order, ⚙️ settings → Clear Initiative (on a phone: ⚙️ EDIT → Clear Initiative).",
      },
      {
        term: "Combat starts",
        detail:
          "Any initiative saved while no fight is running starts it for everyone, on that character's turn — after END COMBAT too, since initiatives stay; on desktop the Party's rows reorder and the current turn's row is outlined and tagged Turn, and on a phone the turn strip names whose turn it is. A party member's plate then reads feet left / speed, refilled at the start of its turn; the DM sets speed in ⚙️ settings (monsters: DM Menu → NPCs & Monsters) and can reset a spend there — the budget is advisory, a red readout is a note, not a wall.",
      },
      { term: "◄ PREV / NEXT ►", detail: "Advance the turn — any player can nudge it." },
    ],
  },
  {
    id: "seat",
    icon: "🔑",
    title: "Your seat: devices, reconnects, a fresh start",
    entries: [
      {
        term: "One device at a time",
        detail:
          "Your seat is held by the browser that logged in. A second device sees Held in another window: it has no session key, so it cannot take the seat — and neither can anyone else who knows the table password.",
      },
      {
        term: "Try Again",
        detail:
          "Worth one click from the same browser: it usually takes the seat back. Otherwise the seat stays reserved while the first device is connected and for up to six hours after it disconnects — more retries will not shorten that.",
      },
      {
        term: "Start a Fresh Session",
        detail:
          "Appears on that gate once a retry has failed. This browser becomes a new player: you will not get back into the old character, which stays at the table until the DM deletes it or removes the seat, and DM powers need the DM password again.",
      },
      {
        term: "After a deploy",
        detail:
          "Reload the tab. Players come straight back; the DM enters the DM password once more.",
      },
    ],
  },
  TABLE_MENU_HELP_TOPIC,
  DM_HELP_TOPIC,
];
