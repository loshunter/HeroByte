import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SelectionRequestOptions } from "../../ui/MapBoard.types";
import { useMarqueeSelection, type UseMarqueeSelectionOptions } from "../useMarqueeSelection";

type Pointer = { x: number; y: number };

type StageStub = {
  pointer: Pointer | null;
  getPointerPosition: () => Pointer | null;
  setPointerPosition: (pointer: Pointer | null) => void;
  getStage: () => StageStub;
};

function createStage(pointer: Pointer | null): StageStub {
  const stage: StageStub = {
    pointer,
    getPointerPosition: () => stage.pointer,
    setPointerPosition: (next) => {
      stage.pointer = next;
    },
    getStage: () => stage,
  };
  return stage;
}

function createEvent(
  target: StageStub | { getStage: () => StageStub },
  button = 0,
): KonvaEventObject<PointerEvent> {
  return {
    target,
    evt: { button } as PointerEvent,
  } as KonvaEventObject<PointerEvent>;
}

type MockNodeRect = { x: number; y: number; width: number; height: number };

function createMockNode(rect: MockNodeRect, id: string): Konva.Node {
  return {
    id: () => id,
    getClientRect: () => rect,
  } as unknown as Konva.Node;
}

function createOptions(
  overrides: Partial<UseMarqueeSelectionOptions> = {},
): UseMarqueeSelectionOptions {
  const stage = createStage({ x: 0, y: 0 });
  const getAllNodes = vi.fn(() => new Map<string, Konva.Node>());
  return {
    stageRef: { current: stage },
    selectMode: true,
    pointerMode: false,
    measureMode: false,
    drawMode: false,
    getAllNodes,
    onSelectObject: vi.fn(),
    onSelectObjects: undefined,
    ...overrides,
  };
}

describe("useMarqueeSelection", () => {
  it("starts marquee on primary stage press when select mode is active", () => {
    const options = createOptions();
    const { result } = renderHook(() => useMarqueeSelection(options));

    act(() => {
      result.current.handlePointerDown(createEvent(options.stageRef.current!));
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.marqueeRect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("ignores pointer down when not in select mode", () => {
    const options = createOptions({ selectMode: false });
    const { result } = renderHook(() => useMarqueeSelection(options));

    act(() => {
      result.current.handlePointerDown(createEvent(options.stageRef.current!));
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.marqueeRect).toBeNull();
  });

  it("updates marquee rectangle on pointer move", () => {
    const options = createOptions();
    const { result } = renderHook(() => useMarqueeSelection(options));

    act(() => {
      result.current.handlePointerDown(createEvent(options.stageRef.current!));
    });

    act(() => {
      options.stageRef.current!.setPointerPosition({ x: 8, y: 10 });
      result.current.handlePointerMove();
    });

    expect(result.current.marqueeRect).toEqual({ x: 0, y: 0, width: 8, height: 10 });
  });

  it("applies selection using onSelectObjects when matches exist", () => {
    const onSelectObjects = vi.fn();
    const node = createMockNode({ x: 2, y: 2, width: 4, height: 4 }, "token:123");
    const options = createOptions({
      getAllNodes: () => new Map<string, Konva.Node>([["token:123", node]]),
      onSelectObjects,
      onSelectObject: vi.fn(),
    });
    const { result } = renderHook(() => useMarqueeSelection(options));

    act(() => {
      result.current.handlePointerDown(createEvent(options.stageRef.current!));
    });
    act(() => {
      options.stageRef.current!.setPointerPosition({ x: 12, y: 12 });
      result.current.handlePointerMove();
    });

    expect(result.current.marqueeRect).toEqual({ x: 0, y: 0, width: 12, height: 12 });

    act(() => {
      result.current.handlePointerUp();
    });

    expect(onSelectObjects).toHaveBeenCalledWith(["token:123"]);
    expect(result.current.isActive).toBe(false);
  });

  it("falls back to onSelectObject when multi-selection callback is absent", () => {
    const onSelectObject = vi.fn<[string | null, SelectionRequestOptions | undefined], void>();
    const node = createMockNode({ x: 0, y: 0, width: 2, height: 2 }, "prop:1");
    const options = createOptions({
      onSelectObject,
      getAllNodes: () => new Map<string, Konva.Node>([["prop:1", node]]),
    });
    const { result } = renderHook(() => useMarqueeSelection(options));

    act(() => {
      result.current.handlePointerDown(createEvent(options.stageRef.current!));
      options.stageRef.current!.setPointerPosition({ x: 12, y: 12 });
      result.current.handlePointerMove();
    });

    expect(result.current.marqueeRect).toEqual({ x: 0, y: 0, width: 12, height: 12 });

    act(() => {
      result.current.handlePointerUp();
    });

    expect(onSelectObject).toHaveBeenNthCalledWith(1, "prop:1", { mode: "replace" });
    expect(onSelectObject).toHaveBeenCalledTimes(1);
  });

  it("deselects when marquee is tiny and no matches were found", () => {
    const onSelectObject = vi.fn<[string | null, SelectionRequestOptions | undefined], void>();
    const options = createOptions({ onSelectObject });
    const { result } = renderHook(() => useMarqueeSelection(options));

    act(() => {
      result.current.handlePointerDown(createEvent(options.stageRef.current!));
      options.stageRef.current!.setPointerPosition({ x: 1, y: 1 });
      result.current.handlePointerMove();
    });

    expect(result.current.marqueeRect).toEqual({ x: 0, y: 0, width: 1, height: 1 });

    act(() => {
      result.current.handlePointerUp();
    });

    expect(onSelectObject).toHaveBeenCalledWith(null);
  });

  it("clears marquee state when select mode is toggled off", () => {
    const stage = createStage({ x: 0, y: 0 });
    const hook = renderHook(
      ({ selectMode }) =>
        useMarqueeSelection({
          ...createOptions({ stageRef: { current: stage } }),
          selectMode,
        }),
      { initialProps: { selectMode: true } },
    );

    act(() => {
      hook.result.current.handlePointerDown(createEvent(stage));
      stage.setPointerPosition({ x: 10, y: 10 });
      hook.result.current.handlePointerMove();
    });

    expect(hook.result.current.isActive).toBe(true);

    hook.rerender({ selectMode: false });

    expect(hook.result.current.isActive).toBe(false);
    expect(hook.result.current.marqueeRect).toBeNull();
  });
});
