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
// Every fake node the layer was handed, by the shape that mounted it.
type FakeNode = ReturnType<typeof fakeNode>;
const mounted: Array<{ kind: string; node: FakeNode }> = [];
const ringProps: Array<{ follow: unknown }> = [];
// The ring's colour band nodes, as the ring hands them over.
const bands: FakeNode[] = [];
let imageState: [unknown, string] = [undefined, "loading"];

const fakeNode = () => {
  const node = {
    colors: [] as string[],
    opacities: [] as number[],
    getLayer: () => ({}),
    to: () => undefined,
    position: () => undefined,
    scale: () => undefined,
    shadowColor: (color: string) => {
      node.colors.push(color);
      shadowColors.push(color);
    },
    shadowBlur: () => undefined,
    shadowOpacity: (value: number) => node.opacities.push(value),
    on: () => undefined,
    off: () => undefined,
    x: () => 0,
    y: () => 0,
    rotation: () => 0,
    scaleX: () => 1,
    scaleY: () => 1,
    setAttrs: () => undefined,
  };
  return node;
};

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

// A shape hands its ref a fresh fake node whenever React gives it a new ref
// callback, as react-konva re-attaches a changed ref.
const konvaShape = (kind: string) =>
  forwardRef<unknown, { children?: ReactNode }>(function Shape({ children }, ref) {
    useLayoutEffect(() => {
      if (typeof ref !== "function") return;
      const node = fakeNode();
      mounted.push({ kind, node });
      ref(node);
      return () => ref(null);
    }, [ref]);
    return <div>{children}</div>;
  });

vi.mock("react-konva", () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Rect: konvaShape("rect"),
  Image: konvaShape("image"),
  Circle: () => <div />,
  Text: () => <div />,
}));

vi.mock("use-image", () => ({ default: () => imageState }));
vi.mock("../SelectionRing", () => ({
  SelectionRing: (props: { follow: unknown; bandRef?: (node: unknown) => void }) => {
    ringProps.push(props);
    const { bandRef } = props;
    useLayoutEffect(() => {
      if (!bandRef) return;
      const node = fakeNode();
      bands.push(node);
      bandRef(node);
      return () => bandRef(null);
    }, [bandRef]);
    return <div />;
  },
}));
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

function layer(color: string, selected = true, extra: Record<string, unknown> = {}) {
  return (
    <SelectionPaletteContext.Provider value={selectionPalette(color)}>
      <TokensLayer
        {...({
          cam: { x: 0, y: 0, scale: 1 },
          sceneObjects: [extra.object ?? token],
          uid: "user-1",
          gridSize: 50,
          selectedObjectIds: selected ? ["token:1"] : [],
          hoveredTokenId: null,
          onHover: () => undefined,
          onTransformToken: () => undefined,
          onRecolorToken: () => undefined,
          ...extra,
        } as unknown as ComponentProps<typeof TokensLayer>)}
      />
    </SelectionPaletteContext.Provider>
  );
}

function renderSelected() {
  return render(layer("#390076"));
}

describe("selected token glow", () => {
  beforeEach(() => {
    frames.length = 0;
    shadowColors.length = 0;
    mounted.length = 0;
    bands.length = 0;
    ringProps.length = 0;
    imageState = [undefined, "loading"];
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

  it("does not glow a token that is not selected", () => {
    decorativeOff = false;
    render(layer("#390076", false));
    expect(frames).toHaveLength(0);
  });

  it("glows in the new colour after the viewer recolours", () => {
    decorativeOff = false;
    const { rerender } = renderSelected();
    rerender(layer("#ffc2d3"));
    shadowColors.length = 0;
    frames.at(-1)!({ time: 500 });
    expect(shadowColors).toEqual(["#ffc2d3"]);
  });

  it("moves the glow and the ring to the picture when it loads, and lets the placeholder go", () => {
    decorativeOff = false;
    const picture = { ...token, data: { ...token.data, imageUrl: "a.png" } };
    const { rerender } = render(layer("#390076", true, { object: picture }));
    const placeholder = mounted.at(-1)!;
    expect(placeholder.kind).toBe("rect");
    expect(ringProps.at(-1)!.follow).toBe(placeholder.node);
    imageState = [{}, "loaded"];
    rerender(layer("#390076", true, { object: picture }));
    const image = mounted.at(-1)!;
    expect(image.kind).toBe("image");
    expect(ringProps.at(-1)!.follow).toBe(image.node);
    // The placeholder's glow was put out; the next frame glows the picture.
    expect(placeholder.node.opacities.at(-1)).toBe(0);
    // A ringed picture glows on its ring's colour band (a stroke-only rect), never on
    // the Image, which Konva would draw through its stage-sized buffer canvas.
    const band = { node: bands.at(-1)! };
    frames.at(-1)!({ time: 500 });
    expect(band.node.colors).toEqual([selectionPalette("#390076").glow]);
    expect(image.node.colors).toEqual([]);
  });

  it("keeps today's glow on the picture itself for a viewer with no colour", () => {
    decorativeOff = false;
    imageState = [{}, "loaded"];
    const picture = { ...token, data: { ...token.data, imageUrl: "a.png" } };
    render(
      <TokensLayer
        {...({
          cam: { x: 0, y: 0, scale: 1 },
          sceneObjects: [picture],
          uid: "user-1",
          gridSize: 50,
          selectedObjectIds: ["token:1"],
          hoveredTokenId: null,
          onHover: () => undefined,
          onTransformToken: () => undefined,
          onRecolorToken: () => undefined,
        } as unknown as ComponentProps<typeof TokensLayer>)}
      />,
    );
    const image = mounted.find((entry) => entry.kind === "image")!;
    frames.at(-1)!({ time: 500 });
    expect(image.node.colors).toEqual(["#447DF7"]);
  });

  it("hands each node over once, however often the layer re-renders", () => {
    decorativeOff = false;
    const onTokenNodeReady = vi.fn();
    const { rerender } = render(layer("#390076", true, { onTokenNodeReady }));
    rerender(layer("#390076", true, { onTokenNodeReady }));
    rerender(layer("#390076", true, { onTokenNodeReady }));
    expect(mounted).toHaveLength(1);
    expect(onTokenNodeReady.mock.calls.filter(([, node]) => node !== null)).toHaveLength(1);
  });

  it("does not glow at subtle or off motion (the outline stays)", () => {
    decorativeOff = true;
    renderSelected();
    expect(frames).toHaveLength(0);
  });
});
