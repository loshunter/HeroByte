import React from "react";

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
  // Only show toolbar when user is DM and has objects selected
  if (!isDM || selectedObjectIds.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: `${topHeight + 20}px`,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
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
