// Help entries that say what a phone does differently from the desktop. They live in their own
// file so helpTopics.ts stays under the 350-line guard; each is pinned by helpText.u10c.test.ts.
import type { HelpEntry } from "./helpTopics";

export const DELETE_ENTRY: HelpEntry = {
  term: "Delete",
  detail:
    "Select and press Delete — only what you own, and it asks first. A phone has no Delete key: erase drawings with the Draw sheet's Erase drawings (Undo drawing takes back the last one), delete your props in Props, and a DM deletes map pieces with Select → 🗑 Delete and NPCs in the NPC editor.",
};

export const CORRECT_A_ROLL_ENTRY: HelpEntry = {
  term: "Correct a roll",
  detail:
    "Where the table allows entering a roll by hand, open a roll in 📜 Rolls and use ENTER A ROLL BY HAND to replace it with what the real dice showed: your own, or any if you are the DM. Desktop only for an older roll in the log; on a phone you can correct your latest roll from the roller.",
};

export const HP_ENTRY: HelpEntry = {
  term: "HP",
  detail:
    "Click either number to type a value, or drag along the bar to scrub it. Temp HP is the number on the line below. On a phone, tap a number on your row in ◉ PARTY.",
};
