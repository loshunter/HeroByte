// ============================================================================
// TEMPLATE SHAPE — one area of effect, drawn
// ============================================================================
// Extracted from DrawingsLayer rather than added to it: that file is already
// ~560 LOC (well past the 350 guard's baseline) and the house rule is extract,
// not grow. It renders BOTH the committed template and the live drag preview,
// so the shape a player releases the mouse on is the shape that lands.
//
// The polygon arrives pre-computed by `buildAreaTemplate` in @herobyte/shared;
// nothing here derives geometry.

import { Line, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { formatAreaTemplate, type AreaTemplate } from "@herobyte/shared";

export interface TemplateShapeHandlers {
  onClick?: (event: KonvaEventObject<MouseEvent>) => void;
  onTap?: (event: KonvaEventObject<Event>) => void;
}

export interface TemplateShapeProps {
  /** Closed polygon in world pixels. */
  points: { x: number; y: number }[];
  color: string;
  /** Outline thickness in world pixels, divided by the camera scale here. */
  width: number;
  opacity: number;
  /** Present on a committed template; the readout is drawn from it. */
  template?: AreaTemplate;
  /** Camera scale, so strokes and text stay the same size on screen. */
  scale: number;
  selected?: boolean;
  handlers?: TemplateShapeHandlers;
}

/**
 * How much of the chosen opacity the interior wash gets. An area of effect has
 * to be filled — "is Grak in it?" is answered by seeing Grak inside it — but a
 * fully opaque fill would hide the very token the question is about.
 */
const TEMPLATE_FILL_ALPHA = 0.25;

/** Label box, centred on the shape. Same trick as MeasureLayer's readout. */
const LABEL_WIDTH = 200;

export function TemplateShape({
  points,
  color,
  width,
  opacity,
  template,
  scale,
  selected = false,
  handlers,
}: TemplateShapeProps) {
  if (points.length < 3) return null;

  const flat = points.flatMap((point) => [point.x, point.y]);
  // A LOOP, not `Math.min(...xs)`: the drawing validator admits up to 10,000
  // points, and spreading an array that size at a call site is a stack-depth
  // gamble on the engine. This renders inside every client's frame loop.
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;

  return (
    <>
      {/* Wash and outline are separate nodes because Konva's `opacity` applies
          to fill and stroke together — one node cannot have a faint interior
          and a legible edge. */}
      <Line
        points={flat}
        closed
        fill={color}
        opacity={opacity * TEMPLATE_FILL_ALPHA}
        {...handlers}
      />
      <Line
        points={flat}
        closed
        stroke={color}
        strokeWidth={width / scale}
        opacity={opacity}
        listening={false}
      />
      {template && (
        <Text
          x={centreX}
          y={centreY}
          text={formatAreaTemplate(template)}
          fill={color}
          fontSize={12 / scale}
          fontStyle="bold"
          align="center"
          width={LABEL_WIDTH / scale}
          offsetX={LABEL_WIDTH / scale / 2}
          listening={false}
        />
      )}
      {selected && (
        <Line
          points={flat}
          closed
          stroke="#447DF7"
          strokeWidth={2 / scale}
          dash={[8 / scale, 4 / scale]}
          listening={false}
        />
      )}
    </>
  );
}
