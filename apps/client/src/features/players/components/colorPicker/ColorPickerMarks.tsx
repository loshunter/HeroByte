// The colour window's marks: each other player's colour (its zone is drawn on the
// canvas) and this player's other characters, which hold no zone.

import { windowPointOf } from "@herobyte/shared";
import type { PickerField } from "./colorPickerModel";

/** Where a window point sits inside the window, as CSS. */
export const at = (point: { u: number; v: number }) => ({
  left: `${point.u * 100}%`,
  top: `${point.v * 100}%`,
});

export function ColorPickerMarks({ field }: { field: PickerField }): JSX.Element {
  return (
    <>
      {field.others.map((other) => {
        const point = windowPointOf(other.color);
        const label = `${other.name ?? "Another player"}'s colour`;
        return point ? (
          <span
            key={other.characterId ?? other.color}
            role="img"
            aria-label={label}
            className="color-picker__taken"
            style={{ ...at(point), background: other.color }}
            title={label}
          />
        ) : null;
      })}
      {field.ownDots.map((dot) => {
        const point = windowPointOf(dot.color);
        const name = dot.name ?? "Your other character";
        return point ? (
          <span
            key={dot.characterId ?? dot.color}
            role="img"
            aria-label={`${name}'s colour (yours)`}
            className="color-picker__own"
            style={{ ...at(point), background: dot.color }}
            title={`${name} (yours)`}
          />
        ) : null;
      })}
    </>
  );
}
