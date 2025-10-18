import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useObjectSelection } from "../useObjectSelection.js";
import type { RoomSnapshot, SelectionState } from "@shared";

function createSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    users: [],
    tokens: [],
    players: [],
    characters: [],
    mapBackground: undefined,
    pointers: [],
    drawings: [],
    gridSize: 50,
    gridSquareSize: 5,
    diceRolls: [],
    sceneObjects: [],
    selectionState: {},
    ...overrides,
  };
}

describe("useObjectSelection", () => {
  it("optimistically selects objects and syncs with server snapshot", () => {
    const sendMessage = vi.fn();
    const baseSnapshot = createSnapshot();

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: RoomSnapshot | null }) =>
        useObjectSelection({ uid: "user-1", snapshot, sendMessage }),
      { initialProps: { snapshot: baseSnapshot } },
    );

    expect(result.current.selectedObjectId).toBeNull();

    act(() => {
      result.current.selectObject("token:1");
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "select-object",
      uid: "user-1",
      objectId: "token:1",
    });
    expect(result.current.selectedObjectId).toBe("token:1");

    const selectionState: SelectionState = {
      "user-1": { mode: "single", objectId: "token:1" },
    };
    rerender({ snapshot: createSnapshot({ selectionState }) });
    expect(result.current.selectedObjectId).toBe("token:1");

    sendMessage.mockClear();
    act(() => {
      result.current.deselect();
    });
    expect(sendMessage).toHaveBeenCalledWith({ t: "deselect-object", uid: "user-1" });
    rerender({ snapshot: createSnapshot({ selectionState: {} }) });
    expect(result.current.selectedObjectId).toBeNull();
  });

  it("avoids dispatching duplicate selections for the same object", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(
      ({ snapshot }: { snapshot: RoomSnapshot | null }) =>
        useObjectSelection({ uid: "user-1", snapshot, sendMessage }),
      { initialProps: { snapshot: createSnapshot() } },
    );

    act(() => {
      result.current.selectObject("token:2");
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);

    sendMessage.mockClear();
    act(() => {
      result.current.selectObject("token:2");
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("dispatches select-multiple messages for multi-select operations", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(
      ({ snapshot }: { snapshot: RoomSnapshot | null }) =>
        useObjectSelection({ uid: "user-1", snapshot, sendMessage }),
      { initialProps: { snapshot: createSnapshot() } },
    );

    act(() => {
      result.current.selectMultiple(["token:1", "drawing:1"], "append");
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "select-multiple",
      uid: "user-1",
      objectIds: ["token:1", "drawing:1"],
      mode: "append",
    });
    expect(result.current.selectedObjectIds).toEqual(["token:1", "drawing:1"]);
  });

  it("defaults to replace mode when selecting multiple ids", () => {
    const sendMessage = vi.fn();
    const selectionState: SelectionState = {
      "user-1": {
        mode: "multiple",
        objectIds: ["token:old"],
      },
    };

    const { result } = renderHook(
      ({ snapshot }: { snapshot: RoomSnapshot | null }) =>
        useObjectSelection({ uid: "user-1", snapshot, sendMessage }),
      { initialProps: { snapshot: createSnapshot({ selectionState }) } },
    );

    act(() => {
      result.current.selectMultiple(["token:1", "drawing:1"]);
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "select-multiple",
      uid: "user-1",
      objectIds: ["token:1", "drawing:1"],
      mode: "replace",
    });
    expect(result.current.selectedObjectIds).toEqual(["token:1", "drawing:1"]);
    expect(result.current.selectedObjectId).toBe("drawing:1");
  });

  it("optimistically removes ids when subtracting from the current selection", () => {
    const sendMessage = vi.fn();
    const selectionState: SelectionState = {
      "user-1": {
        mode: "multiple",
        objectIds: ["token:1", "token:2", "drawing:1"],
      },
    };

    const { result } = renderHook(
      ({ snapshot }: { snapshot: RoomSnapshot | null }) =>
        useObjectSelection({ uid: "user-1", snapshot, sendMessage }),
      { initialProps: { snapshot: createSnapshot({ selectionState }) } },
    );

    act(() => {
      result.current.selectMultiple(["token:1"], "subtract");
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "select-multiple",
      uid: "user-1",
      objectIds: ["token:1"],
      mode: "subtract",
    });
    expect(result.current.selectedObjectIds).toEqual(["token:2", "drawing:1"]);
    expect(result.current.selectedObjectId).toBe("drawing:1");
  });
});
