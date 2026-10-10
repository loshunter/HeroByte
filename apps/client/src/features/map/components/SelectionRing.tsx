// ============================================================================
// SELECTION RING — a selected token's or prop's outline in the viewer's colour (C3)
// ============================================================================
// Two rectangles over the piece: a keyline (dark or light, whichever contrasts
// more with the colour) and the colour band on it, so the band has a
// contrasting edge on both sides: it reads on the piece's own fill or picture
// (your picture-less token is filled with your colour), on light and dark maps
// and under fog. The piece stays the one draggable node; its own stroke keeps
// today's width (so its hit area is unchanged) but turns transparent. The ring follows its position, rotation and scale through drags,
// glides and the transform handles by listening for those attribute changes on
// the node it is given. The node is passed by value, so when the piece's node
// is replaced (a picture loading swaps the placeholder for the image) the ring
// listens to the new one.

import { useEffect, useRef } from "react";
import { Group, Rect } from "react-konva";
import type Konva from "konva";

const FOLLOWED =
  "xChange.selectionRing yChange.selectionRing rotationChange.selectionRing " +
  "scaleXChange.selectionRing scaleYChange.selectionRing";

/** How much wider than the colour band the keyline is, as a share of the band (1 px each side at 3 px). */
const KEYLINE_RATIO = 5 / 3;

export interface RingGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  cornerRadius: number;
}

interface SelectionRingProps extends RingGeometry {
  /** The piece's node; null until it mounts. */
  follow: Konva.Node | null;
  color: string;
  keyline: string;
  /** The colour band's width (already divided by the camera scale). */
  strokeWidth: number;
  /** Receives the colour band's node (a picture token's glow goes on it). */
  bandRef?: (node: Konva.Rect | null) => void;
}

export function SelectionRing({
  follow,
  color,
  keyline,
  strokeWidth,
  bandRef,
  x,
  y,
  rotation,
  scaleX,
  scaleY,
  ...box
}: SelectionRingProps): JSX.Element {
  const ringRef = useRef<Konva.Group | null>(null);
  useEffect(() => {
    const ring = ringRef.current;
    // Mocked nodes in tests have no event system: the props alone place the ring.
    if (
      !follow ||
      typeof follow.on !== "function" ||
      !ring ||
      typeof ring.setAttrs !== "function"
    ) {
      return;
    }
    const sync = () => {
      ring.setAttrs({
        x: follow.x(),
        y: follow.y(),
        rotation: follow.rotation(),
        scaleX: follow.scaleX(),
        scaleY: follow.scaleY(),
      });
    };
    sync();
    follow.on(FOLLOWED, sync);
    return () => {
      follow.off(FOLLOWED, sync);
    };
  }, [follow]);
  return (
    <Group ref={ringRef} listening={false} {...{ x, y, rotation, scaleX, scaleY }}>
      <Rect
        {...box}
        stroke={keyline}
        strokeWidth={strokeWidth * KEYLINE_RATIO}
        listening={false}
        perfectDrawEnabled={false}
      />
      <Rect
        ref={bandRef}
        {...box}
        stroke={color}
        strokeWidth={strokeWidth}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
