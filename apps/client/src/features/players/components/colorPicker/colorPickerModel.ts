// ============================================================================
// COLOUR PICKER MODEL — what the picker shows and where its handle may go
// ============================================================================
// Pure: the zones, suggestions and bump-at-the-edge come from the SAME shared
// rule the server enforces (colorRule.ts), fed the same inputs — every PC's
// colour, which rides its character record on the wire so fog cannot hide a
// zone (SnapshotCharacter.color). The picker only helps; the server decides.

import {
  cellIndexAt,
  colorRuleInputs,
  nearestFreeCell,
  normalizeColor,
  suggestedColors,
  windowCells,
  windowPointOf,
  zoneMap,
  COLOR_WINDOW,
  type BlockingColor,
  type ColorHolder,
  type Player,
  type SnapshotCharacter,
  type Token,
  type WindowCell,
  type WindowPoint,
} from "@herobyte/shared";

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

export interface PickerField {
  /** Other players' colours, each holding a zone. */
  others: BlockingColor[];
  /** Per window cell: the index in `others` whose zone covers it, or -1. */
  zones: Int16Array;
  /** This player's other characters: shown as dots, blocking nothing. */
  ownDots: ColorHolder[];
  /** The most open spots, spread apart (none for the DM). */
  suggestions: WindowCell[];
}

const FREE_EVERYWHERE = (): Int16Array => new Int16Array(windowCells().length).fill(-1);

export function pickerField(control: ColorPickerControl): PickerField {
  if (control.exempt) {
    return { others: [], zones: FREE_EVERYWHERE(), ownDots: [], suggestions: [] };
  }
  const { others, radius } = colorRuleInputs(
    control.holders,
    (uid) => control.dmUids.includes(uid),
    control.ownerUid,
  );
  return {
    others,
    zones: zoneMap(others, radius),
    ownDots: control.holders.filter(
      (holder) =>
        holder.ownerUid === control.ownerUid && holder.characterId !== control.characterId,
    ),
    suggestions: suggestedColors(others),
  };
}

/** A key that changes only when the field would (holders arrive as new arrays). */
export function pickerFieldKey(control: ColorPickerControl): string {
  const holders = control.holders
    .map((holder) => `${holder.ownerUid}:${holder.characterId}:${holder.color}`)
    .join("|");
  return [
    control.exempt,
    control.ownerUid,
    control.characterId,
    control.dmUids.join(","),
    holders,
  ].join("/");
}

/** Where on the window a pointer is, clamped to its edges. */
export function pointAt(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): WindowPoint {
  const clamp = (value: number) => Math.min(0.9999, Math.max(0, value));
  return {
    u: rect.width > 0 ? clamp((clientX - rect.left) / rect.width) : 0,
    v: rect.height > 0 ? clamp((clientY - rect.top) / rect.height) : 0,
  };
}

/**
 * Where the handle goes for a point: the point's own cell when it is free (or
 * the viewer is exempt), else the nearest free cell — the bump at a zone's
 * edge — with the name of the character whose zone stopped it.
 */
export function placeHandle(
  point: WindowPoint,
  field: PickerField,
  exempt: boolean,
): { cell: WindowCell; blockedBy?: string } {
  const index = cellIndexAt(point);
  const own = windowCells()[index]!;
  const owner = field.zones[index] ?? -1;
  if (exempt || owner === -1) return { cell: own };
  const free = nearestFreeCell(point, field.zones);
  return { cell: free ?? own, blockedBy: field.others[owner]?.name };
}

/** One keyboard step from a cell: hue wraps, lightness stops at the edges. */
export function stepPoint(cell: WindowCell, columns: number, rows: number): WindowPoint {
  const column = (cell.column + columns + COLOR_WINDOW.columns) % COLOR_WINDOW.columns;
  const row = Math.min(COLOR_WINDOW.rows - 1, Math.max(0, cell.row + rows));
  return { u: (column + 0.5) / COLOR_WINDOW.columns, v: (row + 0.5) / COLOR_WINDOW.rows };
}

/**
 * The window cell a stored colour sits in (legacy colours land at their nearest
 * spot). A colour picked FROM the window is its cell's own hex, but rounding to
 * #rrggbb can put it a hair into the next cell, so the neighbours are checked
 * for an exact match first: the handle must not creep a cell on every reload.
 */
export function cellOf(color: string): WindowCell | null {
  const point = windowPointOf(color);
  if (!point) return null;
  const cells = windowCells();
  const own = cells[cellIndexAt(point)]!;
  const hex = normalizeColor(color);
  const { columns, rows } = COLOR_WINDOW;
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dColumn = -1; dColumn <= 1; dColumn += 1) {
      const row = own.row + dRow;
      if (row < 0 || row >= rows) continue;
      const cell = cells[row * columns + ((own.column + dColumn + columns) % columns)]!;
      if (cell.hex === hex) return cell;
    }
  }
  return own;
}

/** The colour as stored, for comparing a pending pick against it. */
export function sameColor(first: string, second: string): boolean {
  return (normalizeColor(first) ?? first) === (normalizeColor(second) ?? second);
}

/** The toast for the server's `color-adjusted`: where the colour went, and why. */
export function colorAdjustedMessage(near?: string): string {
  return near
    ? `Moved to the nearest free colour: too close to ${near}'s.`
    : "That colour could not be used, so you got the nearest free one.";
}
