import React, { useRef } from "react";
import { useSelectionBarLeft } from "./useSelectionBarLeft";

/**
 * MultiSelectToolbar Component
 *
 * A floating toolbar that appears when multiple objects are selected on the map board.
 * Provides quick actions for locking and unlocking selected objects.
 * Only visible to DM users when one or more objects are selected.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 1482-1558)
 * Extraction date: 2025-10-20
 *
 * @module components/layout/MultiSelectToolbar
 */

/**
 * Props for the MultiSelectToolbar component
 */
export interface MultiSelectToolbarProps {
  /**
   * Array of selected object IDs
   * @example ["obj-123", "obj-456", "obj-789"]
   */
  selectedObjectIds: string[];

  /**
   * Whether the current user is a Dungeon Master
   * Only DMs can see and use the multi-select toolbar
   */
  isDM: boolean;

  /**
   * Height of the top panel in pixels
   * Used to position the toolbar below the top panel with a 20px offset
   * @example 60
   */
  topHeight: number;

  /**
   * Callback to lock all selected objects
   * Called when the lock button is clicked
   */
  onLock: () => void;

  /**
   * Callback to unlock all selected objects
   * Called when the unlock button is clicked
   */
  onUnlock: () => void;
}

/**
 * MultiSelectToolbar Component
 *
 * Displays a floating toolbar with object count and lock/unlock actions
 * when multiple objects are selected. The toolbar is positioned dynamically
 * based on the top panel height and is only visible to DM users.
 *
 * @example
 * ```tsx
 * <MultiSelectToolbar
 *   selectedObjectIds={["obj1", "obj2", "obj3"]}
 *   isDM={true}
 *   topHeight={60}
 *   onLock={handleLockSelected}
 *   onUnlock={handleUnlockSelected}
 * />
 * ```
 *
 * @param props - Component props
 * @returns The multi-select toolbar JSX element, or null if not visible
 */
export function MultiSelectToolbar({
  selectedObjectIds,
  isDM,
  topHeight,
  onLock,
  onUnlock,
}: MultiSelectToolbarProps): JSX.Element | null {
  const visible = isDM && selectedObjectIds.length > 0;
  const barRef = useRef<HTMLDivElement>(null);
  const placement = useSelectionBarLeft(barRef, visible);
  // Only show toolbar when user is DM and has objects selected
  if (!visible) {
    return null;
  }

  return (
    <div
      ref={barRef}
      data-testid="selection-bar"
      style={{
        position: "fixed",
        top: `${topHeight + 20}px`,
        // Centred, or stepped aside from a window over its strip (selectionBarPlacement.ts),
        // wrapped to two rows when only a narrower gap is free.
        left: placement === null ? "50%" : `${placement.left}px`,
        transform: placement === null ? "translateX(-50%)" : "none",
        // Not raised above the floating windows: the windows that open under the header
        // (NPC settings, ROLL RESULT, the dice roller) put their ✕ where this bar sits,
        // and a bar over them turned a close into a lock or an unlock (3fd6c945).
        zIndex: 1000,
        // Its own width, wherever it sits: centred at left 50% it was laid out in half the
        // viewport and wrapped, and once moved aside it unwrapped and grew, so at 922 px
        // it flipped between the two placements every frame and Unlock never held still.
        width: "max-content",
        maxWidth: placement?.maxWidth ? `${placement.maxWidth}px` : undefined,
        whiteSpace: placement?.maxWidth ? "normal" : "nowrap",
        flexWrap: placement?.maxWidth ? "wrap" : "nowrap",
        display: "flex",
        gap: "8px",
        padding: "8px 16px",
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
      }}
    >
      <div
        style={{
          color: "#cbd5e1",
          fontSize: "0.9rem",
          fontWeight: 500,
          marginRight: "12px",
          lineHeight: "32px",
        }}
      >
        {selectedObjectIds.length} selected
      </div>
      <button
        onClick={onLock}
        style={{
          padding: "6px 16px",
          backgroundColor: "#374151",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          borderRadius: "6px",
          color: "#f3f4f6",
          fontSize: "0.9rem",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#4b5563";
          e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#374151";
          e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
        }}
      >
        🔒 Lock
      </button>
      <button
        onClick={onUnlock}
        style={{
          padding: "6px 16px",
          backgroundColor: "#374151",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          borderRadius: "6px",
          color: "#f3f4f6",
          fontSize: "0.9rem",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#4b5563";
          e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#374151";
          e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
        }}
      >
        🔓 Unlock
      </button>
    </div>
  );
}
