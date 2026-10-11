// The gizmo's keyline transformer (GizmoKeyline) holds the same node as the gizmo,
// whatever happens to the selection or the viewer's colour. Each <Transformer> gets
// its OWN mock here, so a test can see which one was handed the node: the main
// TransformGizmo test gives every transformer the same ref object.

import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type Mock = {
  props: Record<string, unknown>;
  api: { nodes: ReturnType<typeof vi.fn>; rotationSnaps: ReturnType<typeof vi.fn> };
};
const h = vi.hoisted(() => ({ transformers: [] as Mock[] }));

vi.mock("react-konva", async () => {
  const React = await import("react");
  const Transformer = React.forwardRef(function MockTransformer(
    props: Record<string, unknown>,
    ref: React.Ref<unknown>,
  ) {
    const [entry] = React.useState(() => {
      const api = {
        nodes: vi.fn(),
        getStage: () => null,
        getLayer: () => ({ batchDraw: () => undefined }),
        getClientRect: () => ({ x: 0, y: 0, width: 40, height: 40 }),
        rotationSnaps: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };
      const created = { props, api };
      h.transformers.push(created);
      return created;
    });
    entry.props = props;
    React.useImperativeHandle(ref, () => entry.api, [entry]);
    return null;
  });
  const Plain = (props: { children?: ReactNode }) => <div>{props.children}</div>;
  return { Transformer, Group: Plain, Rect: Plain, Line: Plain };
});

const { TransformGizmo } = await import("../TransformGizmo");
const { SelectionPaletteContext, selectionPalette } = await import("../../selectionPalette");

afterEach(() => {
  cleanup();
  h.transformers.length = 0;
});

const token = (id: string) =>
  ({
    id,
    type: "token",
    owner: "u1",
    locked: false,
    zIndex: 0,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { color: "#ff0000", size: "medium" },
  }) as never;

const konvaNode = () => {
  const attrs: Record<string, unknown> = {};
  return {
    getAttr: (key: string) => attrs[key],
    setAttr: (key: string, value: unknown) => {
      attrs[key] = value;
    },
    draggable: vi.fn(() => false),
    on: vi.fn(),
    off: vi.fn(),
  };
};

const inColour = (ui: ReactNode, color: string | null = "#390076") => (
  <SelectionPaletteContext.Provider value={selectionPalette(color)}>
    {ui}
  </SelectionPaletteContext.Provider>
);

function split() {
  const keyline = h.transformers.find((t) => t.props.listening === false)!;
  const gizmo = h.transformers.find((t) => t.props.listening !== false)!;
  return { keyline, gizmo };
}

describe("the gizmo's keyline transformer", () => {
  it("holds the same node as the gizmo, follows a new selection, and lets go with it", () => {
    const first = konvaNode();
    const second = konvaNode();
    const gizmoFor = (id: string, node: unknown) => (
      <TransformGizmo
        selectedObject={token(id)}
        onTransform={vi.fn()}
        getNodeRef={() => node as never}
      />
    );
    const { rerender } = render(inColour(gizmoFor("a", first)));
    expect(h.transformers).toHaveLength(2);
    const { keyline, gizmo } = split();
    expect(keyline.api).not.toBe(gizmo.api);
    expect(gizmo.api.nodes).toHaveBeenLastCalledWith([first]);
    expect(keyline.api.nodes).toHaveBeenLastCalledWith([first]);

    rerender(inColour(gizmoFor("b", second)));
    expect(gizmo.api.nodes).toHaveBeenLastCalledWith([second]);
    expect(keyline.api.nodes).toHaveBeenLastCalledWith([second]);

    // Selected, but its node is gone (a picture swapped in): both let go of the old one.
    rerender(inColour(gizmoFor("b", null)));
    expect(gizmo.api.nodes).toHaveBeenLastCalledWith([]);
    expect(keyline.api.nodes).toHaveBeenLastCalledWith([]);
  });

  it("already holds the node when the viewer's colour arrives mid-transform", () => {
    const node = konvaNode();
    const selected = token("a");
    const gizmo = (
      <TransformGizmo
        selectedObject={selected}
        onTransform={vi.fn()}
        getNodeRef={() => node as never}
      />
    );
    // One provider throughout: only its palette changes, as when a PC's colour arrives.
    const { rerender } = render(inColour(gizmo, null));
    const { keyline } = split();
    // Hidden without a colour, but attached all the same.
    expect(keyline.props.visible).toBe(false);
    expect(keyline.api.nodes).toHaveBeenLastCalledWith([node]);
    rerender(inColour(gizmo));
    // Still the same transformer (never remounted, so a drag in progress goes on), now shown.
    expect(split().keyline).toBe(keyline);
    expect(keyline.props.visible).toBe(true);
    expect(keyline.api.nodes).toHaveBeenLastCalledWith([node]);
  });

  it("draws its border and the rotate line's keyline, and nothing else", () => {
    render(
      inColour(
        <TransformGizmo
          selectedObject={token("a")}
          onTransform={vi.fn()}
          getNodeRef={() => konvaNode() as never}
        />,
      ),
    );
    const { keyline, gizmo } = split();
    expect(keyline.props.rotateEnabled).toBe(true);
    expect(keyline.props.borderEnabled ?? true).toBe(true);
    expect(keyline.props.visible ?? true).toBe(true);
    expect(keyline.props.opacity ?? 1).toBe(1);
    expect(gizmo.props.borderEnabled ?? true).toBe(true);
  });

  it("hands the gizmo the same snap list on every render, so Ctrl's free rotation sticks", () => {
    const node = konvaNode();
    const selected = token("a");
    // A new element each time, as a parent re-render makes (the same element would bail out).
    const view = () => (
      <TransformGizmo
        selectedObject={selected}
        onTransform={vi.fn()}
        getNodeRef={() => node as never}
      />
    );
    const { rerender } = render(view());
    const before = split().gizmo.props.rotationSnaps;
    rerender(view());
    // A new array each render made react-konva re-apply the snaps, undoing rotationSnaps([]).
    expect(split().gizmo.props.rotationSnaps).toBe(before);
    expect(before).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });

  it("keeps its other array and function props across renders, so Konva does not redo its layout", () => {
    const node = konvaNode();
    const selected = token("a");
    const view = () => (
      <TransformGizmo
        selectedObject={selected}
        onTransform={vi.fn()}
        getNodeRef={() => node as never}
      />
    );
    const { rerender } = render(view());
    const before = split().gizmo.props;
    rerender(view());
    const after = split().gizmo.props;
    expect(after.enabledAnchors).toBe(before.enabledAnchors);
    expect(after.borderDash).toBe(before.borderDash);
    expect(after.boundBoxFunc).toBe(before.boundBoxFunc);
  });

  describe("Ctrl (Cmd) rotates freely, read from the drag's own pointer event", () => {
    const SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
    const transformWith = (evt: Partial<MouseEvent>, beforeDrag?: () => void) => {
      const node = konvaNode();
      render(
        <TransformGizmo
          selectedObject={token("a")}
          onTransform={vi.fn()}
          getNodeRef={() => node as never}
        />,
      );
      beforeDrag?.();
      const { gizmo } = split();
      gizmo.api.rotationSnaps.mockClear();
      (gizmo.props.onTransform as (e: { evt: Partial<MouseEvent> }) => void)({ evt });
      return gizmo.api.rotationSnaps;
    };

    it("snaps to 45° without Ctrl", () => {
      expect(transformWith({ ctrlKey: false, metaKey: false })).toHaveBeenLastCalledWith(SNAPS);
    });

    it("rotates freely with Ctrl, or with Cmd on a Mac", () => {
      expect(transformWith({ ctrlKey: true, metaKey: false })).toHaveBeenLastCalledWith([]);
      cleanup();
      h.transformers.length = 0;
      expect(transformWith({ ctrlKey: false, metaKey: true })).toHaveBeenLastCalledWith([]);
    });

    it("still snaps after a Ctrl key-up that went to another window (Ctrl+T, Cmd+Tab)", () => {
      // The key-down reached the mounted gizmo's page, its key-up did not: a window key
      // flag stuck "on" and the next drag, Ctrl long released, rotated freely.
      const ctrlDownOnly = () =>
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      expect(
        transformWith({ ctrlKey: false, metaKey: false }, ctrlDownOnly),
      ).toHaveBeenLastCalledWith(SNAPS);
    });
  });
});
