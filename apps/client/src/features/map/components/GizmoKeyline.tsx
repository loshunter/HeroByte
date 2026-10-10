// ============================================================================
// GIZMO KEYLINE — a solid edge under the transform gizmo's border (C3)
// ============================================================================
// Konva's Transformer draws its border and the rotate handle's line as one
// single-colour stroke. In a viewer's colour that stroke alone vanishes where the
// map shares its tone, and on the map itself it is the only outline. So a second,
// border-only Transformer on the same node draws a solid keyline under the gizmo's
// dashed colour border: the border reads on any map. It shows no handles and
// takes no input; it measures the box exactly as the gizmo does (same padding and
// rotate offset), and Konva keeps both in step as the node moves.

import { forwardRef } from "react";
import { Transformer } from "react-konva";
import type Konva from "konva";

/** The gizmo's padding in a viewer's colour: its border sits just outside a selected piece's ring. */
export const GIZMO_PADDING = 2;

export const GizmoKeyline = forwardRef<Konva.Transformer, { keyline: string }>(
  function GizmoKeyline({ keyline }, ref) {
    return (
      <Transformer
        ref={ref}
        listening={false}
        resizeEnabled={false}
        rotateEnabled={true}
        anchorSize={0}
        anchorStrokeWidth={0}
        rotateAnchorOffset={30}
        padding={GIZMO_PADDING}
        borderStroke={keyline}
        borderStrokeWidth={4}
        keepRatio={false}
      />
    );
  },
);
