/**
 * ContextMenu
 *
 * A fixed-position context menu overlay for token actions.
 *
 * NOTE: This is an INCOMPLETE feature - there are currently no right-click
 * handlers in the codebase to trigger this menu. This component extracts
 * the rendering logic from App.tsx for future completion.
 *
 * UPDATE (Phase 10 - 2025-01-11): Added confirmation dialog before token deletion
 * to match the behavior of keyboard shortcuts (Delete/Backspace keys).
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 1411-1439)
 * Extraction date: 2025-10-20
 *
 * @module components/ui/ContextMenu
 */

import React from "react";

/**
 * Props for ContextMenu component
 */
export interface ContextMenuProps {
  /**
   * Menu state containing position and target token
   * - null: menu is hidden
   * - object: menu is visible at specified position
   */
  menu: { x: number; y: number; tokenId: string } | null;

  /**
   * Handler called when delete action is triggered
   * @param tokenId - ID of the token to delete
   */
  onDelete: (tokenId: string) => void;

  /**
   * Handler called when menu should be closed
   */
  onClose: () => void;
}

/**
 * ContextMenu component
 *
 * Renders a fixed-position context menu with token actions.
 * Currently only supports deletion, but designed to be extended
 * with additional actions in the future.
 *
 * @example
 * ```tsx
 * <ContextMenu
 *   menu={contextMenu}
 *   onDelete={(tokenId) => deleteToken(tokenId)}
 *   onClose={() => setContextMenu(null)}
 * />
 * ```
 */
export function ContextMenu({ menu, onDelete, onClose }: ContextMenuProps): JSX.Element | null {
  if (!menu) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: menu.x,
        top: menu.y,
        background: "#222",
        border: "2px solid #555",
        padding: "4px",
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="btn btn-danger"
        style={{
          display: "block",
          width: "100%",
        }}
        onClick={() => {
          // Show confirmation dialog before deleting
          // This matches the behavior of keyboard shortcuts (Delete/Backspace)
          if (confirm("Delete this token? This cannot be undone.")) {
            onDelete(menu.tokenId);
            onClose();
          }
        }}
      >
        Delete Token
      </button>
    </div>
  );
}
