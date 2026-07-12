import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MapEditPreviewLayer } from "../MapEditPreviewLayer";
import type { Camera } from "../../map/types";

type MockProps = Record<string, unknown> & { children?: ReactNode };

const lineProps: MockProps[] = [];
const circleProps: MockProps[] = [];
const groupProps: MockProps[] = [];

vi.mock("react-konva", () => ({
  Group: ({ children, ...props }: MockProps) => {
    groupProps.push(props);
    return <div data-testid="konva-group">{children}</div>;
  },
  Line: (props: MockProps) => {
    lineProps.push(props);
    return <div data-testid="konva-line" />;
  },
  Circle: (props: MockProps) => {
    circleProps.push(props);
    return <div data-testid="konva-circle" />;
  },
}));

const cam: Camera = { x: 12, y: 34, scale: 2 };

describe("MapEditPreviewLayer", () => {
  beforeEach(() => {
    lineProps.length = 0;
    circleProps.length = 0;
    groupProps.length = 0;
  });

  it("renders nothing without a preview drag", () => {
    const { container } = render(
      <MapEditPreviewLayer cam={cam} previewDrag={null} activeSubTool="wall" />,
    );
    expect(container.querySelector('[data-testid="konva-line"]')).toBeNull();
  });

  it("draws the dashed segment + endpoint dots with cam-scaled sizes", () => {
    render(
      <MapEditPreviewLayer
        cam={cam}
        previewDrag={{ start: { x: 100, y: 100 }, end: { x: 200, y: 100 } }}
        activeSubTool="wall"
      />,
    );

    expect(lineProps).toHaveLength(1);
    expect(lineProps[0]!.points).toEqual([100, 100, 200, 100]);
    // Stroke + dash divide by cam.scale (2) so they stay constant on screen.
    expect(lineProps[0]!.strokeWidth).toBe(1.5);
    expect(lineProps[0]!.dash).toEqual([4, 3]);

    expect(circleProps).toHaveLength(2);
    expect(circleProps.map((c) => [c.x, c.y, c.radius])).toEqual([
      [100, 100, 2],
      [200, 100, 2],
    ]);
  });

  it("nests the camera group over the map-transform group", () => {
    render(
      <MapEditPreviewLayer
        cam={cam}
        mapTransform={{ x: 5, y: 7, scaleX: 1, scaleY: 1, rotation: 0 }}
        previewDrag={{ start: { x: 0, y: 0 }, end: { x: 50, y: 0 } }}
        activeSubTool="wall"
      />,
    );

    const camGroup = groupProps.find((g) => g.x === cam.x && g.scaleX === cam.scale);
    const mapGroup = groupProps.find((g) => g.x === 5 && g.y === 7);
    expect(camGroup).toBeDefined();
    expect(mapGroup).toBeDefined();
  });
});
