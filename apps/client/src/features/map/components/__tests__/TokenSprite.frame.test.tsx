// A framed token (C5a) through the real TokensLayer: a circle, its selection
// outline on the frame's outer circle, its hit area reaching a grown-out
// frame, and a frame that never turns with the token. react-konva is mocked
// to divs carrying their props; the bake is replaced by a fixed drawing.

import { forwardRef, type ComponentProps, type ReactNode, type Ref } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { layoutFrame, presetFrame, type SceneObject, type TokenFrame } from "@herobyte/shared";
import type { FrameBitmapRequest } from "../../../render/frame/useFrameBitmap";

const propsOf = new WeakMap<HTMLElement, Record<string, unknown>>();
function mock(testId: string) {
  return forwardRef<HTMLElement, { children?: ReactNode; [key: string]: unknown }>(function Mock(
    { children, ...props },
    ref: Ref<HTMLElement>,
  ) {
    return (
      <div
        data-testid={testId}
        ref={(element) => {
          if (element) propsOf.set(element, props);
          if (typeof ref === "function") ref(element);
        }}
      >
        {children as ReactNode}
      </div>
    );
  });
}
vi.mock("react-konva", () => ({
  Group: mock("group"),
  Rect: mock("rect"),
  Image: mock("image"),
  Circle: mock("circle"),
  Line: mock("line"),
  Text: mock("text"),
}));
vi.mock("use-image", () => ({ default: () => [undefined, "loading"] }));
const requests: (FrameBitmapRequest | null)[] = [];
const BITMAP = { width: 256, height: 256 };
vi.mock("../../../render/frame/useFrameBitmap", () => ({
  useFrameBitmap: (request: FrameBitmapRequest | null) => {
    requests.push(request);
    if (!request) return null;
    const layout = layoutFrame(request.frame, request.size);
    return { bitmap: BITMAP, extent: layout.extent, layout, tier: 256 };
  },
}));

vi.mock("../LockIndicator", () => ({
  LockIndicator: ({ y }: { y: number }) => <div data-testid="lock" data-y={y} />,
}));

const { TokensLayer } = await import("../TokensLayer");
const { framePose, frameOutset } = await import("../TokenFrameOverlay");

const token = (frame?: TokenFrame, rotation = 0): SceneObject & { type: "token" } => ({
  id: "token:t1",
  type: "token",
  owner: "me",
  locked: false,
  zIndex: 10,
  transform: { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation },
  data: { color: "#390076", size: "medium", ...(frame ? { frame } : {}) },
});
const props = (object: SceneObject, selected = false): ComponentProps<typeof TokensLayer> => ({
  cam: { x: 0, y: 0, scale: 2 },
  sceneObjects: [object],
  uid: "me",
  gridSize: 50,
  hoveredTokenId: null,
  onHover: vi.fn(),
  onTransformToken: vi.fn(),
  onRecolorToken: vi.fn(),
  snapToGrid: true,
  selectedObjectIds: selected ? [object.id] : [],
  isDM: false,
});
const all = (id: string) => screen.queryAllByTestId(id).map((element) => propsOf.get(element)!);
const SIZE = 50 * 0.75;

describe("a framed token on the map", () => {
  it("is a circle with the frame over it, the outline on the frame's outer edge", () => {
    render(<TokensLayer {...props(token(presetFrame("plain.ring")!), true)} />);
    const node = all("rect").find((rect) => rect.name === "token:t1")!;
    expect(node.cornerRadius).toBe(SIZE / 2);
    expect(node.stroke).toBe("transparent");
    expect(node.hitStrokeWidth).toBeCloseTo(3 / 2); // no reach past the box growing in
    const frameImage = all("image").find((image) => image.image === BITMAP)!;
    const extent = layoutFrame(presetFrame("plain.ring")!).extent;
    expect(frameImage.width).toBeCloseTo(2 * extent * SIZE);
    const outline = all("circle").find((circle) => circle.radius === 0.5 * SIZE)!;
    expect(outline.stroke).toBe("#447DF7");
    expect(requests.at(-1)).toMatchObject({ tokenId: "t1", color: "#390076", zoom: 2 });
  });

  it("reaches its hit area and outline past the box when it grows out", () => {
    const out = { ...presetFrame("plain.ring", 0.24)!, growth: "out" as const };
    render(<TokensLayer {...props(token(out), true)} />);
    const node = all("rect").find((rect) => rect.name === "token:t1")!;
    expect(node.hitStrokeWidth).toBeCloseTo(3 / 2 + 2 * 0.15 * SIZE);
    expect(all("circle").some((circle) => circle.radius === 0.65 * SIZE)).toBe(true);
  });

  it("does not turn with the token: the light stays where it is", () => {
    render(<TokensLayer {...props(token(presetFrame("stone.castle")!, 45))} />);
    const node = all("rect").find((rect) => rect.name === "token:t1")!;
    expect(node.rotation).toBe(45);
    const frameGroup = all("group").find(
      (group) => group.scaleX === 1 && group.listening === false,
    );
    expect(frameGroup).toBeDefined();
    expect(frameGroup!.rotation).toBe(0);
  });

  it("leaves a token from before frames exactly as it was", () => {
    render(<TokensLayer {...props(token(), true)} />);
    const node = all("rect").find((rect) => rect.name === "token:t1")!;
    expect(node.cornerRadius).toBe(50 / 8);
    expect(node.stroke).toBe("#447DF7");
    expect(node.hitStrokeWidth).toBeUndefined();
    expect(all("image").some((image) => image.image === BITMAP)).toBe(false);
    expect(requests.at(-1)).toBeNull();
  });

  it("turns with a stretched token and never mirrors, so its oval stays on the picture", () => {
    expect(framePose(2, 1, 45)).toEqual({ scaleX: 2, scaleY: 1, rotation: 45 });
    expect(framePose(1, 1, 45)).toEqual({ scaleX: 1, scaleY: 1, rotation: 0 });
    expect(framePose(-1.5, 1.5, 30)).toEqual({ scaleX: 1.5, scaleY: 1.5, rotation: 0 });
  });

  it("lifts a locked token's padlock clear of a grown-out frame", () => {
    const locked = (frame: TokenFrame) => ({ ...token(frame), locked: true });
    const { unmount } = render(<TokensLayer {...props(locked(presetFrame("plain.ring")!))} />);
    const lockIn = Number(screen.getByTestId("lock").dataset.y);
    unmount();
    const out = { ...presetFrame("plain.ring", 0.24)!, growth: "out" as const };
    render(<TokensLayer {...props(locked(out))} />);
    const lockOut = Number(screen.getByTestId("lock").dataset.y);
    expect(lockIn - lockOut).toBeCloseTo(50 * 0.15 * 0.75);
    expect(frameOutset(out, "medium")).toBeCloseTo(0.15);
  });
});

describe("a polygon frame on the map (C5b)", () => {
  it("clips the picture to its shape, outlines its outer edge and hits on its shape", () => {
    const hexagon = { ...presetFrame("plain.ring")!, shape: "hexagon" as const };
    render(<TokensLayer {...props(token(hexagon), true)} />);
    const node = all("rect").find((rect) => rect.name === "token:t1")!;
    expect(node.cornerRadius).toBe(0); // no round clip: the shape's own
    expect(typeof node.hitFunc).toBe("function");
    expect(node.hitStrokeWidth).toBeUndefined();
    // drawn by the node itself: a group's clip would clip its hit area too
    expect(typeof node.sceneFunc).toBe("function");
    expect(all("group").some((group) => typeof group.clipFunc === "function")).toBe(false);
    const outline = all("line").find((line) => line.stroke === "#447DF7")!;
    expect(outline.closed).toBe(true);
    expect((outline.points as number[]).length).toBe(14); // a hexagon's seven points from the top
    expect(all("circle").some((circle) => circle.stroke === "#447DF7")).toBe(false);
  });

  it("keeps a circle frame drawn as before: round, no clip group, no hit function", () => {
    render(<TokensLayer {...props(token(presetFrame("plain.ring")!), true)} />);
    const node = all("rect").find((rect) => rect.name === "token:t1")!;
    expect(node.cornerRadius).toBe(SIZE / 2);
    expect(node.hitFunc).toBeUndefined();
    expect(node.sceneFunc).toBeUndefined();
  });
});

describe("the map's one frame budget", () => {
  const many = (frame: TokenFrame, count = 30) =>
    [...Array(count)].map((_, index) => ({ ...token(frame), id: `token:t${index}` }));
  const layer = (objects: SceneObject[]) => ({ ...props(objects[0]!), sceneObjects: objects });

  it("caps every framed token at the tier thirty different frames fit the cache at", () => {
    requests.length = 0;
    render(<TokensLayer {...layer(many(presetFrame("stone.castle")!))} />);
    const asked = requests.filter((request) => request !== null);
    expect(asked.length).toBeGreaterThanOrEqual(30); // every token, every render
    for (const request of asked) expect(request!.budget).toEqual({ tier: 512, shareSeeds: false });
  });

  it("counts thirty alike rings as one bitmap", () => {
    requests.length = 0;
    render(<TokensLayer {...layer(many(presetFrame("plain.ring")!))} />);
    expect(requests.at(-1)!.budget).toEqual({ tier: 1024, shareSeeds: false });
  });
});
