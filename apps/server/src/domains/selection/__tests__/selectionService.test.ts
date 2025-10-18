import { beforeEach, describe, expect, it } from "vitest";
import { SelectionService } from "../service.js";
import { createEmptyRoomState } from "../../room/model.js";
import type { RoomState } from "../../room/model.js";

describe("SelectionService", () => {
  let service: SelectionService;
  let state: RoomState;

  beforeEach(() => {
    service = new SelectionService();
    state = createEmptyRoomState();
  });

  it("tracks single selection per user", () => {
    const changed = service.selectObject(state, "uid-1", "object-1");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toEqual({ mode: "single", objectId: "object-1" });
  });

  it("avoids redundant updates for repeated single selections", () => {
    service.selectObject(state, "uid-1", "object-1");
    const changed = service.selectObject(state, "uid-1", "object-1");

    expect(changed).toBe(false);
    expect(state.selectionState.get("uid-1")).toEqual({ mode: "single", objectId: "object-1" });
  });

  it("replaces existing selection when switching objects", () => {
    service.selectObject(state, "uid-1", "object-1");
    const changed = service.selectObject(state, "uid-1", "object-2");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toEqual({ mode: "single", objectId: "object-2" });
  });

  it("supports replace multi-select operations", () => {
    const changed = service.selectMultiple(state, "uid-1", ["object-1", "object-2"], "replace");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toEqual({
      mode: "multiple",
      objectIds: ["object-1", "object-2"],
    });
  });

  it("appends to existing selection when requested", () => {
    service.selectMultiple(state, "uid-1", ["object-1"], "replace");
    const changed = service.selectMultiple(state, "uid-1", ["object-2", "object-3"], "append");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toEqual({
      mode: "multiple",
      objectIds: ["object-1", "object-2", "object-3"],
    });
  });

  it("subtracts ids from existing selection", () => {
    service.selectMultiple(state, "uid-1", ["object-1", "object-2", "object-3"], "replace");
    const changed = service.selectMultiple(state, "uid-1", ["object-1", "object-2"], "subtract");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toEqual({ mode: "single", objectId: "object-3" });
  });

  it("clears selection when subtracting all entries", () => {
    service.selectMultiple(state, "uid-1", ["object-1", "object-2"], "replace");
    const changed = service.selectMultiple(state, "uid-1", ["object-1", "object-2"], "subtract");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toBeUndefined();
  });

  it("deselects user state on request", () => {
    service.selectObject(state, "uid-1", "object-1");
    const changed = service.deselect(state, "uid-1");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toBeUndefined();
  });

  it("removes stale object references across users", () => {
    service.selectObject(state, "uid-1", "object-1");
    service.selectMultiple(state, "uid-2", ["object-1", "object-2"], "replace");

    const changed = service.removeObject(state, "object-1");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-1")).toBeUndefined();
    expect(state.selectionState.get("uid-2")).toEqual({ mode: "single", objectId: "object-2" });
  });

  it("reassigns ownership when another user selects an owned object", () => {
    service.selectObject(state, "uid-1", "object-1");

    const changed = service.selectObject(state, "uid-2", "object-1");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-2")).toEqual({ mode: "single", objectId: "object-1" });
    expect(state.selectionState.get("uid-1")).toBeUndefined();
  });

  it("removes conflicted ids from multi-select owners", () => {
    service.selectMultiple(state, "uid-1", ["object-1", "object-2"], "replace");

    const changed = service.selectObject(state, "uid-2", "object-2");

    expect(changed).toBe(true);
    expect(state.selectionState.get("uid-2")).toEqual({ mode: "single", objectId: "object-2" });
    expect(state.selectionState.get("uid-1")).toEqual({ mode: "single", objectId: "object-1" });
  });
});
