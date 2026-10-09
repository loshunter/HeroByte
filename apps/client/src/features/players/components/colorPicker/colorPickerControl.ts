// ============================================================================
// COLOUR PICKER CONTROL — what a card hands its settings window
// ============================================================================
// The cheap, eager half of the picker: the cards build a control from the
// snapshot on every render, and the server's color-adjusted toast needs its
// words, but neither needs the colour maths. Those load with the picker itself,
// a lazy chunk (LazyColorPicker), so the entry bundle carries none of them.

import type { ColorHolder, Player, SnapshotCharacter, Token } from "@herobyte/shared";

/** Everything the settings window needs to show one character's picker. */
export interface ColorPickerControl {
  /** The character's token colour now. */
  color: string;
  /** Every PC colour at the table. */
  holders: ColorHolder[];
  dmUids: readonly string[];
  /** Whose character this is (their own other characters never block it). */
  ownerUid: string;
  characterId: string;
  name: string;
  /** The viewer is the DM: no zones and no bump (the DM is exempt). */
  exempt: boolean;
  onCommit: (hex: string) => void;
}

/** The picker for a character's token, or undefined when there is nothing to colour. */
export function buildColorPickerControl(args: {
  characters: readonly SnapshotCharacter[];
  players: readonly Player[];
  token: Token | null | undefined;
  characterId: string;
  ownerUid: string;
  name: string;
  viewerIsDM: boolean;
  onTokenColorChange?: (tokenId: string, color: string) => void;
}): ColorPickerControl | undefined {
  const { token, onTokenColorChange } = args;
  if (!token || !onTokenColorChange) return undefined;
  const holders: ColorHolder[] = [];
  for (const character of args.characters) {
    if (character.type !== "pc" || !character.color || !character.ownedByPlayerUID) continue;
    holders.push({
      ownerUid: character.ownedByPlayerUID,
      color: character.color,
      name: character.name,
      characterId: character.id,
    });
  }
  return {
    color: token.color,
    holders,
    dmUids: args.players.filter((player) => player.isDM).map((player) => player.uid),
    ownerUid: args.ownerUid,
    characterId: args.characterId,
    name: args.name,
    exempt: args.viewerIsDM,
    onCommit: (hex) => onTokenColorChange(token.id, hex),
  };
}

/**
 * The phone's party list: one picker per row the viewer may edit (their own
 * characters, or any for the DM), from the list's own props.
 */
export function colorPickerForRows(list: {
  characters: readonly SnapshotCharacter[];
  players: readonly Player[];
  uid: string;
  isDM: boolean;
  onTokenColorChange?: (tokenId: string, color: string) => void;
}) {
  return (
    row: { uid: string; characterId: string; name: string; hasCharacter?: boolean },
    token: Token | undefined,
  ): ColorPickerControl | undefined =>
    row.hasCharacter === false
      ? undefined
      : buildColorPickerControl({
          characters: list.characters,
          players: list.players,
          token,
          characterId: row.characterId,
          ownerUid: row.uid,
          name: row.name,
          viewerIsDM: list.isDM,
          onTokenColorChange:
            row.uid === list.uid || list.isDM ? list.onTokenColorChange : undefined,
        });
}

/** The toast for the server's `color-adjusted`: where the colour went, and why. */
export function colorAdjustedMessage(near?: string): string {
  return near
    ? `Moved to the nearest free colour: too close to ${near}'s.`
    : "That colour could not be used, so you got the nearest free one.";
}
