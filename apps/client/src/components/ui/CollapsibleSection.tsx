// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================
// Simple collapsible container with smooth height/opacity transitions.
// Used for showing/hiding content based on a boolean state.

import { ReactNode } from "react";

export interface CollapsibleSectionProps {
  isCollapsed: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ isCollapsed, children }: CollapsibleSectionProps) {
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
}
