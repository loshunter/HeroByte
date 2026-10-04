// Help entries that say what a phone does differently from the desktop. They live in their own
// file so helpTopics.ts stays under the 350-line guard; each is pinned by helpText.u10c.test.ts.
import type { HelpEntry } from "./helpTopics";

export const DELETE_ENTRY: HelpEntry = {
  term: "Delete",
  detail:
    "Select and press Delete: a token or drawing you own, and it asks first. Props are deleted in the Props panel (the key says so). A phone has no Delete key: your drawings go with Tools → Draw → Erase drawings or Undo drawing (your latest); a prop with Tools → Props (when the DM allows player props) → Delete; a DM uses ♛ DM → 🏗️ Edit the live map → 👆 Select → 🗑 Delete for map pieces and ♛ DM → NPCs & Monsters → Delete for an NPC. A player's own token cannot be deleted on a phone: ask the DM to remove it, or use a computer.",
};

export const CORRECT_A_ROLL_ENTRY: HelpEntry = {
  term: "Correct a roll",
  detail:
    "Where the table allows entering a roll by hand, open a roll in 📜 Rolls and press ✋ THAT'S NOT WHAT I ROLLED (✋ CHANGE IT AGAIN once corrected) to replace it with what the real dice showed: your own, or any if you are the DM. On a phone, only the roll you just made, on its result card before you close it; correcting an older roll from the log is desktop only.",
};

export const HP_ENTRY: HelpEntry = {
  term: "HP",
  detail:
    "Click either number to type a value, or drag along the bar to scrub it. Temp HP is the number on the line below. On a phone, tap a number on your row in ◉ PARTY (a DM: on any row).",
};
