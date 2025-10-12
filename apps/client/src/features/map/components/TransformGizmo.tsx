// ============================================================================
// TRANSFORM GIZMO COMPONENT
// ============================================================================
// Provides visual handles for rotating and scaling scene objects using Konva Transformer.
// Respects the `locked` flag on scene objects.

import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import type Konva from "konva";
import type { SceneObject } from "@shared";

interface TransformGizmoProps {
  selectedObject: SceneObject | null;
  onTransform: (updates: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  getNodeRef: () => Konva.Node | null; // Function to get the Konva node to attach to
}

/**
 * TransformGizmo: Visual transform handles for scene objects
 *
 * Features:
 * - Rotation handles
 * - Scale handles
 * - Respects locked state (disables when locked)
 * - Attaches to the currently selected scene object
 */
export function TransformGizmo({
  selectedObject,
  onTransform,
  getNodeRef,
}: TransformGizmoProps): JSX.Element | null {
  const transformerRef = useRef<Konva.Transformer>(null);
  const isCtrlPressed = useRef<boolean>(false);

  // Track Ctrl key state for rotation snap override
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        isCtrlPressed.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        isCtrlPressed.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const node = getNodeRef();

    if (!transformer) return;

    // Always detach first to prevent stale references
    transformer.nodes([]);

    if (selectedObject && !selectedObject.locked && node) {
      // Attach transformer to the selected node
      // Don't reset the node - it should keep its current transform from React props
      try {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
      } catch (error) {
        // If node attachment fails (e.g., node was destroyed), detach
        console.warn("[TransformGizmo] Failed to attach node:", error);
        transformer.nodes([]);
      }
    } else {
      // Ensure detached state is rendered
      transformer.getLayer()?.batchDraw();
    }

    // Cleanup: detach on unmount or when dependencies change
    return () => {
      if (transformer) {
        transformer.nodes([]);
      }
    };
  }, [selectedObject, getNodeRef]);

  const handleTransform = () => {
    if (!selectedObject) return;
    const node = getNodeRef();
    const transformer = transformerRef.current;
    if (!node || !transformer) return;

    try {
      // Override rotation snapping when Ctrl is pressed
      if (isCtrlPressed.current) {
        // Disable snapping by setting rotationSnaps to empty array
        transformer.rotationSnaps([]);
      } else {
        // Re-enable 45° snap increments
        transformer.rotationSnaps([0, 45, 90, 135, 180, 225, 270, 315]);
      }
    } catch (error) {
      // Ignore errors during transform (node might be destroyed)
      console.warn("[TransformGizmo] Transform error:", error);
    }
  };

  const handleTransformEnd = () => {
    if (!selectedObject) return;
    const node = getNodeRef();
    if (!node) return;

    try {
      // The node's current transform values ARE the final values
      // (no longer working with deltas since we don't reset the node)
      const finalScaleX = node.scaleX();
      const finalScaleY = node.scaleY();
      let finalRotation = node.rotation();
      const finalX = node.x();
      const finalY = node.y();

      // Normalize rotation to 0-360 range
      finalRotation = finalRotation % 360;
      if (finalRotation < 0) {
        finalRotation += 360;
      }

      onTransform({
        id: selectedObject.id,
        position: { x: finalX, y: finalY },
        scale: { x: finalScaleX, y: finalScaleY },
        rotation: finalRotation,
      });
    } catch (error) {
      // Ignore errors (node might have been destroyed during drag)
      console.warn("[TransformGizmo] Transform end error:", error);
    }
  };

  // Don't render if no object is selected or if locked
  if (!selectedObject || selectedObject.locked) {
    return null;
  }

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled={true}
      enabledAnchors={[
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "top-center",
        "bottom-center",
        "middle-left",
        "middle-right",
      ]}
      // Visual styling
      borderStroke="#447DF7" // JRPG blue color
      borderStrokeWidth={2}
      borderDash={[5, 5]} // Dashed border
      anchorFill="#447DF7"
      anchorStroke="#FFFFFF"
      anchorStrokeWidth={2}
      anchorSize={10}
      anchorCornerRadius={2}
      // Rotation handle styling
      rotateAnchorOffset={30}
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]} // Snap to 45° increments (hold Ctrl to disable)
      rotationSnapTolerance={10} // Degrees tolerance for snapping
      // Interaction
      keepRatio={false} // Allow independent X/Y scaling by default
      // Shift key inverts the keepRatio behavior (hold Shift to maintain aspect ratio)
      // Note: Konva automatically handles Shift key, no additional config needed
      boundBoxFunc={(oldBox, newBox) => {
        // Prevent scaling to zero or negative
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox;
        }
        // Max scale limit (10x)
        if (newBox.width > oldBox.width * 10 || newBox.height > oldBox.height * 10) {
          return oldBox;
        }
        return newBox;
      }}
      onTransform={handleTransform}
      onTransformEnd={handleTransformEnd}
      // Cursor feedback (Konva provides default cursors for transform handles)
      // - Resize handles: nwse-resize, nesw-resize, ew-resize, ns-resize
      // - Rotation handle: crosshair
    />
  );
}
