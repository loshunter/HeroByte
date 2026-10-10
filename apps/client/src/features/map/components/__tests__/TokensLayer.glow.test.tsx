// The selected token's pulsing glow: in the viewer's colour, and only at
// "full" motion. jsdom has no canvas, so the token's Konva node is a fake that
// records shadow calls and the animation loop is captured and stepped by hand.

import { forwardRef, useLayoutEffect, type ComponentProps, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneObject } from "@herobyte/shared";
import { SelectionPaletteContext, selectionPalette } from "../../selectionPalette";

const frames: Array<(frame: { time: number }) => void> = [];
const shadowColors: string[] = [];
let decorativeOff = false;

const fakeNode = () => ({
  getLayer: () => ({}),
  to: () => undefined,
  position: () => undefined,
  scale: () => undefined,
  shadowColor: (color: string) => shadowColors.push(color),
  shadowBlur: () => undefined,
  shadowOpacity: () => undefined,
  on: () => undefined,
  off: () => undefined,
  x: () => 0,
  y: () => 0,
  rotation: () => 0,
  scaleX: () => 1,
  scaleY: () => 1,
  setAttrs: () => undefined,
});

vi.mock("konva", () => ({
  default: {
    Animation: class {
      constructor(step: (frame: { time: number }) => void) {
        frames.push(step);
      }
      start() {}
      stop() {}
    },
    Tween: class {
      play() {}
      destroy() {}
    },
    Easings: {},
  },
}));

const konvaShape = () =>
  forwardRef<unknown, { children?: ReactNode }>(function Shape({ children }, ref) {
    useLayoutEffect(() => {
      if (typeof ref === "function") ref(fakeNode());
    }, [ref]);
    return <div>{children}</div>;
  });

vi.mock("react-konva", () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Rect: konvaShape(),
  Image: konvaShape(),
  Circle: () => <div />,
  Text: () => <div />,
}));

vi.mock("use-image", () => ({ default: () => [undefined, "loading"] }));
vi.mock("../LockIndicator", () => ({ LockIndicator: () => <div /> }));
vi.mock("../../../juice", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  decorativeMotionDisabled: () => decorativeOff,
  motionDisabled: () => false,
  useSfx: () => ({ play: () => undefined }),
}));

const { TokensLayer } = await import("../TokensLayer");

const token = {
  id: "token:1",
  type: "token",
  owner: "user-1",
  locked: false,
  zIndex: 0,
  transform: { x: 1, y: 1, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { color: "#ffc2d3", size: "medium" },
} as unknown as SceneObject;

function renderSelected() {
  return render(
    <SelectionPaletteContext.Provider value={selectionPalette("#390076")}>
      <TokensLayer
        {...({
          cam: { x: 0, y: 0, scale: 1 },
          sceneObjects: [token],
          uid: "user-1",
          gridSize: 50,
          selectedObjectIds: ["token:1"],
          hoveredTokenId: null,
          onHover: () => undefined,
          onTransformToken: () => undefined,
          onRecolorToken: () => undefined,
        } as unknown as ComponentProps<typeof TokensLayer>)}
      />
    </SelectionPaletteContext.Provider>,
  );
}

describe("selected token glow", () => {
  beforeEach(() => {
    frames.length = 0;
    shadowColors.length = 0;
  });

  it("pulses in the viewer's colour at full motion", () => {
    decorativeOff = false;
    renderSelected();
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((step) => step({ time: 250 }));
    // The viewer's colour, lifted so a deep shade still glows on a dark map.
    expect(shadowColors).toContain(selectionPalette("#390076").glow);
    expect(shadowColors).not.toContain("#447DF7");
  });

  it("does not glow at subtle or off motion (the outline stays)", () => {
    decorativeOff = true;
    renderSelected();
    expect(frames).toHaveLength(0);
  });
});
