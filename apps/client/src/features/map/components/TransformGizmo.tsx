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

  useEffect(() => {
    const transformer = transformerRef.current;
    const node = getNodeRef();

    if (!transformer) return;

    if (selectedObject && !selectedObject.locked && node) {
      // Attach transformer to the selected node
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    } else {
      // Detach transformer
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedObject, getNodeRef]);

  const handleTransformEnd = () => {
    if (!selectedObject) return;
    const node = getNodeRef();
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    const x = node.x();
    const y = node.y();

    onTransform({
      id: selectedObject.id,
      position: { x, y },
      scale: { x: scaleX, y: scaleY },
      rotation,
    });

    // Reset node transform to match scene object
    node.scaleX(1);
    node.scaleY(1);
    node.rotation(0);
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
      boundBoxFunc={(oldBox, newBox) => {
        // Prevent scaling to zero or negative
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox;
        }
        return newBox;
      }}
      onTransformEnd={handleTransformEnd}
    />
  );
}
