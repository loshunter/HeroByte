// ============================================================================
// CHARACTER FILE (Save character / Load character)
// ============================================================================
// One character's file — name, HP, portrait, token, conditions, drawings and
// initiative modifier — as the desktop card's settings window and the phone's
// settings sheet both save it (U9 gave the phone the same two buttons).
// `saveCharacterFile` is the ONE place a save is WRITTEN, and every file is READ by
// the same parser (`loadPlayerState`; the desktop card calls it directly, the
// phone's row through `characterFileActions`), so a file means the same thing
// whichever surface made it. What goes INTO a save is each surface's to hand over:
// the desktop card is given its drawings, token scene and initiative modifier by
// its parents, and the phone's row assembles them from the table's collections
// (MobileEntitiesList) — each pinned by that surface's own tests.
//
// It is one character — and, because drawings belong to the seat and not the
// character, the row owner's drawings when they have any (a file saved with none
// carries none, and loading it touches nobody's drawings); a load of a file that
// holds drawings onto the loader's OWN card replaces theirs (`sync-player-drawings`),
// a load onto someone else's (a DM's) leaves them. It is never the table: a table backup is the DM's (Table → Backups), a
// map is Maps → Export editable map, and each picker says so when it is handed
// the wrong kind of file (utils/backupFormat).

import type { Drawing, Player, PlayerState, SceneObject, Token } from "@herobyte/shared";
import { loadPlayerState, savePlayerState } from "../../utils/playerPersistence";

export interface CharacterFileSource {
  player: Player;
  /**
   * THIS character's conditions. The seat's own list is legacy and, with two
   * characters, holds whichever one was edited last; loading writes the file's
   * list onto the character.
   */
  statusEffects: string[];
  token?: Token;
  /** The image the window shows for the token (its buffer, else the token's own), if any. */
  tokenImage?: string;
  tokenScene?: (SceneObject & { type: "token" }) | null;
  drawings?: Drawing[];
  initiativeModifier?: number;
}

export function saveCharacterFile({
  player,
  statusEffects,
  token,
  tokenImage,
  tokenScene,
  drawings,
  initiativeModifier,
}: CharacterFileSource): void {
  const tokenForExport: Token | undefined = token
    ? { ...token, imageUrl: tokenImage ?? token.imageUrl ?? undefined }
    : undefined;
  savePlayerState({
    player: { ...player, statusEffects },
    token: tokenForExport,
    tokenScene: tokenScene ?? null,
    drawings: drawings ?? [],
    initiativeModifier,
  });
}

/** The two actions a settings window offers, bound to one character. */
export interface CharacterFileActions {
  save: () => void;
  /** Reads the file, applies it to the character, and returns it so the window can refresh its fields. */
  load: (file: File) => Promise<PlayerState>;
}

export function characterFileActions(
  source: CharacterFileSource,
  apply: (state: PlayerState) => void,
): CharacterFileActions {
  return {
    save: () => saveCharacterFile(source),
    load: async (file) => {
      const state = await loadPlayerState(file);
      apply(state);
      return state;
    },
  };
}
