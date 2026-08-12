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
    detail: "The DM Menu, fog, NPCs, initiative, session saves",
  },
  {
    label: "Map Editor Guide",
    href: `${GUIDE_BASE}/map-editor-guide.md`,
    detail: "Rooms, walls, doors, terrain, lighting, the dungeon generator",
  },
];

export const HELP_TOPICS: HelpTopic[] = [
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
      { term: "🧭 Recenter", detail: "Puts the camera back at the middle of the map." },
      { term: "Find your token", detail: "The ⚔️ button on your own card jumps the camera to it." },
      { term: "Touch", detail: "One finger pans, two fingers pinch-zoom." },
    ],
  },
  {
    id: "character",
    icon: "🧙",
    title: "Your character card",
    entries: [
      { term: "Name", detail: "Click it to rename inline." },
      {
        term: "HP",
        detail: "Click either number to type a value, or drag along the bar to scrub it.",
      },
      {
        term: "Portrait & token art",
        detail:
          "⚙️ → ⬆ UPLOAD IMAGE takes a file from your device — on a phone, the camera roll. A pasted image URL still works.",
      },
      {
        term: "Status effects",
        detail:
          "⚙️ → 38 conditions; up to three show as medallions, the rest roll into a +N bubble.",
      },
      {
        term: "Token size",
        detail: "⚙️ → Tiny through Gargantuan (half a cell up to three cells).",
      },
      {
        term: "A second character",
        detail: "⚙️ → ➕ ADD CHARACTER gives you another card, token, HP and initiative.",
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
        detail: "Drag it. With Snap on it clicks to grid cells; everyone sees it live.",
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
      { term: "Delete", detail: "Select and press Delete — only what you own, and it asks first." },
      {
        term: "🔒 Locked",
        detail: "Pinned by the DM; it cannot be moved or deleted until unlocked.",
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
          "TABLE is everyone, DM is you and the DM, ME is you alone. A hidden roll is never sent to anyone else — there is no copy in their browser.",
      },
      { term: "Macros", detail: "+ SAVE names a built roll. Macros live in this browser only." },
      {
        term: "📜 Log",
        detail: "The shared history, newest first; click an entry for its full breakdown.",
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
        term: "✏️ Draw Tools",
        detail:
          "Freehand, Line, Rect, Circle, Eraser, plus colour, brush size, opacity and Filled.",
      },
      {
        term: "Undo / redo",
        detail: "Buttons, or Ctrl+Z / Ctrl+Y while draw mode is active. Yours only.",
      },
      {
        term: "Area templates",
        detail:
          "◯ Circle, ◺ Cone, ▢ Square, ▬ Line. Drag out from the origin; it snaps to whole squares and lands labelled (“15 ft cone”).",
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
      { term: "👆 Pointer", detail: "Click to plant a ping everyone sees for three seconds." },
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
          "Press it on your own card and allow the microphone. Peer-to-peer; a speaker's portrait glows. Needs https:// or localhost.",
      },
      {
        term: "INIT",
        detail:
          "Drag the modifier and ROLL INITIATIVE, or USE PHYSICAL DICE to type what you rolled at the real table.",
      },
      {
        term: "Combat starts",
        detail:
          "The first initiative saved starts it for everyone; cards reorder and the current turn glows gold.",
      },
      { term: "◄ PREV / NEXT ►", detail: "Advance the turn — any player can nudge it." },
    ],
  },
  {
    id: "dm",
    icon: "🛠️",
    title: "Running the game (DM)",
    entries: [
      {
        term: "Become the DM",
        detail:
          "Your card's ⚙️ → Dungeon Master Mode → DM MODE: OFF, then the table's DM password.",
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
          "The live map editor — rooms, walls, doors, terrain, lighting, generator. On a phone or tablet it lives at DM → 🏗️ Edit the live map, and the bottom dock becomes the palette: Exit, Tool, Undo, Redo, Abort. Room and Wall by finger; ⨯ ABORT discards the drag in progress, because lifting a finger commits.",
      },
      {
        term: "SAVE GAME STATE",
        detail:
          "DM Menu → Session. The whole table as one file, images included. Save before every risky experiment.",
      },
    ],
  },
];
