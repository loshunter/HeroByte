// ============================================================================
// TEMPLATE DRAFT — turning a drag into an area template
// ============================================================================
// Extracted from useDrawingTool: templates pushed that hook past the 350-LOC
// guard, and the geometry half is pure anyway, so it tests without a renderer.
//
// The rule that matters: ONE projection function, called by the preview and by
// the commit. If they ever computed the shape separately, the template a
// player releases the mouse on would not be the template that lands.

import {
  buildAreaTemplate,
  templateKindForTool,
  type BuiltAreaTemplate,
  type Drawing,
} from "@herobyte/shared";

export interface TemplateDragInput {
  /** The active tool; a non-template tool yields null. */
  drawTool: string;
  /** The raw drag, [origin, ..., aim] in world pixels. */
  raw: { x: number; y: number }[];
  gridSize: number;
  gridSquareSize: number;
}

/**
 * Project a raw drag into a snapped template, or null when the tool is not a
 * template tool (or the drag has not produced two points yet).
 */
export function projectTemplateDrag(input: TemplateDragInput): BuiltAreaTemplate | null {
  const kind = templateKindForTool(input.drawTool);
  if (!kind || input.raw.length < 2) return null;
  return buildAreaTemplate({
    kind,
    origin: input.raw[0],
    aim: input.raw[input.raw.length - 1],
    gridSize: input.gridSize,
    gridSquareSize: input.gridSquareSize,
  });
}

/**
 * Minimum travel, in world pixels, before a press counts as a drag.
 *
 * Exact inequality is not enough: a fingertip moves a pixel or two during any
 * tap, so `first.x !== last.x` is TRUE for most taps on a phone and every
 * stray touch would drop a template on the map. Eight pixels is well under a
 * deliberate drag and well over finger noise.
 */
export const TEMPLATE_MIN_DRAG_PX = 8;

/**
 * Did the pointer actually travel?
 *
 * A press-and-release that never moved is not a template. `onMouseDown` seeds
 * the drag as [world, world], so without this check every stray tap — and on a
 * phone, every double-tap-to-ping — would drop a 5-ft burst on the map.
 */
export function templateDragMoved(raw: { x: number; y: number }[]): boolean {
  if (raw.length < 2) return false;
  const first = raw[0];
  const last = raw[raw.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y) >= TEMPLATE_MIN_DRAG_PX;
}

export interface TemplateDrawingStyle {
  id: string;
  color: string;
  width: number;
  opacity: number;
}

/**
 * The wire record for a committed template. `points` is the finished polygon,
 * so nothing downstream re-derives geometry; `template` rides along purely so
 * the shape can say what it is ("15 ft cone").
 */
export function buildTemplateDrawing(
  built: BuiltAreaTemplate,
  style: TemplateDrawingStyle,
): Drawing {
  return {
    id: style.id,
    type: "template",
    points: built.points,
    color: style.color,
    width: style.width,
    opacity: style.opacity,
    // An area of effect is an area: the renderer washes the interior so you
    // can see which tokens are standing in it.
    filled: true,
    template: built.template,
  };
}

/**
 * The whole commit decision in one call: project the drag, refuse a tap that
 * never moved or a degenerate polygon, and return the record to send. Null
 * means "nothing to commit" — the caller still resets its draft state.
 */
export function templateDrawingFor(
  input: TemplateDragInput & { style: TemplateDrawingStyle },
): Drawing | null {
  if (!templateDragMoved(input.raw)) return null;
  const built = projectTemplateDrag(input);
  if (!built || built.points.length < 3) return null;
  return buildTemplateDrawing(built, input.style);
}
