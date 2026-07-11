// ============================================================================
// PROPSLAYER COMPONENT TESTS
// ============================================================================
// Pins the cell<->pixel round-trip on prop drags: props render at cell-center
// (x*gridSize + gridSize/2), so drag-end must subtract the half-cell when
// converting back. Regression for the +0.5-cell-per-drag drift.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { PropsLayer } from "../PropsLayer";
import type { SceneObject } from "@herobyte/shared";
import type { Camera } from "../../types";

type MockProps = Record<string, unknown> & { children?: ReactNode };

const rectProps: MockProps[] = [];
const imageProps: MockProps[] = [];

vi.mock("react-konva", () => ({
  Group: ({ children }: MockProps) => <div data-testid="konva-group">{children}</div>,
  Rect: (props: MockProps) => {
    rectProps.push(props);
    return <div data-testid="konva-rect" />;
  },
  Image: (props: MockProps) => {
    imageProps.push(props);
    return <div data-testid="konva-image" />;
  },
}));

// Keep the sprite on its Rect placeholder path — no image loading in jsdom.
vi.mock("use-image", () => ({ default: () => [undefined, "loading"] }));

const cam: Camera = { x: 0, y: 0, scale: 1 };
const GRID = 50;

function prop(cellX: number, cellY: number): SceneObject & { type: "prop" } {
  return {
    id: "prop-1",
    type: "prop",
    zIndex: 1,
    locked: false,
    transform: { x: cellX, y: cellY, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { imageUrl: "https://example.test/crate.png", size: "medium" },
  };
}

/** The draggable placeholder Rect rendered for the prop sprite. */
function spriteRect(): MockProps {
  const sprite = rectProps.find((props) => props.name === "prop-1");
  expect(sprite).toBeDefined();
  return sprite!;
}

/** Konva-shaped drag event whose target sits at the sprite's current node position. */
function dragEventAt(nodeX: number, nodeY: number, size: number) {
  return {
    target: {
      x: () => nodeX,
      y: () => nodeY,
      width: () => size,
      height: () => size,
    },
  };
}

describe("PropsLayer drag round-trip", () => {
  beforeEach(() => {
    rectProps.length = 0;
    imageProps.length = 0;
  });

  it("reports the same cell when a prop is dropped where it already sits", () => {
    const onTransformProp = vi.fn();
    render(
      <PropsLayer
        cam={cam}
        sceneObjects={[prop(2, 3)]}
        gridSize={GRID}
        interactive
        onTransformProp={onTransformProp}
      />,
    );

    const sprite = spriteRect();
    const size = sprite.width as number;
    const onDragEnd = sprite.onDragEnd as (event: unknown) => void;
    onDragEnd(dragEventAt(sprite.x as number, sprite.y as number, size));

    expect(onTransformProp).toHaveBeenCalledWith("prop-1", { x: 2, y: 3 });
  });

  it("reports one cell over when dragged exactly one grid cell", () => {
    const onTransformProp = vi.fn();
    render(
      <PropsLayer
        cam={cam}
        sceneObjects={[prop(2, 3)]}
        gridSize={GRID}
        interactive
        onTransformProp={onTransformProp}
      />,
    );

    const sprite = spriteRect();
    const size = sprite.width as number;
    const onDragEnd = sprite.onDragEnd as (event: unknown) => void;
    onDragEnd(dragEventAt((sprite.x as number) + GRID, (sprite.y as number) + GRID, size));

    expect(onTransformProp).toHaveBeenCalledWith("prop-1", { x: 3, y: 4 });
  });

  it("stays put across repeated drop-in-place drags (no cumulative drift)", () => {
    const onTransformProp = vi.fn();
    let sceneObjects = [prop(2, 3)];
    const { rerender } = render(
      <PropsLayer
        cam={cam}
        sceneObjects={sceneObjects}
        gridSize={GRID}
        interactive
        onTransformProp={onTransformProp}
      />,
    );

    for (let i = 0; i < 3; i++) {
      const sprite = rectProps[rectProps.length - 1]!;
      const size = sprite.width as number;
      const onDragEnd = sprite.onDragEnd as (event: unknown) => void;
      onDragEnd(dragEventAt(sprite.x as number, sprite.y as number, size));

      const [, position] = onTransformProp.mock.calls[onTransformProp.mock.calls.length - 1]!;
      sceneObjects = [
        {
          ...sceneObjects[0]!,
          transform: { ...sceneObjects[0]!.transform, x: position.x, y: position.y },
        },
      ];
      rerender(
        <PropsLayer
          cam={cam}
          sceneObjects={sceneObjects}
          gridSize={GRID}
          interactive
          onTransformProp={onTransformProp}
        />,
      );
    }

    expect(sceneObjects[0]!.transform.x).toBe(2);
    expect(sceneObjects[0]!.transform.y).toBe(3);
  });
});
