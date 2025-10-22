import React from "react";
import { JRPGPanel } from "./JRPGPanel";

/**
 * EmptyState - Reusable empty state message display with JRPG styling
 *
 * A simple component that displays a message when a list or collection is empty.
 * Used throughout the application to provide consistent empty state messaging
 * (e.g., "No NPCs yet", "No props yet", etc.).
 *
 * @example
 * ```tsx
 * // Simple text message
 * <EmptyState message="No NPCs yet. Use "Add NPC" to create one." />
 *
 * // Message with HTML entities
 * <EmptyState message="No props yet. Use &ldquo;Add Prop&rdquo; to create one." />
 *
 * // Complex JSX message
 * <EmptyState message={<span>No items. <strong>Get started</strong> now!</span>} />
 * ```
 *
 * ## Styling
 * - Wraps content in JRPGPanel with variant="simple"
 * - White text color (var(--jrpg-white))
 * - Small font size (12px)
 * - Consistent with JRPG theme
 *
 * ## Props
 * @prop {string | React.ReactNode} message - The message to display. Can be a simple string
 *                                             or a ReactNode for more complex content.
 *
 * ## Extracted From
 * - DMMenu.tsx NPCs tab empty state (lines 1216-1221)
 * - DMMenu.tsx Props tab empty state (lines 1260-1265)
 *
 * ## Performance
 * - Uses React.memo to prevent unnecessary re-renders
 * - Optimized for lists that frequently toggle between empty and populated states
 */

interface EmptyStateProps {
  /** The message to display when the state is empty */
  message: string | React.ReactNode;
}

export const EmptyState = React.memo(({ message }: EmptyStateProps) => {
  return (
    <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
      {message}
    </JRPGPanel>
  );
});

EmptyState.displayName = "EmptyState";
