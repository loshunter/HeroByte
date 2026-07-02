// ============================================================================
// DOORSLAYER COMPONENT TESTS
// ============================================================================
// Verifies door sprites render per state, stay aligned under the map
// transform, and route clicks (toggle) and DM alt-clicks (lock cycle).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { DoorsLayer } from "../DoorsLayer";
import type { CompiledDoor } from "@herobyte/shared";
import type { Camera } from "../../types";

type MockProps = Record<string, unknown> & { children?: ReactNode };

const lineProps: MockProps[] = [];
const rectProps: MockProps[] = [];
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
  Rect: (props: MockProps) => {
    rectProps.push(props);
    return <div data-testid="konva-rect" />;
  },
}));

const cam: Camera = { x: 12, y: 34, scale: 2 };

function door(overrides: Partial<CompiledDoor> = {}): CompiledDoor {
  return {
    id: "door-1",
    x1: 100,
    y1: 200,
    x2: 150,
    y2: 200,
    state: "closed",
    blocksMovement: true,
    blocksVision: true,
    ...overrides,
  };
}

function hitLine(doorId = "door-1"): MockProps {
  const hit = lineProps.find((props) => props.name === `door-hit:${doorId}`);
  expect(hit).toBeDefined();
  return hit!;
}

function clickEvent(altKey: boolean) {
  return { cancelBubble: false, evt: { altKey } };
}

describe("DoorsLayer", () => {
  beforeEach(() => {
    lineProps.length = 0;
    rectProps.length = 0;
    groupProps.length = 0;
  });

  it("renders nothing when there are no doors", () => {
    const { container } = render(
      <DoorsLayer
        cam={cam}
        doors={[]}
        isDM={false}
        onToggleDoor={vi.fn()}
        onSetDoorState={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("nests the camera and map transforms exactly like the background image", () => {
    render(
      <DoorsLayer
        cam={cam}
        doors={[door()]}
        mapTransform={{ x: 5, y: 6, scaleX: 2, scaleY: 3, rotation: 45 }}
        isDM={false}
        onToggleDoor={vi.fn()}
        onSetDoorState={vi.fn()}
      />,
    );

    expect(groupProps[0]).toMatchObject({ x: 12, y: 34, scaleX: 2, scaleY: 2 });
    expect(groupProps[1]).toMatchObject({ x: 5, y: 6, scaleX: 2, scaleY: 3, rotation: 45 });
  });

  it("renders a closed door as a solid bar with a frame", () => {
    render(
      <DoorsLayer
        cam={cam}
        doors={[door()]}
        isDM={false}
        onToggleDoor={vi.fn()}
        onSetDoorState={vi.fn()}
      />,
    );

    const solidBody = lineProps.find(
      (props) => props.stroke === "#c99b55" && props.strokeWidth === 6,
    );
    expect(solidBody).toMatchObject({ points: [100, 200, 150, 200] });
    expect(rectProps).toHaveLength(0);
  });

  it("renders an open door as two hinge stubs", () => {
    render(
      <DoorsLayer
        cam={cam}
        doors={[door({ state: "open" })]}
        isDM={false}
        onToggleDoor={vi.fn()}
        onSetDoorState={vi.fn()}
      />,
    );

    const stubs = lineProps.filter((props) => props.stroke === "#c99b55");
    expect(stubs).toHaveLength(2);
    expect(stubs[0]?.points).toEqual([100, 200, 114, 200]);
    expect(stubs[1]?.points).toEqual([150, 200, 136, 200]);
  });

  it("marks locked doors with a lock badge", () => {
    render(
      <DoorsLayer
        cam={cam}
        doors={[door({ state: "locked" })]}
        isDM={false}
        onToggleDoor={vi.fn()}
        onSetDoorState={vi.fn()}
      />,
    );

    expect(rectProps).toHaveLength(1);
    expect(rectProps[0]).toMatchObject({ x: 120, y: 195, fill: "#ffd75e" });
  });

  it("renders secret doors as a dashed seam", () => {
    render(
      <DoorsLayer
        cam={cam}
        doors={[door({ state: "secret" })]}
        isDM
        onToggleDoor={vi.fn()}
        onSetDoorState={vi.fn()}
      />,
    );

    const seam = lineProps.find((props) => props.stroke === "#7ce0d3");
    expect(seam).toMatchObject({ dash: [6, 4] });
  });

  it("sends a toggle when a door is clicked", () => {
    const onToggleDoor = vi.fn();
    render(
      <DoorsLayer
        cam={cam}
        doors={[door()]}
        isDM={false}
        onToggleDoor={onToggleDoor}
        onSetDoorState={vi.fn()}
      />,
    );

    (hitLine().onClick as (event: unknown) => void)(clickEvent(false));
    expect(onToggleDoor).toHaveBeenCalledWith("door-1");
  });

  it("alt-click as DM runs the lock cycle instead of toggling", () => {
    const onToggleDoor = vi.fn();
    const onSetDoorState = vi.fn();
    render(
      <DoorsLayer
        cam={cam}
        doors={[
          door(),
          door({ id: "door-2", state: "locked" }),
          door({ id: "door-3", state: "secret" }),
        ]}
        isDM
        onToggleDoor={onToggleDoor}
        onSetDoorState={onSetDoorState}
      />,
    );

    (hitLine("door-1").onClick as (event: unknown) => void)(clickEvent(true));
    expect(onSetDoorState).toHaveBeenCalledWith("door-1", "locked");

    (hitLine("door-2").onClick as (event: unknown) => void)(clickEvent(true));
    expect(onSetDoorState).toHaveBeenCalledWith("door-2", "closed");

    (hitLine("door-3").onClick as (event: unknown) => void)(clickEvent(true));
    expect(onSetDoorState).toHaveBeenCalledWith("door-3", "closed");
    expect(onToggleDoor).not.toHaveBeenCalled();
  });

  it("alt-click as a player still toggles rather than setting state", () => {
    const onToggleDoor = vi.fn();
    const onSetDoorState = vi.fn();
    render(
      <DoorsLayer
        cam={cam}
        doors={[door()]}
        isDM={false}
        onToggleDoor={onToggleDoor}
        onSetDoorState={onSetDoorState}
      />,
    );

    (hitLine().onClick as (event: unknown) => void)(clickEvent(true));
    expect(onToggleDoor).toHaveBeenCalledWith("door-1");
    expect(onSetDoorState).not.toHaveBeenCalled();
  });
});
