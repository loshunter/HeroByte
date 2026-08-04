/**
 * Component tests for MeasureLayer (S6)
 *
 * The readout is the product here — "2 Squares (10 ft)" is the whole feature —
 * so these assert the RENDERED TEXT under each diagonal rule, plus the two
 * things a broadcast measurement has to get right: everyone else's line shows
 * up with their name on it, and a cleared line disappears.
 *
 * Before S6 neither this component nor usePointerTool had a test at all, and
 * MapBoard.test.tsx mocks both out, so the Euclidean bug (arc defect D11) had
 * nowhere to be caught.
 *
 * Source: apps/client/src/features/map/components/MeasureLayer.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import type { MeasureEvent } from "@herobyte/shared";
import { MeasureLayer } from "../MeasureLayer";
import type { Camera } from "../../types";

vi.mock("react-konva", () => ({
  Group: ({ children }: PropsWithChildren) => <div data-testid="konva-group">{children}</div>,
  Line: (props: Record<string, unknown>) => (
    <div data-testid="konva-line" data-points={JSON.stringify(props.points)} />
  ),
  Circle: (props: Record<string, unknown>) => (
    <div data-testid="konva-circle" data-x={props.x} data-y={props.y} />
  ),
  Text: (props: Record<string, unknown>) => (
    <div data-testid="konva-text" data-fill={props.fill}>
      {String(props.text)}
    </div>
  ),
}));

const CAM: Camera = { x: 0, y: 0, scale: 1 };
const GRID = 50;

/** Centre of cell (cx, cy) — where a token sits. */
function cell(cx: number, cy: number) {
  return { x: cx * GRID + GRID / 2, y: cy * GRID + GRID / 2 };
}

function readouts(): string[] {
  return screen.queryAllByTestId("konva-text").map((node) => node.textContent ?? "");
}

function linePoints(): number[][] {
  return screen
    .queryAllByTestId("konva-line")
    .map((node) => JSON.parse(node.getAttribute("data-points") ?? "[]") as number[]);
}

describe("MeasureLayer", () => {
  it("renders nothing when nobody is measuring", () => {
    const { container } = render(
      <MeasureLayer cam={CAM} measureStart={null} measureEnd={null} gridSize={GRID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  describe("the diagonal rule decides the number", () => {
    it("reads a two-square diagonal as 10 ft under 5e — arc defect D11", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={cell(0, 0)}
          measureEnd={cell(2, 2)}
          gridSize={GRID}
          gridSquareSize={5}
          diagonalRule="5e"
        />,
      );
      expect(readouts()).toEqual(["2 Squares (10 ft)"]);
    });

    it("reads the same diagonal as 15 ft under pathfinder", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={cell(0, 0)}
          measureEnd={cell(2, 2)}
          gridSize={GRID}
          gridSquareSize={5}
          diagonalRule="pathfinder"
        />,
      );
      expect(readouts()).toEqual(["3 Squares (15 ft)"]);
    });

    it("still offers the old Euclidean reading when a table asks for it", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={{ x: 0, y: 0 }}
          measureEnd={{ x: 100, y: 100 }}
          gridSize={GRID}
          gridSquareSize={5}
          diagonalRule="euclidean"
        />,
      );
      expect(readouts()).toEqual(["2.8 Squares (14 ft)"]);
    });

    it("defaults to 5e when the room sent no rule", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={cell(0, 0)}
          measureEnd={cell(2, 2)}
          gridSize={GRID}
        />,
      );
      expect(readouts()).toEqual(["2 Squares (10 ft)"]);
    });
  });

  it("draws the line between the cells the rule actually counted", () => {
    // Dragged from inside cell (0,0) to inside cell (2,2); the drawn line
    // snaps to those cells' centres so it describes the number shown.
    render(
      <MeasureLayer
        cam={CAM}
        measureStart={{ x: 12, y: 33 }}
        measureEnd={{ x: 141, y: 108 }}
        gridSize={GRID}
        diagonalRule="5e"
      />,
    );
    expect(linePoints()).toEqual([[25, 25, 125, 125]]);
  });

  it("leaves an off-grid euclidean line exactly where it was drawn", () => {
    render(
      <MeasureLayer
        cam={CAM}
        measureStart={{ x: 12, y: 33 }}
        measureEnd={{ x: 141, y: 108 }}
        gridSize={GRID}
        diagonalRule="euclidean"
      />,
    );
    expect(linePoints()).toEqual([[12, 33, 141, 108]]);
  });

  describe("other people's measurements", () => {
    const remote: MeasureEvent = {
      uid: "bob",
      name: "Bob",
      start: cell(0, 0),
      end: cell(3, 0),
    };

    it("labels a remote line with whose it is", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={null}
          measureEnd={null}
          gridSize={GRID}
          remoteMeasurements={[remote]}
        />,
      );
      expect(readouts()).toEqual(["Bob: 3 Squares (15 ft)"]);
    });

    it("measures a remote line by the same room rule as your own", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={null}
          measureEnd={null}
          gridSize={GRID}
          diagonalRule="pathfinder"
          remoteMeasurements={[{ ...remote, start: cell(0, 0), end: cell(2, 2) }]}
        />,
      );
      // The whole point of a shared rule: Bob's line reads what mine would.
      expect(readouts()).toEqual(["Bob: 3 Squares (15 ft)"]);
    });

    it("draws yours alongside theirs, in a different colour", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={cell(0, 0)}
          measureEnd={cell(1, 0)}
          gridSize={GRID}
          remoteMeasurements={[remote]}
        />,
      );
      const texts = screen.getAllByTestId("konva-text");
      expect(texts).toHaveLength(2);
      const colours = texts.map((node) => node.getAttribute("data-fill"));
      expect(new Set(colours).size).toBe(2);
    });

    it("draws nothing for an endpoint-less entry — that IS the clear signal", () => {
      const { container } = render(
        <MeasureLayer
          cam={CAM}
          measureStart={null}
          measureEnd={null}
          gridSize={GRID}
          remoteMeasurements={[{ uid: "bob", name: "Bob" }]}
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("draws one line per player", () => {
      render(
        <MeasureLayer
          cam={CAM}
          measureStart={null}
          measureEnd={null}
          gridSize={GRID}
          remoteMeasurements={[
            remote,
            { uid: "carol", name: "Carol", start: cell(0, 0), end: cell(1, 1) },
          ]}
        />,
      );
      expect(readouts()).toEqual(["Bob: 3 Squares (15 ft)", "Carol: 1 Squares (5 ft)"]);
    });
  });
});
