// ============================================================================
// MAP IMAGE LAYER COMPONENT
// ============================================================================
// Renders the background map image with support for scene object transforms

import { useEffect, useRef } from "react";
import { Group, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import type { Camera } from "../types";
import type { SceneObjectTransform } from "@shared";

interface MapImageLayerProps {
  cam: Camera;
  src: string | null;
  transform?: SceneObjectTransform; // Map transform from scene object
  onNodeReady?: (node: Konva.Group | null) => void; // Callback to expose the transform group ref
  onClick?: () => void; // Click handler for selection
}

/**
 * MapImageLayer: Renders the background map image
 *
 * Applies two levels of transform:
 * 1. Camera transform (pan/zoom) - affects all world objects
 * 2. Map object transform (position/scale/rotation) - specific to this map
 *
 * Note: Uses nested Groups to ensure transforms apply in correct order:
 * - Outer Group: Camera transform (pan/zoom)
 * - Inner Group: Map object transform (position/scale/rotation)
 */
export function MapImageLayer({ cam, src, transform, onNodeReady, onClick }: MapImageLayerProps) {
  const [img] = useImage(src || "");
  const transformGroupRef = useRef<Konva.Group>(null);

  // Expose the transform group ref to parent
  useEffect(() => {
    if (onNodeReady) {
      onNodeReady(transformGroupRef.current);
    }
  }, [onNodeReady]);

  if (!img) return null;

  // Default transform values if not provided
  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = transform || {};

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {/* Map transform group - applies position, scale, and rotation */}
      <Group
        ref={transformGroupRef}
        x={x}
        y={y}
        scaleX={scaleX}
        scaleY={scaleY}
        rotation={rotation}
        onClick={onClick}
        onTap={onClick}
        listening={!!onClick}
      >
        <KonvaImage image={img} x={0} y={0} listening={!!onClick} />
      </Group>
    </Group>
  );
}
