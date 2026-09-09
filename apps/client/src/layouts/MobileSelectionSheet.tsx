/**
 * The mobile sheet for acting on a current selection.
 *
 * Extracted from MobileLayout, which had reached its 350-LOC budget. Mirrors
 * MobileDrawingControls: presentation only, every handler supplied.
 */

import type { MovementControls } from "../features/movement/useKeyboardMovement";
import { MobileMovePad } from "./MobileMovePad";

interface MobileSelectionSheetProps {
  selectedCount: number;
  /** The d-pad renders only when the actor may move something selected. */
  movement?: MovementControls;
  transformMode: boolean;
  isDM: boolean;
  onTransform: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onClear: () => void;
}

export function MobileSelectionSheet({
  selectedCount,
  movement,
  transformMode,
  isDM,
  onTransform,
  onLock,
  onUnlock,
  onClear,
}: MobileSelectionSheetProps): JSX.Element {
  return (
    <div className="mobile-selection-sheet" role="region" aria-label="Selected object actions">
      <strong>{selectedCount} selected</strong>
      {movement && movement.movableCount > 0 && <MobileMovePad movement={movement} />}
      <button
        type="button"
        className={transformMode ? "mobile-chip mobile-chip--active" : "mobile-chip"}
        onClick={onTransform}
      >
        Transform
      </button>
      {isDM && (
        <>
          <button type="button" className="mobile-chip" onClick={onLock}>
            Lock
          </button>
          <button type="button" className="mobile-chip" onClick={onUnlock}>
            Unlock
          </button>
        </>
      )}
      <button type="button" className="mobile-chip" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
