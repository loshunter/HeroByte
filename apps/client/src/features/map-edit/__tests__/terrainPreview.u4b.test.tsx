import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MapEditPreviewLayer } from "../MapEditPreviewLayer";

const { rects, groups } = vi.hoisted(() => ({
  rects: [] as Record<string, unknown>[],
  groups: [] as Record<string, unknown>[],
}));
vi.mock("react-konva", () => ({
  Group: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => {
    groups.push(props);
    return <div>{children}</div>;
  },
  Rect: (props: Record<string, unknown>) => {
    rects.push(props);
    return null;
  },
  Circle: () => null,
  Line: () => null,
  Shape: () => null,
  Text: () => null,
}));
vi.mock("../brushThumbnails", () => ({
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
  requestBrushThumbnails: vi.fn(),
}));
afterEach(() => {
  cleanup();
  rects.length = 0;
  groups.length = 0;
});

it.each(["terrain", "erase"] as const)(
  "renders the %s footprint alone at offset document cells inside the real transform groups",
  (tool) => {
    const props = {
      cam: { x: 10, y: 20, scale: 2 },
      mapTransform: { x: 80, y: 90, scaleX: 3, scaleY: 4, rotation: 30 },
      previewDrag: null,
      activeSubTool: tool,
      gridSize: 25,
      gridOffsetX: 7,
      gridOffsetY: 11,
      brushPreviewCells: [{ x: -1, y: 2, assetId: tool === "terrain" ? "terrain:grass" : null }],
    };
    render(<MapEditPreviewLayer {...props} />);
    expect(groups).toEqual([
      { x: 10, y: 20, scaleX: 2, scaleY: 2, listening: false },
      { x: 80, y: 90, scaleX: 3, scaleY: 4, rotation: 30, listening: false },
    ]);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({
      x: -18,
      y: 61,
      width: 25,
      height: 25,
      listening: false,
      name: "map-edit-preview:brush-footprint",
    });
  },
);
