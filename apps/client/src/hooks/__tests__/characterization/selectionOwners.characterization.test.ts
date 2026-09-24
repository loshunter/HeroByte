// Integrate only when replacing the matching baseline bug expectations.
import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  mountSelectedOwners,
  OWNED_ID,
  OTHER_ID,
  pressEscape,
  selectionSnapshot,
  UID,
} from "./selectionOwners.fixtures";

afterEach(cleanup);

describe("U2 selection escape ladder", () => {
  it("first Escape goes to Move with selection intact; a later Escape clears exactly once", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OWNED_ID, OTHER_ID], true);
    expect(result.current.tool.activeTool).toBe("select");
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID, OTHER_ID]);

    pressEscape();

    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID, OTHER_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
    // Freshly deserialized data is deliberately a new selection entry object.
    rerender({ snapshot: { ...selectionSnapshot([OWNED_ID, OTHER_ID], true), stateVersion: 2 } });
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID, OTHER_ID]);
    expect(sendMessage).not.toHaveBeenCalled();

    pressEscape();

    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
    // A new snapshot object is not a deselect acknowledgment. A broadcast
    // already in flight still carries the old selected IDs.
    rerender({ snapshot: { ...selectionSnapshot([OWNED_ID, OTHER_ID], true), stateVersion: 3 } });
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
    rerender({ snapshot: { ...selectionSnapshot([], true), stateVersion: 4 } });
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    sendMessage.mockClear();
    pressEscape();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("explicit Move also preserves selection until a later Escape", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners();
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);
    act(() => result.current.tool.setActiveTool(null));
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);
    rerender({ snapshot: selectionSnapshot([OWNED_ID]) });
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
    pressEscape();
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
  });

  it("an unchanged broadcast cannot undo optimistic clear, but a new local selection can", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners();
    act(() => result.current.selection.clearSelection());
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    rerender({ snapshot: { ...selectionSnapshot([OWNED_ID]), stateVersion: 2 } });
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
    act(() => result.current.selection.handleObjectSelection(OWNED_ID));
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);
    expect(sendMessage.mock.calls[1]).toEqual([
      { t: "select-object", uid: UID, objectId: OWNED_ID },
    ]);
  });

  it("preserves a multi-selection between Select and Transform", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OWNED_ID, OTHER_ID], true);
    act(() => result.current.tool.setActiveTool("transform"));
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID, OTHER_ID]);
    rerender({ snapshot: selectionSnapshot([OWNED_ID, OTHER_ID], true) });
    act(() => result.current.tool.setActiveTool("select"));
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID, OTHER_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it.each(["pointer", "measure", "draw", "align", "atlas-link", "map-edit"] as const)(
    "clears selection when entering %s",
    (mode) => {
      const { result, sendMessage } = mountSelectedOwners([OWNED_ID], true);
      act(() => result.current.tool.setActiveTool(mode));
      expect(result.current.tool.activeTool).toBe(mode);
      expect(result.current.selection.selectedObjectIds).toEqual([]);
      expect(sendMessage).toHaveBeenCalledWith({ t: "deselect-object", uid: UID });
    },
  );

  // Required integration contract; the manager alone does not own tool exit.
  it("confirmed DM loss clears the selected other-player object and returns to Move", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OTHER_ID], true);
    rerender({ snapshot: selectionSnapshot([OTHER_ID], false) });
    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
  });
});
