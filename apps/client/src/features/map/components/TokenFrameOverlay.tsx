// ============================================================================
// TOKEN FRAME OVERLAY — a framed token's ring and selection outline (C5a)
// ============================================================================
// Drawn over the token's own node (the picture, or its colour, clipped to a
// circle by TokenSprite): the baked frame bitmap, and the outline on the
// frame's outer circle in place of the token box's square. It follows the
// node's position and scale through drags, glides and the transform handles,
// but NOT its rotation: the frame is lit by the table's one light, and a
// turned token must not turn its light with it. Two exceptions keep the frame
// on its picture: a stretched token (an oval) takes its rotation with it, and
// a flipped one is drawn unflipped (a mirrored frame would mirror the light).
// Never listens: the hit area is the token's own node.

import { useEffect, useRef } from "react";
import { Circle, Group, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { layoutFrame, type TokenFrame, type TokenSize } from "@herobyte/shared";
import type { FrameDrawing } from "../../render/frame/useFrameBitmap";

const FOLLOWED =
  "xChange.tokenFrame yChange.tokenFrame scaleXChange.tokenFrame scaleYChange.tokenFrame " +
  "rotationChange.tokenFrame";

/** The overlay's scale and turn for a token's: unflipped, and upright unless stretched. */
export function framePose(scaleX: number, scaleY: number, rotation: number) {
  const x = Math.abs(scaleX);
  const y = Math.abs(scaleY);
  const stretched = Math.abs(x - y) > 1e-3 * Math.max(x, y, 1);
  return { scaleX: x, scaleY: y, rotation: stretched ? rotation : 0 };
}

/** How far a frame reaches past the token box, as a share of its edge (0 growing in). */
export function frameOutset(frame: TokenFrame | undefined, size: TokenSize | undefined): number {
  return frame ? layoutFrame(frame, size).outset : 0;
}
/** The keyline is this much wider than the colour band (SelectionRing's ratio). */
const KEYLINE_RATIO = 5 / 3;

export interface TokenFrameOverlayProps {
  /** The token's node; null until it mounts. */
  follow: Konva.Node | null;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  /** The token's edge in map pixels. */
  size: number;
  drawing: FrameDrawing;
  /** The outline's colour; "transparent" draws none. */
  stroke: string;
  strokeWidth: number;
  /** The viewer's contrasting edge round a selection outline (C3), or none. */
  keyline: string | null;
  /** Receives the outline's node, which carries the selection glow. */
  outlineRef?: (node: Konva.Circle | null) => void;
}

export function TokenFrameOverlay({
  follow,
  x,
  y,
  scaleX,
  scaleY,
  rotation,
  size,
  drawing,
  stroke,
  strokeWidth,
  keyline,
  outlineRef,
}: TokenFrameOverlayProps): JSX.Element {
  const groupRef = useRef<Konva.Group | null>(null);
  useEffect(() => {
    const group = groupRef.current;
    // Mocked nodes in tests have no event system: the props alone place it.
    if (!follow || typeof follow.on !== "function" || typeof group?.setAttrs !== "function") {
      return;
    }
    const sync = () =>
      group.setAttrs({
        x: follow.x(),
        y: follow.y(),
        ...framePose(follow.scaleX(), follow.scaleY(), follow.rotation()),
      });
    sync();
    follow.on(FOLLOWED, sync);
    return () => {
      follow.off(FOLLOWED, sync);
    };
  }, [follow]);

  const edge = 2 * drawing.extent * size;
  const radius = drawing.layout.outer * size;
  const outlined = stroke !== "transparent";
  return (
    <Group ref={groupRef} listening={false} x={x} y={y} {...framePose(scaleX, scaleY, rotation)}>
      {drawing.bitmap && (
        <KonvaImage
          image={drawing.bitmap}
          x={-edge / 2}
          y={-edge / 2}
          width={edge}
          height={edge}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {outlined && keyline && (
        <Circle
          radius={radius}
          stroke={keyline}
          strokeWidth={strokeWidth * KEYLINE_RATIO}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {outlined && (
        <Circle
          ref={outlineRef}
          radius={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
