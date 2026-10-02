/**
 * CollapsibleSection Component
 *
 * A reusable UI primitive for showing/hiding content with smooth transitions.
 * Uses CSS transitions for maxHeight and opacity to create collapse/expand animation.
 *
 * Extracted from: apps/client/src/features/dm/components/DMMenu.tsx:14-32
 * Extraction date: 2025-10-21
 *
 * @example
 * ```tsx
 * <CollapsibleSection isCollapsed={isMapSectionCollapsed}>
 *   <div>Content that can be collapsed</div>
 * </CollapsibleSection>
 * ```
 *
 * @module components/ui/CollapsibleSection
 */

import React, { ReactNode } from "react";

/**
 * Props for CollapsibleSection component
 */
export interface CollapsibleSectionProps {
  /**
   * Controls visibility of the content
   * - true: Content is collapsed (maxHeight: 0, opacity: 0)
   * - false: Content is visible (maxHeight: 2000px, opacity: 1)
   */
  isCollapsed: boolean;

  /**
   * Content to be shown/hidden
   */
  children: ReactNode;
}

/**
 * CollapsibleSection renders a container that smoothly collapses/expands its content.
 *
 * Transition timing: 150ms ease-in-out for both maxHeight and opacity
 * Max expanded height: 2000px (sufficient for all current use cases)
 *
 * @param props - Component props
 * @returns Collapsible container element
 */
export const CollapsibleSection = React.memo(
  ({ isCollapsed, children }: CollapsibleSectionProps) => {
    return (
      // Collapsed content must leave the Tab order and the accessibility tree, not only the
      // eye: with maxHeight 0 alone its fields and buttons stayed focusable, so a keyboard user
      // could change a LOCKED grid or press an invisible Clear Zone. `visibility` transitions
      // too: it stays visible for the 150ms fade on the way out and shows at once on the way in.
      <div
        aria-hidden={isCollapsed || undefined}
        style={{
          maxHeight: isCollapsed ? "0" : "2000px",
          opacity: isCollapsed ? 0 : 1,
          visibility: isCollapsed ? "hidden" : "visible",
          overflow: "hidden",
          transition:
            "max-height 150ms ease-in-out, opacity 150ms ease-in-out, visibility 150ms ease-in-out",
        }}
      >
        {children}
      </div>
    );
  },
);

CollapsibleSection.displayName = "CollapsibleSection";
