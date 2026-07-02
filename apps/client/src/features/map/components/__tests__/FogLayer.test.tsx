// ============================================================================
// FOGLAYER COMPONENT TESTS
// ============================================================================
// Structural tests: fog coverage, vision holes, and transform alignment.
// The visibility math itself is covered by @herobyte/shared's test suite.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { FogLayer } from "../FogLayer";
import type { CompiledScene } from "@herobyte/shared";
import type { Camera } from "../../types";

type MockProps = Record<string, unknown> & { children?: ReactNode };

const rectProps: MockProps[] = [];
const lineProps: MockProps[] = [];
const groupProps: MockProps[] = [];

vi.mock("react-konva", () => ({
  Layer: ({ children }: MockProps) => <div data-testid="konva-layer">{children}</div>,
  Group: ({ children, ...props }: MockProps) => {
    groupProps.push(props);
    return <div data-testid="konva-group">{children}</div>;
  },
  Line: (props: MockProps) => {
    lineProps.push(props);
    return <div data-testid="konva-line" />;
  },
  Rect: (props: MockProps) => {
    rectProps.push(props);
    return <div data-testid="konva-rect" />;
  },
}));

const cam: Camera = { x: 7, y: 8, scale: 1.5 };

function scene(): CompiledScene {
  return {
    schemaVersion: 1,
    sourceDocumentId: "map",
    sourceRevision: 1,
    compiledAt: 1,
    width: 400,
    height: 300,
    walls: [
      { id: "w", x1: 200, y1: 0, x2: 200, y2: 300, blocksMovement: true, blocksVision: true },
    ],
    doors: [],
    lights: [],
  };
}

describe("FogLayer", () => {
  beforeEach(() => {
    rectProps.length = 0;
    lineProps.length = 0;
    groupProps.length = 0;
  });

  it("covers the compiled scene with a fog rectangle", () => {
    render(<FogLayer cam={cam} compiledScene={scene()} viewers={[]} />);

    expect(rectProps).toHaveLength(1);
    expect(rectProps[0]).toMatchObject({ x: 0, y: 0, width: 400, height: 300 });
  });

  it("renders no vision holes when the player has no tokens", () => {
    render(<FogLayer cam={cam} compiledScene={scene()} viewers={[]} />);

    expect(lineProps).toHaveLength(0);
  });

  it("punches one destination-out hole per viewer", () => {
    render(
      <FogLayer
        cam={cam}
        compiledScene={scene()}
        viewers={[
          { x: 50, y: 150 },
          { x: 100, y: 100 },
        ]}
      />,
    );

    expect(lineProps).toHaveLength(2);
    for (const hole of lineProps) {
      expect(hole.globalCompositeOperation).toBe("destination-out");
      expect(hole.closed).toBe(true);
      expect((hole.points as number[]).length).toBeGreaterThanOrEqual(6);
    }
  });

  it("nests the camera and map transforms like the background image", () => {
    render(
      <FogLayer
        cam={cam}
        compiledScene={scene()}
        mapTransform={{ x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 90 }}
        viewers={[{ x: 50, y: 150 }]}
      />,
    );

    expect(groupProps[0]).toMatchObject({ x: 7, y: 8, scaleX: 1.5, scaleY: 1.5 });
    expect(groupProps[1]).toMatchObject({ x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 90 });
  });
});
