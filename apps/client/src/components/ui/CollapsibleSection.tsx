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
      <div
        style={{
          maxHeight: isCollapsed ? "0" : "2000px",
          opacity: isCollapsed ? 0 : 1,
          overflow: "hidden",
          transition: "max-height 150ms ease-in-out, opacity 150ms ease-in-out",
        }}
      >
        {children}
      </div>
    );
  },
);

CollapsibleSection.displayName = "CollapsibleSection";
