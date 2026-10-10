// A selected prop's ring follows the prop's live node: the placeholder first,
// then the picture once it loads. Each node is handed over once, however often
// the layer re-renders (a changing ref callback re-attached it every render).

import { forwardRef, useLayoutEffect, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneObject } from "@herobyte/shared";
import { SelectionPaletteContext, selectionPalette } from "../../selectionPalette";

const mounted: Array<{ kind: string; node: object }> = [];
const ringProps: Array<{ follow: unknown }> = [];
let imageState: [unknown, string] = [undefined, "loading"];

const konvaShape = (kind: string) =>
  forwardRef<unknown, { children?: ReactNode }>(function Shape({ children }, ref) {
    useLayoutEffect(() => {
      if (typeof ref !== "function") return;
      const node = { kind };
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
}));
vi.mock("use-image", () => ({ default: () => imageState }));
vi.mock("../SelectionRing", () => ({
  SelectionRing: (props: { follow: unknown }) => {
    ringProps.push(props);
    return <div />;
  },
}));

const { PropsLayer } = await import("../PropsLayer");

const crate = {
  id: "prop-1",
  type: "prop",
  zIndex: 1,
  locked: false,
  transform: { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { imageUrl: "https://example.test/crate.png", size: "medium" },
} as unknown as SceneObject;

function layer(onPropNodeReady?: (id: string, node: unknown) => void) {
  return (
    <SelectionPaletteContext.Provider value={selectionPalette("#390076")}>
      <PropsLayer
        cam={{ x: 0, y: 0, scale: 1 }}
        sceneObjects={[crate]}
        gridSize={50}
        interactive
        selectedObjectIds={["prop-1"]}
        onTransformProp={vi.fn()}
        onPropNodeReady={onPropNodeReady as never}
      />
    </SelectionPaletteContext.Provider>
  );
}

describe("PropsLayer ring", () => {
  beforeEach(() => {
    mounted.length = 0;
    ringProps.length = 0;
    imageState = [undefined, "loading"];
  });

  it("follows the placeholder, then the picture once it loads", () => {
    const { rerender } = render(layer());
    expect(ringProps.at(-1)!.follow).toBe(mounted.at(-1)!.node);
    expect(mounted.at(-1)!.kind).toBe("rect");
    imageState = [{}, "loaded"];
    rerender(layer());
    expect(mounted.at(-1)!.kind).toBe("image");
    expect(ringProps.at(-1)!.follow).toBe(mounted.at(-1)!.node);
  });

  it("hands each node over once, however often the layer re-renders", () => {
    const onPropNodeReady = vi.fn();
    const { rerender } = render(layer(onPropNodeReady));
    rerender(layer(onPropNodeReady));
    rerender(layer(onPropNodeReady));
    expect(mounted).toHaveLength(1);
    expect(onPropNodeReady.mock.calls.filter(([, node]) => node !== null)).toHaveLength(1);
  });
});
