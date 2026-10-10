// ============================================================================
// SELECTION RING — a selected token's outline in the viewer's colour (C3)
// ============================================================================
// Drawn over the token, whose own stroke becomes the keyline: the colour band
// then has a contrasting edge on both sides, so it reads on the token's own
// fill (your picture-less token is filled with your colour), on light and dark
// maps and under fog. The token stays the one draggable node; the ring follows
// its position, rotation and scale through drags, glides and the transform
// handles by listening for those attribute changes.

import { useEffect, useRef, type RefObject } from "react";
import { Rect } from "react-konva";
import type Konva from "konva";

const FOLLOWED =
  "xChange.selectionRing yChange.selectionRing rotationChange.selectionRing " +
  "scaleXChange.selectionRing scaleYChange.selectionRing";

interface SelectionRingProps {
  /** The token node the ring follows. */
  follow: RefObject<Konva.Node | null>;
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
  stroke: string;
  strokeWidth: number;
}

export function SelectionRing({ follow, ...rect }: SelectionRingProps): JSX.Element {
  const ringRef = useRef<Konva.Rect | null>(null);
  useEffect(() => {
    const node = follow.current;
    const ring = ringRef.current;
    // Mocked nodes in tests have no event system: the props alone place the ring.
    if (!node || typeof node.on !== "function" || !ring || typeof ring.setAttrs !== "function") {
      return;
    }
    const sync = () => {
      ring.setAttrs({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    };
    sync();
    node.on(FOLLOWED, sync);
    return () => {
      node.off(FOLLOWED);
    };
  }, [follow]);
  return <Rect ref={ringRef} listening={false} {...rect} />;
}
