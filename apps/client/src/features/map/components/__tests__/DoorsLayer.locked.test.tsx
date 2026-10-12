// A player's click on a locked door used to send a toggle the server refused
// ("Door is locked") — and the client only logged nack reasons to the console,
// so the press answered with nothing at all. The sprite knows the door is
// locked, so it says so before sending: a toast (lockNotice → App) and a latch
// rattle only the one who tried hears. The DM still forces any door.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { CompiledDoor } from "@herobyte/shared";
import { DoorsLayer } from "../DoorsLayer";
import { onLockNotice } from "../../../locking/lockNotice";
import { sfxEngine } from "../../../juice/sfxEngine";

type MockProps = Record<string, unknown> & { children?: ReactNode };
const lineProps: MockProps[] = [];

vi.mock("react-konva", () => ({
  Group: ({ children }: MockProps) => <div>{children}</div>,
  Line: (props: MockProps) => {
    lineProps.push(props);
    return <div />;
  },
  Rect: () => <div />,
}));

const lockedDoor: CompiledDoor = {
  id: "door-1",
  x1: 100,
  y1: 200,
  x2: 150,
  y2: 200,
  state: "locked",
  blocksMovement: true,
  blocksVision: true,
};

const click = { cancelBubble: false, evt: { button: 0, clientX: 50, clientY: 50, altKey: false } };

function clickLockedDoor(isDM: boolean) {
  const onToggleDoor = vi.fn();
  const heard: (string | undefined)[] = [];
  const off = onLockNotice((message) => heard.push(message));
  render(
    <DoorsLayer
      linkAimArmed={false}
      selectArmed={false}
      cam={{ x: 0, y: 0, scale: 1 }}
      doors={[lockedDoor]}
      isDM={isDM}
      onToggleDoor={onToggleDoor}
      onSetDoorState={vi.fn()}
    />,
  );
  const hit = lineProps.find((props) => props.name === "door-hit:door-1");
  (hit!.onClick as (event: unknown) => void)(click);
  off();
  return { onToggleDoor, heard };
}

describe("a locked door answers the click", () => {
  beforeEach(() => {
    lineProps.length = 0;
    vi.spyOn(sfxEngine, "play").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a player is told it is locked, hears the latch, and nothing is sent", () => {
    const { onToggleDoor, heard } = clickLockedDoor(false);
    expect(heard).toEqual(["This door is locked. Only the DM can open it."]);
    expect(sfxEngine.play).toHaveBeenCalledWith("doorClunk", expect.anything());
    expect(onToggleDoor).not.toHaveBeenCalled();
  });

  it("the DM still forces it, without the notice or the rattle", () => {
    const { onToggleDoor, heard } = clickLockedDoor(true);
    expect(onToggleDoor).toHaveBeenCalledWith("door-1");
    expect(heard).toEqual([]);
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });
});
