// Help entries for a character's own settings: its colour (C1), token size, a second character.
// They live in their own file so helpTopics.ts stays under the 350-line guard, like
// phoneHelpEntries.ts.
import type { HelpEntry } from "./helpTopics";

export const COLOUR_ENTRY: HelpEntry = {
  term: "Colour",
  detail:
    "⚙️ → Colour (phone: ◉ PARTY → ⚙️ EDIT): drag the handle and let go, or tap a dashed ring for a free colour in one go. No two players share a colour: darkened patches are other players' colours, and the handle stops at their edge (the patches shrink as players join). Your own characters may share one. Arrow keys step the handle (Shift for five). If someone took the colour a moment before you, the table moves yours to the nearest free one and says so. The DM's colour is free of patches and blocks no one.",
};

export const RECOLOR_ENTRY: HelpEntry = {
  term: "Recolor",
  detail:
    "Double-click your own token for a random colour no other player is using, or pick one with ⚙️ → Colour.",
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
