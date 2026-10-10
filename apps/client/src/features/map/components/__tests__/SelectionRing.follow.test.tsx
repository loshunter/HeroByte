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

  it("copies the node's position, rotation and scale as they change", () => {
    const node = new Konva.Rect({ x: 10, y: 20 });
    setAttrs.mockClear();
    render(ringFor(node));
    node.x(140);
    node.rotation(30);
    node.scaleX(1.5);
    const last = setAttrs.mock.calls.at(-1)![0];
    expect(last).toEqual({ x: 140, y: 20, rotation: 30, scaleX: 1.5, scaleY: 1 });
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
