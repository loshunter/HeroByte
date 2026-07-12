import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { CompiledWallSegment } from "@herobyte/shared";
import { WallsOverlayLayer } from "../WallsOverlayLayer";
import type { Camera } from "../../map/types";

type MockProps = Record<string, unknown> & { children?: ReactNode };

const lineProps: MockProps[] = [];
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
}));

const cam: Camera = { x: 10, y: 20, scale: 2 };

function wall(id: string, x1: number, y1: number, x2: number, y2: number): CompiledWallSegment {
  return { id, x1, y1, x2, y2, blocksMovement: true, blocksVision: true };
}

describe("WallsOverlayLayer", () => {
  beforeEach(() => {
    lineProps.length = 0;
    groupProps.length = 0;
  });

  it("renders nothing when there are no walls", () => {
    const { container } = render(<WallsOverlayLayer cam={cam} walls={[]} />);
    expect(container.querySelector('[data-testid="konva-line"]')).toBeNull();
  });

  it("draws each wall as a subtle cam-scaled line", () => {
    render(
      <WallsOverlayLayer
        cam={cam}
        walls={[wall("w1#0", 0, 0, 100, 0), wall("w2#0", 0, 0, 0, 50)]}
      />,
    );

    expect(lineProps).toHaveLength(2);
    expect(lineProps[0]!.points).toEqual([0, 0, 100, 0]);
    expect(lineProps[0]!.strokeWidth).toBe(1); // 2 / cam.scale(2)
    expect(lineProps[0]!.opacity).toBe(0.35);
    // Overlay is scenery, never interactive.
    expect(lineProps.every((l) => l.listening === false)).toBe(true);
  });
});
