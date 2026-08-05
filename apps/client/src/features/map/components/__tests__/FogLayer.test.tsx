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
import type { FogViewer } from "../../playerLens";
import type { Camera } from "../../types";

/** Grid defaults every case shares: 50 world px per square, 5 ft per square. */
const GRID = { gridSize: 50, gridSquareSize: 5 };

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
    render(<FogLayer cam={cam} compiledScene={scene()} viewers={[]} {...GRID} />);

    expect(rectProps).toHaveLength(1);
    expect(rectProps[0]).toMatchObject({ x: 0, y: 0, width: 400, height: 300 });
  });

  it("renders no vision holes when the player has no tokens", () => {
    render(<FogLayer cam={cam} compiledScene={scene()} viewers={[]} {...GRID} />);

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
        {...GRID}
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
        {...GRID}
      />,
    );

    expect(groupProps[0]).toMatchObject({ x: 7, y: 8, scaleX: 1.5, scaleY: 1.5 });
    expect(groupProps[1]).toMatchObject({ x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 90 });
  });

  // ==========================================================================
  // S7 — per-viewer sight radius
  // ==========================================================================
  describe("sight radius", () => {
    /** The furthest a hole reaches from its viewer, in document units. */
    function reach(index: number, viewer: FogViewer): number {
      const points = lineProps[index]!.points as number[];
      let max = 0;
      for (let i = 0; i < points.length; i += 2) {
        max = Math.max(max, Math.hypot(points[i]! - viewer.x, points[i + 1]! - viewer.y));
      }
      return max;
    }

    it("keeps an unset radius unlimited — the hole still reaches the scene edge", () => {
      const viewer: FogViewer = { x: 50, y: 150 };
      render(<FogLayer cam={cam} compiledScene={scene()} viewers={[viewer]} {...GRID} />);

      // The wall at x=200 is the only thing stopping it; the scene is 400 wide.
      expect(reach(0, viewer)).toBeGreaterThan(200);
    });

    it("clips the hole to the radius when one is set", () => {
      // 10 ft = 2 squares = 100 world px at this grid.
      const viewer: FogViewer = { x: 50, y: 150, radiusFeet: 10 };
      render(<FogLayer cam={cam} compiledScene={scene()} viewers={[viewer]} {...GRID} />);

      expect(reach(0, viewer)).toBeLessThanOrEqual(100.001);
      expect(reach(0, viewer)).toBeGreaterThan(99);
    });

    it("punches no hole at all for a blind viewer", () => {
      render(
        <FogLayer
          cam={cam}
          compiledScene={scene()}
          viewers={[{ x: 50, y: 150, radiusFeet: 0 }]}
          {...GRID}
        />,
      );

      expect(lineProps).toHaveLength(0);
    });

    it("gives each viewer its own radius", () => {
      const near: FogViewer = { x: 50, y: 150, radiusFeet: 10 };
      const far: FogViewer = { x: 100, y: 100, radiusFeet: 20 };
      render(<FogLayer cam={cam} compiledScene={scene()} viewers={[near, far]} {...GRID} />);

      expect(reach(0, near)).toBeLessThanOrEqual(100.001);
      expect(reach(1, far)).toBeGreaterThan(150);
    });

    it("reads the radius in FEET, so feet-per-square changes the distance", () => {
      const viewer: FogViewer = { x: 200, y: 150, radiusFeet: 10 };
      // 10 ft at 10 ft/square is ONE square = 50 world px, half of the 5 ft case.
      render(
        <FogLayer
          cam={cam}
          compiledScene={scene()}
          viewers={[viewer]}
          gridSize={50}
          gridSquareSize={10}
        />,
      );

      expect(reach(0, viewer)).toBeLessThanOrEqual(50.001);
      expect(reach(0, viewer)).toBeGreaterThan(49);
    });

    it("divides the radius by the map scale, because the sweep is in document space", () => {
      const viewer: FogViewer = { x: 400, y: 300, radiusFeet: 10 };
      render(
        <FogLayer
          cam={cam}
          compiledScene={scene()}
          mapTransform={{ x: 0, y: 0, scaleX: 2, scaleY: 2, rotation: 0 }}
          viewers={[viewer]}
          {...GRID}
        />,
      );

      // 100 world px at scale 2 is 50 DOCUMENT px, and the points are document
      // space. Measured from the document-space origin (400/2, 300/2).
      const points = lineProps[0]!.points as number[];
      let max = 0;
      for (let i = 0; i < points.length; i += 2) {
        max = Math.max(max, Math.hypot(points[i]! - 200, points[i + 1]! - 150));
      }
      expect(max).toBeLessThanOrEqual(50.001);
      expect(max).toBeGreaterThan(49);
    });

    // The memo key is the whole reason a radius change is visible at all. It
    // used to be built from x,y only; leaving the radius out returns the
    // PREVIOUS polygons and the fog silently never repaints — which reads to a
    // DM as "the control is broken", not as a cache bug.
    it("repaints when only the radius changes", () => {
      const { rerender } = render(
        <FogLayer
          cam={cam}
          compiledScene={scene()}
          viewers={[{ x: 50, y: 150, radiusFeet: 20 }]}
          {...GRID}
        />,
      );
      const wide = lineProps.length;
      expect(wide).toBe(1);
      const wideReach = reach(0, { x: 50, y: 150 });

      lineProps.length = 0;
      rerender(
        <FogLayer
          cam={cam}
          compiledScene={scene()}
          viewers={[{ x: 50, y: 150, radiusFeet: 5 }]}
          {...GRID}
        />,
      );

      expect(reach(0, { x: 50, y: 150 })).toBeLessThan(wideReach);
    });
  });

  // The polygons are expensive (tens of ms on a large dungeon) and the whole
  // component re-renders on every wheel tick and pan frame, because `cam` is a
  // fresh object each time. These pin that the sweep is keyed on VALUES: a
  // re-parsed snapshot hands over byte-identical geometry in new objects
  // ~60x/sec during unrelated play.
  //
  // The hole elements are memoized alongside the polygons, so when nothing
  // relevant changed React sees the SAME element objects and bails out of
  // reconciling them — the mocked Line is never called again. An empty
  // lineProps after a rerender therefore means "no re-sweep, no repaint", and
  // a populated one means the layer really did redraw.
  describe("recompute discipline", () => {
    function door(state: "open" | "closed") {
      return {
        id: "d",
        x1: 200,
        y1: 100,
        x2: 200,
        y2: 140,
        state,
        blocksMovement: true,
        blocksVision: true,
      };
    }

    it("does not re-sweep when only the camera moves", () => {
      const compiledScene = scene();
      const viewers = [{ x: 50, y: 150 }];
      const { rerender } = render(
        <FogLayer cam={cam} compiledScene={compiledScene} viewers={viewers} {...GRID} />,
      );
      expect(lineProps).toHaveLength(1);

      lineProps.length = 0;
      rerender(
        <FogLayer
          cam={{ x: 99, y: 120, scale: 3 }}
          compiledScene={compiledScene}
          viewers={viewers}
          {...GRID}
        />,
      );

      expect(lineProps).toHaveLength(0);
    });

    it("does not re-sweep when the scene arrives as a new but identical object", () => {
      const { rerender } = render(
        <FogLayer cam={cam} compiledScene={scene()} viewers={[{ x: 50, y: 150 }]} {...GRID} />,
      );
      expect(lineProps).toHaveLength(1);

      lineProps.length = 0;
      // A fresh parse of the same broadcast — new objects, same geometry. This
      // happens on every chat message, dice roll and HP change.
      rerender(
        <FogLayer cam={cam} compiledScene={scene()} viewers={[{ x: 50, y: 150 }]} {...GRID} />,
      );

      expect(lineProps).toHaveLength(0);
    });

    it("does not re-sweep when a new but identical map transform arrives", () => {
      const transform = () => ({ x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 0 });
      const { rerender } = render(
        <FogLayer
          cam={cam}
          compiledScene={scene()}
          mapTransform={transform()}
          viewers={[{ x: 50, y: 150 }]}
          {...GRID}
        />,
      );
      expect(lineProps).toHaveLength(1);

      lineProps.length = 0;
      // useSceneObjects clones every transform per snapshot, so this object is
      // new on every single delta when the table has a raster background.
      rerender(
        <FogLayer
          cam={cam}
          compiledScene={scene()}
          mapTransform={transform()}
          viewers={[{ x: 50, y: 150 }]}
          {...GRID}
        />,
      );

      expect(lineProps).toHaveLength(0);
    });

    it("DOES re-sweep when a door opens", () => {
      const shut = scene();
      shut.doors = [door("closed")];
      const { rerender } = render(
        <FogLayer cam={cam} compiledScene={shut} viewers={[{ x: 50, y: 150 }]} {...GRID} />,
      );
      expect(lineProps).toHaveLength(1);

      lineProps.length = 0;
      const open = scene();
      open.doors = [door("open")];
      rerender(<FogLayer cam={cam} compiledScene={open} viewers={[{ x: 50, y: 150 }]} {...GRID} />);

      expect(lineProps).toHaveLength(1);
    });

    it("DOES re-sweep when a viewer moves", () => {
      const compiledScene = scene();
      const { rerender } = render(
        <FogLayer
          cam={cam}
          compiledScene={compiledScene}
          viewers={[{ x: 50, y: 150 }]}
          {...GRID}
        />,
      );

      lineProps.length = 0;
      rerender(
        <FogLayer
          cam={cam}
          compiledScene={compiledScene}
          viewers={[{ x: 60, y: 150 }]}
          {...GRID}
        />,
      );

      expect(lineProps).toHaveLength(1);
    });
  });
});
