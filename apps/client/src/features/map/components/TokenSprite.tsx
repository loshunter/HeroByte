// ============================================================================
// TOKEN SPRITE — one token on the map
// ============================================================================
// The token's one draggable node (its picture, or a fill of its colour) with
// the glide, the pop-in and the selection glow. Split out of TokensLayer.tsx,
// which sits on the structure baseline, when tokens gained frames (C5a): a
// framed token is drawn as a circle with TokenFrameOverlay over it.

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Group, Rect, Image as KonvaImage } from "react-konva";
import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { isPolygonShape, type SceneObject } from "@herobyte/shared";
import { clipToShape, hitShape } from "./frameShapePath";
import useImage from "use-image";
import { SelectionRing } from "./SelectionRing";
import { TokenFrameOverlay } from "./TokenFrameOverlay";
import { useSelectionPalette } from "../selectionPalette";
import { decorativeMotionDisabled, motionDisabled } from "../../juice";
import { PROP_SIZE_MULTIPLIERS } from "../propSizing";
import { useFrameBitmap } from "../../render/frame/useFrameBitmap";
import type { FrameTierBudget } from "../../render/frame/frameTier";

interface TokenSpriteProps {
  object: SceneObject & { type: "token" };
  gridSize: number;
  stroke: string;
  strokeWidth: number;
  interactive: boolean;
  draggable?: boolean;
  onDragEnd?: (event: KonvaEventObject<DragEvent>) => void;
  onDragStart?: (event: KonvaEventObject<DragEvent>) => void;
  onDragMove?: (event: KonvaEventObject<DragEvent>) => void;
  onHover: (id: string | null) => void;
  onDoubleClick?: () => void;
  onClick?: (event: KonvaEventObject<MouseEvent>) => void;
  onTap?: (event: KonvaEventObject<TouchEvent>) => void;
  onNodeReady?: (node: Konva.Node | null) => void;
  /** Play a scale "pop" when the token first appears. */
  popIn?: boolean;
  /** Glide to new positions (used for remote moves; off during local drag). */
  glide?: boolean;
  /** Pulse a selection glow. */
  selected?: boolean;
  /** The map's zoom: a framed token bakes its frame at the size it is seen (C5a). */
  camScale?: number;
  /** The tier every framed token on the map is capped at, so together they fit the cache. */
  frameBudget: FrameTierBudget;
}

// Guards against non-Konva refs (e.g. mocked nodes in tests / no-canvas envs)
// so animation calls never throw where the DSP/canvas isn't available.
function isKonvaNode(node: Konva.Node | null): node is Konva.Node {
  return !!node && typeof node.getLayer === "function" && typeof node.to === "function";
}

// Size multiplier per token size category — ONE ladder with the props (and
// the move-pad follow, which sizes what it keeps on screen from it).
const SIZE_MULTIPLIERS = PROP_SIZE_MULTIPLIERS;

export const TokenSprite = memo(function TokenSprite({
  object,
  gridSize,
  stroke,
  strokeWidth,
  draggable = false,
  interactive,
  onDragEnd,
  onDragStart,
  onDragMove,
  onHover,
  onDoubleClick,
  onClick,
  onTap,
  onNodeReady,
  popIn = false,
  glide = false,
  selected = false,
  camScale = 1,
  frameBudget,
}: TokenSpriteProps) {
  const { data, transform, id } = object;
  const [image, status] = useImage(data.imageUrl ?? "");
  const palette = useSelectionPalette();
  // In a viewer's colour a ring draws the selection (keyline and colour) over the token.
  const ringed = selected && palette.keyline !== null;

  // Calculate size multiplier based on token size category
  const sizeMultiplier = SIZE_MULTIPLIERS[data.size ?? "medium"] ?? 1.0;

  const size = gridSize * 0.75 * sizeMultiplier;
  const halfSize = size / 2;

  // A framed token (C5a) is a circle: its picture or colour clipped round, the
  // baked frame over it, and the outline and glow on the frame's outer circle.
  const frameDrawing = useFrameBitmap(
    data.frame
      ? {
          frame: data.frame,
          tokenId: id.replace(/^token:/, ""),
          color: data.color,
          size: data.size,
          tokenPx: size,
          zoom: camScale * Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY)),
          budget: frameBudget,
        }
      : null,
  );
  const framed = frameDrawing !== null;
  // A polygon frame (C5b): the picture clipped to its shape, the hit area on its outer edge.
  const shape =
    frameDrawing && isPolygonShape(frameDrawing.layout.shape) ? frameDrawing.layout.shape : null;
  const [frameOutline, setFrameOutline] = useState<Konva.Node | null>(null);

  const shapeRef = useRef<Konva.Node | null>(null);
  // The node in state too: a picture loading swaps the placeholder Rect for an Image,
  // and the glow and the selection ring must move to the new node.
  const [shapeNode, setShapeNode] = useState<Konva.Node | null>(null);
  // A stable ref callback (the caller's onNodeReady is a new function every render,
  // and a changing ref callback detached and re-attached the node on each one).
  const onNodeReadyRef = useRef(onNodeReady);
  useLayoutEffect(() => {
    onNodeReadyRef.current = onNodeReady;
  }, [onNodeReady]);
  const nodeRef = useCallback((node: Konva.Node | null) => {
    shapeRef.current = node;
    setShapeNode(node);
    onNodeReadyRef.current?.(node);
  }, []);

  const posX = transform.x * gridSize + gridSize / 2;
  const posY = transform.y * gridSize + gridSize / 2;

  // Glide to new positions when moved remotely (never while locally dragging).
  const prevPos = useRef({ x: posX, y: posY });
  useLayoutEffect(() => {
    const node = shapeRef.current;
    const prev = prevPos.current;
    prevPos.current = { x: posX, y: posY };
    if (!isKonvaNode(node) || !glide || motionDisabled()) return;
    if (prev.x === posX && prev.y === posY) return;
    node.position({ x: prev.x, y: prev.y });
    const tween = new Konva.Tween({
      node,
      duration: 0.16,
      x: posX,
      y: posY,
      easing: Konva.Easings.EaseOut,
    });
    tween.play();
    return () => tween.destroy();
  }, [posX, posY, glide]);

  // Scale "pop" when a token first appears on the board. Decorative: plays on
  // "full" motion only — glide above stays on for "subtle" because a token
  // teleporting reads as a different move.
  useEffect(() => {
    const node = shapeRef.current;
    if (!isKonvaNode(node) || !popIn || decorativeMotionDisabled()) return;
    const targetX = transform.scaleX;
    const targetY = transform.scaleY;
    node.scale({ x: targetX * 0.3, y: targetY * 0.3 });
    const tween = new Konva.Tween({
      node,
      duration: 0.3,
      scaleX: targetX,
      scaleY: targetY,
      easing: Konva.Easings.BackEaseOut,
    });
    tween.play();
    return () => {
      tween.destroy();
      node.scale({ x: targetX, y: targetY });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pops when popIn turns on, to the scale the token has at that moment
  }, [popIn]);

  // The node that glows. Konva draws an Image with a corner radius and a shadow
  // through its stage-sized buffer canvas on every frame, a stroke-only rect never:
  // so a ringed picture glows on its ring's colour band. Without a ring (no colour)
  // a picture keeps today's glow.
  const [ringBand, setRingBand] = useState<Konva.Node | null>(null);
  const picture = Boolean(data.imageUrl && status === "loaded" && image);
  const glowNode = framed ? frameOutline : ringed && picture ? ringBand : shapeNode;

  // Pulsing glow while selected. Decorative: "full" motion only.
  useEffect(() => {
    const node = glowNode;
    if (!isKonvaNode(node) || !selected || decorativeMotionDisabled()) return;
    const layer = node.getLayer();
    if (!layer) return;
    const shape = node as Konva.Shape;
    const anim = new Konva.Animation((frame) => {
      const seconds = (frame?.time ?? 0) / 1000;
      shape.shadowColor(palette.glow);
      shape.shadowBlur(9 + 6 * Math.sin(seconds * Math.PI * 2 * 1.1));
      shape.shadowOpacity(0.9);
    }, layer);
    anim.start();
    return () => {
      anim.stop();
      shape.shadowBlur(0);
      shape.shadowOpacity(0);
    };
  }, [selected, palette.glow, glowNode]);

  const baseProps = {
    x: transform.x * gridSize + gridSize / 2,
    y: transform.y * gridSize + gridSize / 2,
    offsetX: halfSize,
    offsetY: halfSize,
    width: size,
    height: size,
    rotation: transform.rotation,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    cornerRadius: shape ? 0 : framed ? halfSize : gridSize / 8,
    stroke: ringed || framed ? "transparent" : stroke,
    strokeWidth,
    // Grown out, the frame reaches past the token box: the hit area reaches with it.
    hitStrokeWidth:
      framed && !shape ? strokeWidth + 2 * frameDrawing.layout.outset * size : undefined,
    hitFunc: shape
      ? (context: Konva.Context, node: Konva.Shape) =>
          hitShape(context, node, shape, size, frameDrawing!.layout.outer)
      : undefined,
    // Ringed, the stroke is invisible: drawing directly keeps a glowing token off
    // Konva's stage-sized buffer canvas (fill + stroke + shadow) on every frame.
    perfectDrawEnabled: !ringed && !framed,
    draggable,
    onDragEnd,
    onDragStart,
    onDragMove,
    onMouseEnter: () => onHover(id),
    onMouseLeave: () => onHover(null),
    listening: interactive,
    onDblClick: onDoubleClick,
    // A phone fires no dblclick (Konva cancels a touchstart on a shape, so the
    // browser never synthesises mouse events), so a double-tap needs its own wire.
    onDblTap: onDoubleClick,
    onClick,
    onTap,
    id,
    name: id,
    attrs: { "data-token-id": id },
  } as const;
  const shapeProps = { ...baseProps, ref: nodeRef };
  const { x, y, offsetX, offsetY, width, height, rotation, scaleX, scaleY, cornerRadius } =
    baseProps;
  const ring = framed ? (
    <TokenFrameOverlay
      follow={shapeNode}
      {...{ x, y, scaleX, scaleY, rotation, size }}
      drawing={frameDrawing}
      stroke={stroke}
      strokeWidth={strokeWidth}
      keyline={ringed ? palette.keyline : null}
      outlineRef={setFrameOutline}
    />
  ) : ringed ? (
    <SelectionRing
      follow={shapeNode}
      {...{ x, y, offsetX, offsetY, width, height, rotation, scaleX, scaleY, cornerRadius }}
      color={palette.stroke}
      keyline={palette.keyline!}
      strokeWidth={strokeWidth}
      bandRef={setRingBand}
    />
  ) : null;

  const node =
    data.imageUrl && status === "loaded" && image ? (
      <KonvaImage image={image} {...shapeProps} />
    ) : (
      <Rect fill={data.color} {...shapeProps} />
    );
  return (
    <>
      {shape ? (
        <Group clipFunc={(context) => clipToShape(context, shapeRef.current, shape, size)}>
          {node}
        </Group>
      ) : (
        node
      )}
      {ring}
    </>
  );
});
