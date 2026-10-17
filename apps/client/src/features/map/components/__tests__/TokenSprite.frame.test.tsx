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

const { TokensLayer } = await import("../TokensLayer");

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
    expect(frameGroup!.rotation).toBeUndefined();
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
});
