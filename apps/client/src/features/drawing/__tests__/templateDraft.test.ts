/**
 * Tests for the template draft helpers (S6)
 *
 * These are the join between the drag and the wire record. The geometry itself
 * is proven in packages/shared/src/__tests__/areaTemplates.test.ts; what is
 * tested here is the commit DECISION — which drags become a drawing, and what
 * that drawing looks like.
 *
 * Source: apps/client/src/features/drawing/utils/templateDraft.ts
 */

import { describe, it, expect } from "vitest";
import {
  buildTemplateDrawing,
  projectTemplateDrag,
  templateDragMoved,
  templateDrawingFor,
  TEMPLATE_MIN_DRAG_PX,
} from "../utils/templateDraft";

const GRID = 50;
const FEET = 5;
const STYLE = { id: "draw-1", color: "#ff8800", width: 3, opacity: 0.8 };

function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  return [from, to];
}

describe("projectTemplateDrag", () => {
  it("returns null for a plain drawing tool", () => {
    for (const drawTool of ["freehand", "line", "rect", "circle", "eraser"]) {
      expect(
        projectTemplateDrag({
          drawTool,
          raw: drag({ x: 0, y: 0 }, { x: 100, y: 0 }),
          gridSize: GRID,
          gridSquareSize: FEET,
        }),
      ).toBeNull();
    }
  });

  it("returns null before the drag has two points", () => {
    expect(
      projectTemplateDrag({
        drawTool: "template-cone",
        raw: [{ x: 0, y: 0 }],
        gridSize: GRID,
        gridSquareSize: FEET,
      }),
    ).toBeNull();
  });

  it("builds the kind the tool names", () => {
    const built = projectTemplateDrag({
      drawTool: "template-cone",
      raw: drag({ x: 100, y: 100 }, { x: 250, y: 100 }),
      gridSize: GRID,
      gridSquareSize: FEET,
    });
    expect(built?.template).toEqual({ kind: "cone", sizeFeet: 15 });
    expect(built?.points).toHaveLength(3);
  });

  it("uses the FIRST and LAST point, so a wandering drag still sizes from the anchor", () => {
    const wandering = projectTemplateDrag({
      drawTool: "template-circle",
      raw: [
        { x: 100, y: 100 },
        { x: 900, y: 900 },
        { x: 200, y: 100 },
      ],
      gridSize: GRID,
      gridSquareSize: FEET,
    });
    expect(wandering?.template.sizeFeet).toBe(10);
  });
});

describe("templateDragMoved", () => {
  it("rejects a press-and-release that never moved", () => {
    // onMouseDown seeds the drag as [world, world]; without this a stray tap —
    // and on a phone, every double-tap-to-ping — would drop a burst on the map.
    expect(templateDragMoved(drag({ x: 100, y: 100 }, { x: 100, y: 100 }))).toBe(false);
  });

  it("rejects a drag with fewer than two points", () => {
    expect(templateDragMoved([])).toBe(false);
    expect(templateDragMoved([{ x: 1, y: 1 }])).toBe(false);
  });

  it("rejects the pixel or two a fingertip moves during a tap", () => {
    // Exact inequality would call this a drag, and on a phone that means every
    // stray touch drops a template on the map.
    expect(templateDragMoved(drag({ x: 100, y: 100 }, { x: 101, y: 100 }))).toBe(false);
    expect(templateDragMoved(drag({ x: 100, y: 100 }, { x: 102, y: 102 }))).toBe(false);
  });

  it("accepts a deliberate drag", () => {
    expect(
      templateDragMoved(drag({ x: 100, y: 100 }, { x: 100 + TEMPLATE_MIN_DRAG_PX, y: 100 })),
    ).toBe(true);
    expect(templateDragMoved(drag({ x: 100, y: 100 }, { x: 200, y: 200 }))).toBe(true);
  });
});

describe("buildTemplateDrawing", () => {
  it("commits one record type, with the polygon already baked in", () => {
    const built = projectTemplateDrag({
      drawTool: "template-square",
      raw: drag({ x: 100, y: 100 }, { x: 230, y: 180 }),
      gridSize: GRID,
      gridSquareSize: FEET,
    })!;
    const drawing = buildTemplateDrawing(built, STYLE);

    expect(drawing.type).toBe("template");
    expect(drawing.points).toEqual(built.points);
    expect(drawing.template).toEqual({ kind: "square", sizeFeet: 15 });
    expect(drawing.color).toBe(STYLE.color);
    expect(drawing.opacity).toBe(STYLE.opacity);
    // An area of effect is always an area — the renderer washes its interior.
    expect(drawing.filled).toBe(true);
    // The client never stamps an owner; the server binds it from the socket.
    expect(drawing.owner).toBeUndefined();
  });
});

describe("templateDrawingFor", () => {
  const base = { drawTool: "template-line", gridSize: GRID, gridSquareSize: FEET, style: STYLE };

  it("returns a drawing for a real drag", () => {
    const drawing = templateDrawingFor({
      ...base,
      raw: drag({ x: 100, y: 100 }, { x: 250, y: 100 }),
    });
    expect(drawing?.type).toBe("template");
    expect(drawing?.template).toEqual({ kind: "line", sizeFeet: 15 });
  });

  it("returns null for a tap", () => {
    expect(
      templateDrawingFor({ ...base, raw: drag({ x: 100, y: 100 }, { x: 100, y: 100 }) }),
    ).toBeNull();
  });

  it("returns null for a tap that wobbled by a finger's width", () => {
    expect(
      templateDrawingFor({ ...base, raw: drag({ x: 100, y: 100 }, { x: 102, y: 101 }) }),
    ).toBeNull();
  });

  it("returns null for a non-template tool", () => {
    expect(
      templateDrawingFor({
        ...base,
        drawTool: "freehand",
        raw: drag({ x: 100, y: 100 }, { x: 250, y: 100 }),
      }),
    ).toBeNull();
  });

  it("returns null when there is no grid to snap to", () => {
    // buildAreaTemplate yields an empty polygon rather than NaN coordinates;
    // committing that would put an invisible, unerasable record on the table.
    expect(
      templateDrawingFor({
        ...base,
        gridSize: 0,
        raw: drag({ x: 100, y: 100 }, { x: 250, y: 100 }),
      }),
    ).toBeNull();
  });
});
