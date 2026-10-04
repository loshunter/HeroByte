// What the NPC card's two icon buttons tell a screen reader or a voice command. The glyphs alone
// read "eye" and "gear": the name says the action and whose NPC it is, and the hover title (a
// description, kept as it was) says the state.
import type { Character } from "@herobyte/shared";

type Named = Pick<Character, "name" | "visibleToPlayers">;

export const npcVisibilityProps = ({ name, visibleToPlayers }: Named) =>
  visibleToPlayers === false
    ? { "aria-label": `Show ${name} to players`, title: "Hidden from players (click to show)" }
    : { "aria-label": `Hide ${name} from players`, title: "Visible to players (click to hide)" };

export const npcSettingsProps = ({ name }: Named) => ({
  "aria-label": `NPC settings: ${name}`,
  title: "NPC settings",
});
