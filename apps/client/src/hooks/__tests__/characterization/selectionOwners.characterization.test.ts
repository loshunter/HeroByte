// U2 baseline at 44c6ab82. Replace BASELINE BUG expectations during repair.
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

describe("real selection owners before U2", () => {
  it("BASELINE BUG: first Escape leaves Select and clears the real server-backed selection", () => {
    const { result, rerender, sendMessage, selectedSnapshot } = mountSelectedOwners();
    expect(result.current.tool.activeTool).toBe("select");
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);
    expect(sendMessage).not.toHaveBeenCalled();

    pressEscape();

    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage).toHaveBeenCalledWith({ t: "deselect-object", uid: UID });
    // The original authoritative entry still exists until its round trip lands.
    expect(selectedSnapshot.selectionState?.[UID]).toEqual({
      mode: "single",
      objectId: OWNED_ID,
    });
    rerender({ snapshot: selectedSnapshot });
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    rerender({ snapshot: selectionSnapshot() });
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    sendMessage.mockClear();
    pressEscape();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("BASELINE BUG: direct Select to Move clears too, without dispatching any key event", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners();
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);

    act(() => result.current.tool.setActiveTool(null));

    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage).toHaveBeenCalledWith({ t: "deselect-object", uid: UID });
    // A new server entry identity can reset optimistic clear; the mode effect
    // clears again. Omitting snapshots would miss this integration behavior.
    sendMessage.mockClear();
    rerender({ snapshot: selectionSnapshot([OWNED_ID]) });
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage).toHaveBeenCalledWith({ t: "deselect-object", uid: UID });
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

  it("BASELINE BUG: a fresh unchanged server entry resurrects an optimistic clear in Select", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners();
    act(() => result.current.selection.clearSelection());
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
    // A broadcast already in flight can still contain the old selection.
    rerender({ snapshot: { ...selectionSnapshot([OWNED_ID]), stateVersion: 2 } });
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);
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

  it("BASELINE GAP: a confirmed DM loss alone does not clear a visible other-player selection", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OTHER_ID], true);
    expect(result.current.selection.selectedObjectIds).toEqual([OTHER_ID]);
    rerender({ snapshot: selectionSnapshot([OTHER_ID], false) });
    expect(result.current.tool.activeTool).toBe("select");
    expect(result.current.selection.selectedObjectIds).toEqual([OTHER_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
