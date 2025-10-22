import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type Konva from "konva";
import type { SceneObject } from "@shared";
import { useKonvaNodeRefs } from "../useKonvaNodeRefs";

type MockNodeOptions = {
  id: string;
  rect?: { x: number; y: number; width: number; height: number };
};

function createMockNode({ id, rect }: MockNodeOptions) {
  const clientRect = rect ?? {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  };

  return {
    id: () => id,
    getClientRect: () => clientRect,
  } as unknown as Konva.Node;
}

function createMapSceneObject(id: string): SceneObject & { type: "map" } {
  return {
    id,
    type: "map",
    data: {
      imageUrl: "map.png",
    },
    zIndex: 0,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
  };
}

describe("useKonvaNodeRefs", () => {
  it("registerNode stores and retrieves a node reference", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const node = createMockNode({ id: "token:1" });

    act(() => {
      result.current.registerNode("token:1", node);
    });

    expect(result.current.getNode("token:1")).toBe(node);
  });

  it("registerNode overwrites an existing node reference for the same id", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const first = createMockNode({ id: "token:1" });
    const second = createMockNode({ id: "token:1" });

    act(() => {
      result.current.registerNode("token:1", first);
      result.current.registerNode("token:1", second);
    });

    expect(result.current.getNode("token:1")).toBe(second);
  });

  it("registerNode removes an entry when null is passed", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const node = createMockNode({ id: "token:1" });

    act(() => {
      result.current.registerNode("token:1", node);
      result.current.registerNode("token:1", null);
    });

    expect(result.current.getNode("token:1")).toBeUndefined();
  });

  it("registerNode ignores calls with falsy ids", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const mapRefBefore = result.current.getAllNodes();

    act(() => {
      result.current.registerNode("", createMockNode({ id: "unused" }));
      result.current.registerNode(undefined as unknown as string, null);
    });

    expect(result.current.getAllNodes()).toBe(mapRefBefore);
    expect(result.current.getAllNodes().size).toBe(0);
  });

  it("getNode returns undefined for unknown ids", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));

    expect(result.current.getNode("missing")).toBeUndefined();
  });

  it("getAllNodes returns the same map instance across rerenders", () => {
    const hook = renderHook(({ selectedId }) => useKonvaNodeRefs(selectedId, undefined), {
      initialProps: { selectedId: null as string | null },
    });

    const firstMap = hook.result.current.getAllNodes();

    hook.rerender({ selectedId: "token:1" });

    expect(hook.result.current.getAllNodes()).toBe(firstMap);
  });

  it("getAllNodes exposes registered entries without cloning", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const nodeA = createMockNode({ id: "token:1" });
    const nodeB = createMockNode({ id: "drawing:2" });

    act(() => {
      result.current.registerNode("token:1", nodeA);
      result.current.registerNode("drawing:2", nodeB);
    });

    const allNodes = result.current.getAllNodes();

    expect(allNodes.get("token:1")).toBe(nodeA);
    expect(allNodes.get("drawing:2")).toBe(nodeB);
    expect(allNodes.size).toBe(2);
  });

  it("tracks the selected node when selectedObjectId matches a registered node", () => {
    const hook = renderHook(({ selectedId }) => useKonvaNodeRefs(selectedId, undefined), {
      initialProps: { selectedId: null as string | null },
    });
    const node = createMockNode({ id: "token:1" });

    act(() => {
      hook.result.current.registerNode("token:1", node);
    });

    hook.rerender({ selectedId: "token:1" });

    expect(hook.result.current.getSelectedNode()).toBe(node);
  });

  it("clears the selected node when selectedObjectId becomes null", () => {
    const hook = renderHook(({ selectedId }) => useKonvaNodeRefs(selectedId, undefined), {
      initialProps: { selectedId: "token:1" as string | null },
    });
    const node = createMockNode({ id: "token:1" });

    act(() => {
      hook.result.current.registerNode("token:1", node);
    });

    expect(hook.result.current.getSelectedNode()).toBe(node);

    hook.rerender({ selectedId: null });

    expect(hook.result.current.getSelectedNode()).toBeNull();
  });

  it("updates the selected node when the node registers after the id is selected", () => {
    const hook = renderHook(({ selectedId }) => useKonvaNodeRefs(selectedId, undefined), {
      initialProps: { selectedId: "token:1" as string | null },
    });
    const node = createMockNode({ id: "token:1" });

    expect(hook.result.current.getSelectedNode()).toBeNull();

    act(() => {
      hook.result.current.registerNode("token:1", node);
    });

    expect(hook.result.current.getSelectedNode()).toBe(node);
  });

  it("clears the selected node when the registered node is unregistered", () => {
    const hook = renderHook(({ selectedId }) => useKonvaNodeRefs(selectedId, undefined), {
      initialProps: { selectedId: "token:1" as string | null },
    });
    const node = createMockNode({ id: "token:1" });

    act(() => {
      hook.result.current.registerNode("token:1", node);
    });

    act(() => {
      hook.result.current.registerNode("token:1", null);
    });

    expect(hook.result.current.getSelectedNode()).toBeNull();
  });

  it("registers map nodes using the current map object id", () => {
    const mapObject = createMapSceneObject("map:initial");
    const hook = renderHook(({ mapObj }) => useKonvaNodeRefs(null, mapObj), {
      initialProps: { mapObj: mapObject },
    });
    const mapNode = createMockNode({ id: "map-node" });

    act(() => {
      hook.result.current.registerNode(mapObject.id, mapNode);
    });

    expect(hook.result.current.getNode("map:initial")).toBe(mapNode);
  });

  it("reconciles map node entries when the map id changes", () => {
    const initialMapObject = createMapSceneObject("map:one");
    const nextMapObject = createMapSceneObject("map:two");
    const hook = renderHook(({ mapObj }) => useKonvaNodeRefs(null, mapObj), {
      initialProps: { mapObj: initialMapObject },
    });
    const mapNode = createMockNode({ id: "map-node" });

    act(() => {
      hook.result.current.registerNode(initialMapObject.id, mapNode);
    });

    hook.rerender({ mapObj: nextMapObject });

    expect(hook.result.current.getNode("map:one")).toBeUndefined();
    expect(hook.result.current.getAllNodes().size).toBe(0);
  });

  it("supports manual registration paths such as the staging zone", () => {
    const stagingId = "staging:1";
    const hook = renderHook(({ selectedId }) => useKonvaNodeRefs(selectedId, undefined), {
      initialProps: { selectedId: stagingId as string | null },
    });
    const stagingNode = createMockNode({ id: stagingId });

    act(() => {
      hook.result.current.registerNode(stagingId, stagingNode);
    });

    expect(hook.result.current.getSelectedNode()).toBe(stagingNode);
  });

  it("keeps other entries intact when one id is unregistered", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const tokenNode = createMockNode({ id: "token:1" });
    const drawingNode = createMockNode({ id: "drawing:2" });
    const propNode = createMockNode({ id: "prop:3" });

    act(() => {
      result.current.registerNode("token:1", tokenNode);
      result.current.registerNode("drawing:2", drawingNode);
      result.current.registerNode("prop:3", propNode);
    });

    act(() => {
      result.current.registerNode("drawing:2", null);
    });

    expect(result.current.getNode("drawing:2")).toBeUndefined();
    expect(result.current.getNode("token:1")).toBe(tokenNode);
    expect(result.current.getNode("prop:3")).toBe(propNode);
  });

  it("reflects direct mutations via nodeRefsMap without breaking identity", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const node = createMockNode({ id: "token:99" });

    act(() => {
      result.current.nodeRefsMap.current.set("token:99", node);
    });

    const allNodes = result.current.getAllNodes();

    expect(allNodes).toBe(result.current.nodeRefsMap.current);
    expect(allNodes.get("token:99")).toBe(node);
  });
});
