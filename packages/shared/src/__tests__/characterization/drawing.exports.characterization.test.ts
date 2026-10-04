// Public drawing and history-capability type contract.
import { describe, expect, expectTypeOf, it } from "vitest";
import * as shared from "../../index.js";
import type { DrawingHistoryCapabilities, RoomSnapshot } from "../../index.js";
import type { AreaTemplate, Drawing, DrawingSegmentPayload, DrawingType } from "../../index.js";

type DrawingContract = {
  id: string;
  owner?: string;
  type: DrawingType;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  opacity: number;
  filled?: boolean;
  selectedBy?: string;
  template?: AreaTemplate;
};

describe("drawing type exports and optional history capabilities", () => {
  it("retains the full barrel types and a segment differs only by its absent id", () => {
    expectTypeOf<Drawing>().toEqualTypeOf<DrawingContract>();
    expectTypeOf<DrawingHistoryCapabilities>().toEqualTypeOf<{
      canUndo: boolean;
      canRedo: boolean;
    }>();
    expectTypeOf<RoomSnapshot["drawingHistory"]>().toEqualTypeOf<
      DrawingHistoryCapabilities | undefined
    >();
    expectTypeOf<DrawingSegmentPayload>().toEqualTypeOf<Omit<DrawingContract, "id">>();
    const segment: DrawingSegmentPayload = {
      type: "freehand",
      points: [
        { x: 0, y: 1 },
        { x: 2, y: 3 },
      ],
      color: "white",
      width: 2,
      opacity: 1,
    };
    const drawing: Drawing = { ...segment, id: "export-characterization", owner: "owner" };
    expect(drawing).toEqual({ ...segment, id: "export-characterization", owner: "owner" });
  });

  it("does not turn Drawing or DrawingSegmentPayload into runtime exports", () => {
    expect(shared).not.toHaveProperty("Drawing");
    expect(shared).not.toHaveProperty("DrawingHistoryCapabilities");
    expect(shared).not.toHaveProperty("DrawingSegmentPayload");
  });
});
