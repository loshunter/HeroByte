// Help entries for a character's own settings: its colour (C1), token size, a second character.
// They live in their own file so helpTopics.ts stays under the 350-line guard, like
// phoneHelpEntries.ts.
import type { HelpEntry } from "./helpTopics";

export const COLOUR_ENTRY: HelpEntry = {
  term: "Colour",
  detail:
    "⚙️ → Colour (phone: ◉ PARTY → ⚙️ EDIT): drag the handle and let go, or tap a dashed ring for a free colour in one go. No two players share a colour (a player's pick is checked whenever it changes; the DM's picks are not): the striped patches are the space around other players' colours, a drag or a tap into one stops at its nearest free edge and says whose it is (hover to see whose without picking), and the patches shrink as players join. Your own characters may share one, and a new one starts in your colour. Arrow keys step the handle (Shift for five). If someone took the colour a moment before you, the table moves yours to the nearest free one and says so. The DM's colour has no patches and blocks no one.",
};

export const RECOLOR_ENTRY: HelpEntry = {
  term: "Recolor",
  detail:
    "Double-click (on a phone, double-tap) your own token for a random colour no other player is using (the DM's own tokens get any colour that reads on a dark map), or pick one with ⚙️ → Colour.",
};

export const TOKEN_SIZE_ENTRY: HelpEntry = {
  term: "Token size",
  detail:
    "⚙️ → Token settings → Tiny through Gargantuan (half a cell up to three cells). A DM can resize anyone's.",
};

export const SECOND_CHARACTER_ENTRY: HelpEntry = {
  term: "A second character",
  detail: "⚙️ → ➕ ADD CHARACTER gives you another row, card, token, HP and initiative.",
};
