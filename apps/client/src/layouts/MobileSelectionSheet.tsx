/**
 * The mobile sheet for acting on a current selection.
 *
 * Extracted from MobileLayout, which had reached its 350-LOC budget. Mirrors
 * MobileDrawingControls: presentation only, every handler supplied.
 */

interface MobileSelectionSheetProps {
  selectedCount: number;
  transformMode: boolean;
  isDM: boolean;
  onTransform: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onClear: () => void;
}

export function MobileSelectionSheet({
  selectedCount,
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
