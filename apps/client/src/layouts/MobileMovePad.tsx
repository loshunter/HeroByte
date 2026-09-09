/**
 * The phone's stand-in for WASD: a 3×3 d-pad that moves the selection one
 * grid cell per tap, over the same `move` the desktop keys call. Lives inside
 * the selection sheet, so it exists exactly when something movable is
 * selected and never costs a dock slot (the dock is pinned at five).
 */

import type { CellDelta } from "../features/movement/keyboardMovement";
import type { MovementControls } from "../features/movement/useKeyboardMovement";

interface MobileMovePadProps {
  movement: MovementControls;
}

// Reading order is screen order: top row is "up". Diagonals ride along so a
// phone can take the same one-press diagonal step a keyboard can.
const PAD: ReadonlyArray<{ label: string; name: string; delta: CellDelta }> = [
  { label: "↖", name: "Move up-left", delta: { dx: -1, dy: -1 } },
  { label: "↑", name: "Move up", delta: { dx: 0, dy: -1 } },
  { label: "↗", name: "Move up-right", delta: { dx: 1, dy: -1 } },
  { label: "←", name: "Move left", delta: { dx: -1, dy: 0 } },
  { label: "·", name: "", delta: { dx: 0, dy: 0 } },
  { label: "→", name: "Move right", delta: { dx: 1, dy: 0 } },
  { label: "↙", name: "Move down-left", delta: { dx: -1, dy: 1 } },
  { label: "↓", name: "Move down", delta: { dx: 0, dy: 1 } },
  { label: "↘", name: "Move down-right", delta: { dx: 1, dy: 1 } },
];

export function MobileMovePad({ movement }: MobileMovePadProps): JSX.Element {
  return (
    <div className="mobile-move-pad" role="group" aria-label="Move selection">
      {PAD.map((cell) =>
        cell.name ? (
          <button
            key={cell.name}
            type="button"
            className="mobile-chip mobile-move-pad__button"
            aria-label={cell.name}
            onClick={() => movement.move(cell.delta)}
          >
            {cell.label}
          </button>
        ) : (
          <span key="centre" className="mobile-move-pad__centre" aria-hidden="true">
            {cell.label}
          </span>
        ),
      )}
    </div>
  );
}
