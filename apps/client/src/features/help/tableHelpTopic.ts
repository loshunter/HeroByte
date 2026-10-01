// The player half of "your table": where your role, your preferences and your
// character's file live (U9). Its own module because helpTopics.ts sits at the
// 350-line guard — the same reason the DM topic has one.
//
// The DM's half (invites, permissions, backups, security) is in dmHelpTopic.ts.

import type { HelpTopic } from "./helpTopics";

export const TABLE_MENU_HELP_TOPIC: HelpTopic = {
  id: "tablemenu",
  icon: "▤",
  title: "Your table: role, preferences, files",
  entries: [
    {
      term: "The Table button",
      detail:
        "Top left of the header: the table's name, your role (Player or DM) and the connection (🟢 online, 🔴 offline). It opens the Table menu. On a phone: Tools → Table. The connection shows in the header of every full screen too (Party, Chat & Rolls, the DM menu, Table and the rest), so it never covers a title.",
    },
    {
      term: "Enter DM mode",
      detail:
        "Table menu → Enter DM mode, then the table's DM password. A table made without a DM password offers to set one right there. A wrong password shows its error and you stay a player. Your character stays yours either way.",
    },
    {
      term: "Leave DM mode",
      detail:
        "Table menu → Leave DM mode (a DM also has it at the top of DM Menu → Table). You keep your character and your seat, the DM tools close, and the DM password brings them back.",
    },
    {
      term: "Preferences",
      detail:
        "Table menu → Preferences. Display: 📺 CRT, a retro screen effect. Sound & motion: Motion (Full, Subtle or Off), mute, volume. They are for you only and kept in this browser; Motion starts Off if your device asks for reduced motion.",
    },
    {
      term: "Save character / Load character",
      detail:
        "Your character's ⚙️ settings → Character file, on desktop and on a phone. A file holds one character — name, HP, portrait, token and conditions — plus your own drawings if you have any; loading a file that holds drawings replaces the drawings you have on the map, and one with none leaves yours alone (a DM who loads a file onto someone else's character changes that character only). It is never the table: a whole-table backup is the DM's (DM Menu → Table → Backups) and a map is Export editable map (DM Menu → Maps). Each picker tells you what it was handed if it is the wrong kind.",
    },
  ],
};
