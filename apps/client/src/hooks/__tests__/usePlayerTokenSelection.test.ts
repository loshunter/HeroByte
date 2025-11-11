/**
 * Tests for usePlayerTokenSelection hook
 *
 * Tests DM functionality to select all tokens owned by a specific player
 * with safe undo capability.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePlayerTokenSelection } from "../usePlayerTokenSelection.js";
import type { SceneObject } from "@shared";

function createToken(id: string, owner: string, locked: boolean = false): SceneObject {
  return {
    id,
    type: "token",
    owner,
    locked,
    position: { x: 0, y: 0 },
    size: { width: 50, height: 50 },
  };
}

function createDrawing(id: string, owner: string): SceneObject {
  return {
    id,
    type: "drawing",
    owner,
    locked: false,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
  };
}

describe("usePlayerTokenSelection", () => {
  it("selects all unlocked tokens owned by a specific player", () => {
    const selectMultiple = vi.fn();
    const sceneObjects: SceneObject[] = [
      createToken("token:1", "player-1"),
      createToken("token:2", "player-1"),
      createToken("token:3", "player-2"),
      createDrawing("drawing:1", "player-1"), // Should be ignored (not a token)
    ];

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects,
        selectedObjectIds: [],
        selectMultiple,
      }),
    );

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    expect(selectMultiple).toHaveBeenCalledWith(["token:1", "token:2"]);
    expect(result.current.canUndo).toBe(true);
  });

  it("excludes locked tokens from selection", () => {
    const selectMultiple = vi.fn();
    const sceneObjects: SceneObject[] = [
      createToken("token:1", "player-1"),
      createToken("token:2", "player-1", true), // Locked
      createToken("token:3", "player-1"),
    ];

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects,
        selectedObjectIds: [],
        selectMultiple,
      }),
    );

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    // Only unlocked tokens should be selected
    expect(selectMultiple).toHaveBeenCalledWith(["token:1", "token:3"]);
  });

  it("does nothing when player has no unlocked tokens", () => {
    const selectMultiple = vi.fn();
    const sceneObjects: SceneObject[] = [
      createToken("token:1", "player-1", true), // Locked
      createToken("token:2", "player-2"),
    ];

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects,
        selectedObjectIds: [],
        selectMultiple,
      }),
    );

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    // Should not call selectMultiple when no tokens found
    expect(selectMultiple).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
  });

  it("saves previous selection for undo", () => {
    const selectMultiple = vi.fn();
    const sceneObjects: SceneObject[] = [
      createToken("token:1", "player-1"),
      createToken("token:2", "player-1"),
      createToken("token:3", "player-2"),
    ];

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects,
        selectedObjectIds: ["token:3", "drawing:1"],
        selectMultiple,
      }),
    );

    // Select player-1's tokens
    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    expect(selectMultiple).toHaveBeenCalledWith(["token:1", "token:2"]);
    expect(result.current.canUndo).toBe(true);

    // Clear the mock
    selectMultiple.mockClear();

    // Undo should restore previous selection
    act(() => {
      result.current.undoSelection();
    });

    expect(selectMultiple).toHaveBeenCalledWith(["token:3", "drawing:1"]);
    expect(result.current.canUndo).toBe(false);
  });

  it("clears undo state after undo is performed", () => {
    const selectMultiple = vi.fn();
    const sceneObjects: SceneObject[] = [createToken("token:1", "player-1")];

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects,
        selectedObjectIds: ["token:2"],
        selectMultiple,
      }),
    );

    // Select player-1's tokens
    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    expect(result.current.canUndo).toBe(true);

    // Undo
    act(() => {
      result.current.undoSelection();
    });

    expect(result.current.canUndo).toBe(false);

    // Second undo should do nothing
    selectMultiple.mockClear();
    act(() => {
      result.current.undoSelection();
    });

    expect(selectMultiple).not.toHaveBeenCalled();
  });

  it("handles empty scene objects array", () => {
    const selectMultiple = vi.fn();

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects: [],
        selectedObjectIds: [],
        selectMultiple,
      }),
    );

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    expect(selectMultiple).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
  });

  it("handles player with no tokens at all", () => {
    const selectMultiple = vi.fn();
    const sceneObjects: SceneObject[] = [
      createToken("token:1", "player-2"),
      createToken("token:2", "player-3"),
    ];

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects,
        selectedObjectIds: [],
        selectMultiple,
      }),
    );

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    expect(selectMultiple).not.toHaveBeenCalled();
  });

  it("only selects tokens (not other scene object types)", () => {
    const selectMultiple = vi.fn();
    const sceneObjects: SceneObject[] = [
      createToken("token:1", "player-1"),
      { id: "map:1", type: "map", owner: "player-1", locked: false } as SceneObject,
      { id: "prop:1", type: "prop", owner: "player-1", locked: false } as SceneObject,
      createDrawing("drawing:1", "player-1"),
    ];

    const { result } = renderHook(() =>
      usePlayerTokenSelection({
        sceneObjects,
        selectedObjectIds: [],
        selectMultiple,
      }),
    );

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    // Only the token should be selected
    expect(selectMultiple).toHaveBeenCalledWith(["token:1"]);
  });

  it("updates when sceneObjects change", () => {
    const selectMultiple = vi.fn();
    let sceneObjects: SceneObject[] = [createToken("token:1", "player-1")];

    const { result, rerender } = renderHook(
      ({ sceneObjects }) =>
        usePlayerTokenSelection({
          sceneObjects,
          selectedObjectIds: [],
          selectMultiple,
        }),
      { initialProps: { sceneObjects } },
    );

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    expect(selectMultiple).toHaveBeenCalledWith(["token:1"]);
    selectMultiple.mockClear();

    // Add more tokens
    sceneObjects = [
      createToken("token:1", "player-1"),
      createToken("token:2", "player-1"),
      createToken("token:3", "player-1"),
    ];

    rerender({ sceneObjects });

    act(() => {
      result.current.selectPlayerTokens("player-1");
    });

    expect(selectMultiple).toHaveBeenCalledWith(["token:1", "token:2", "token:3"]);
  });
});
