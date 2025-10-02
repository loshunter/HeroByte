// ============================================================================
// MAP IMAGE LAYER COMPONENT
// ============================================================================
// Renders the background map image

import { Group, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import type { Camera } from "../types";

interface MapImageLayerProps {
  cam: Camera;
  src: string | null;
  x?: number;
  y?: number;
}

/**
 * MapImageLayer: Renders the background map image
 */
export function MapImageLayer({ cam, src, x = 0, y = 0 }: MapImageLayerProps) {
  const [img] = useImage(src || "", "anonymous");
  if (!img) return null;

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      <KonvaImage image={img} x={x} y={y} listening={false} />
    </Group>
  );
}
