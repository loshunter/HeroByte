import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { MapEditPreviewLayer } from "../MapEditPreviewLayer";
import { describeGenerateRegion } from "../generateRegion";

type Props = Record<string, unknown> & { children?: ReactNode };
const rectangles: Props[] = [];
const groups: Props[] = [];
vi.mock("react-konva", () => ({
  Group: ({ children, ...props }: Props) => {
    groups.push(props);
    return <div data-testid={String(props.name ?? "group")}>{children}</div>;
  },
  Rect: (props: Props) => {
    rectangles.push(props);
    return null;
  },
  Text: ({ text }: Props) => <span>{String(text)}</span>,
  Line: () => null,
  Circle: () => null,
  Shape: () => null,
}));
vi.mock("../brushThumbnails", () => ({
  BRUSH_CHIP_CELL: 40,
  peekBrushChip: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));
beforeEach(() => {
  rectangles.length = 0;
  groups.length = 0;
});
afterEach(cleanup);

const document = createMapDocument({
  id: "preview",
  name: "Preview",
  width: 2000,
  height: 2000,
  timestamp: 1,
});
const target = describeGenerateRegion(document, { x: -2, y: 1, cols: 24, rows: 20 });
const props = {
  cam: { x: 12, y: 34, scale: 2 },
  mapTransform: { x: 90, y: 80, scaleX: 1.5, scaleY: 0.75, rotation: 30 },
  previewDrag: null,
  activeSubTool: "generate" as const,
  gridSize: 50,
  persistentPreview: { generateRegion: target, populateGhosts: [] },
};

describe("persistent Generate preview", () => {
  it("renders the complete unclipped target and outside strip inside the existing camera and map transforms", () => {
    render(<MapEditPreviewLayer {...props} />);
    expect(groups[0]).toMatchObject({ x: 12, y: 34, scaleX: 2, scaleY: 2, listening: false });
    expect(groups[1]).toMatchObject(props.mapTransform);
    expect(rectangles[0]).toMatchObject({ x: -100, y: 50, width: 1200, height: 1000 });
    expect(rectangles.filter((rect) => rect.name === "generate-region-outside")).toEqual([
      expect.objectContaining({ x: -100, y: 50, width: 100, height: 1000 }),
    ]);
    expect(rectangles.every((rect) => rect.listening === false)).toBe(true);
    expect(screen.getByText("Outside map: left")).toBeInTheDocument();
  });

  it("hides the old aim during a new drag and restores it when that unsent drag is cancelled", () => {
    const view = render(<MapEditPreviewLayer {...props} />);
    expect(screen.getByTestId("generate-region-preview")).toBeInTheDocument();
    view.rerender(
      <MapEditPreviewLayer
        {...props}
        previewDrag={{ start: { x: 0, y: 0 }, end: { x: 100, y: 100 } }}
      />,
    );
    expect(screen.queryByTestId("generate-region-preview")).not.toBeInTheDocument();
    view.rerender(<MapEditPreviewLayer {...props} />);
    expect(screen.getByTestId("generate-region-preview")).toBeInTheDocument();
    view.rerender(<MapEditPreviewLayer {...props} activeSubTool="terrain" />);
    expect(screen.queryByTestId("generate-region-preview")).not.toBeInTheDocument();
  });

  it("never renders a target when the privileged preview is withheld by its owner", () => {
    render(<MapEditPreviewLayer {...props} persistentPreview={null} />);
    expect(screen.queryByTestId("generate-region-preview")).not.toBeInTheDocument();
    expect(rectangles).toEqual([]);
  });
});
