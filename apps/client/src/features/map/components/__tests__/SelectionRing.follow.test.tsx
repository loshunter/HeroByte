// The selection ring follows a real Konva node: drags, glides and the transform
// handles all set the node's attributes, and the ring copies them. When the
// piece's node is replaced (a picture loading swaps the placeholder for the
// image), the ring follows the new node and lets go of the old one.

import { forwardRef, useImperativeHandle, type ReactNode } from "react";
import { render } from "@testing-library/react";
import Konva from "konva";
import { describe, expect, it, vi } from "vitest";

const setAttrs = vi.fn();
const rects: Array<Record<string, unknown>> = [];

vi.mock("react-konva", () => ({
  Group: forwardRef<unknown, { children?: ReactNode }>(function Group({ children }, ref) {
    useImperativeHandle(ref, () => ({ setAttrs }));
    return <div>{children}</div>;
  }),
  Rect: (props: Record<string, unknown>) => {
    rects.push(props);
    return <div />;
  },
}));

const { SelectionRing } = await import("../SelectionRing");

const geometry = {
  x: 10,
  y: 20,
  width: 40,
  height: 40,
  offsetX: 20,
  offsetY: 20,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  cornerRadius: 6,
};

function ringFor(node: Konva.Node | null) {
  return (
    <SelectionRing follow={node} {...geometry} color="#390076" keyline="#f4f1e8" strokeWidth={3} />
  );
}

describe("SelectionRing", () => {
  it("draws the keyline and then the colour, both out of hit testing", () => {
    rects.length = 0;
    render(ringFor(null));
    expect(rects.map((rect) => [rect.stroke, rect.strokeWidth, rect.listening])).toEqual([
      ["#f4f1e8", 5, false],
      ["#390076", 3, false],
    ]);
  });

  it("copies each of the node's position, rotation and scale as it changes", () => {
    const node = new Konva.Rect({ x: 10, y: 20 });
    render(ringFor(node));
    const changes: Array<[string, number]> = [
      ["x", 140],
      ["y", 77],
      ["rotation", 30],
      ["scaleX", 1.5],
      ["scaleY", 2],
    ];
    for (const [attribute, value] of changes) {
      setAttrs.mockClear();
      (node as unknown as Record<string, (next: number) => void>)[attribute]!(value);
      // One copy per change, carrying the changed attribute.
      expect(setAttrs).toHaveBeenCalledTimes(1);
      expect(setAttrs.mock.calls[0]![0][attribute]).toBe(value);
    }
  });

  it("lines up at once with a node that already sits elsewhere", () => {
    const moved = new Konva.Rect({ x: 300, y: 200, rotation: 45 });
    setAttrs.mockClear();
    render(ringFor(moved));
    expect(setAttrs).toHaveBeenCalledWith({ x: 300, y: 200, rotation: 45, scaleX: 1, scaleY: 1 });
  });

  it("follows a replacement node and lets go of the old one; nothing after unmount", () => {
    const placeholder = new Konva.Rect({ x: 10, y: 20 });
    const picture = new Konva.Rect({ x: 10, y: 20 });
    const { rerender, unmount } = render(ringFor(placeholder));
    rerender(ringFor(picture));
    setAttrs.mockClear();
    placeholder.x(999);
    expect(setAttrs).not.toHaveBeenCalled();
    picture.x(80);
    expect(setAttrs.mock.calls.at(-1)![0]).toMatchObject({ x: 80 });
    unmount();
    setAttrs.mockClear();
    picture.y(999);
    expect(setAttrs).not.toHaveBeenCalled();
  });
});
