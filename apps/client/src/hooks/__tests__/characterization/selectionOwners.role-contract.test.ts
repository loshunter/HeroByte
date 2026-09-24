// No fixture effect may perform demotion, deselection, tool exit, or gesture cancellation.
import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  mountSelectedOwners,
  OWNED_ID,
  OTHER_ID,
  selectionSnapshot,
  UID,
} from "./selectionOwners.fixtures";

afterEach(cleanup);

describe("U2 confirmed role loss versus unavailable role state", () => {
  it("a null snapshot and same-DM reconnect do not clear selection or exit Select", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OTHER_ID], true);
    rerender({ snapshot: null });
    expect(result.current.tool.activeTool).toBe("select");
    expect(sendMessage).not.toHaveBeenCalled();
    // Rendering no IDs while data is unavailable is not proof of a deselect.
    rerender({ snapshot: selectionSnapshot([OTHER_ID], true) });
    expect(result.current.tool.activeTool).toBe("select");
    expect(result.current.selection.selectedObjectIds).toEqual([OTHER_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("a missing own player row and same-DM return do not confirm role loss", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OTHER_ID], true);
    const missingOwnPlayer = selectionSnapshot([OTHER_ID], true);
    missingOwnPlayer.players = missingOwnPlayer.players.filter((player) => player.uid !== UID);
    rerender({ snapshot: missingOwnPlayer });
    expect(result.current.tool.activeTool).toBe("select");
    expect(result.current.selection.selectedObjectIds).toEqual([OTHER_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
    rerender({ snapshot: selectionSnapshot([OTHER_ID], true) });
    expect(result.current.selection.selectedObjectIds).toEqual([OTHER_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it.each(["null snapshot", "missing own row"] as const)(
    "a confirmed demotion after %s clears once and returns to Move",
    (gap) => {
      const { result, rerender, sendMessage } = mountSelectedOwners([OTHER_ID], true);
      const unavailable = selectionSnapshot([OTHER_ID], true);
      unavailable.players = unavailable.players.filter((player) => player.uid !== UID);
      rerender({ snapshot: gap === "null snapshot" ? null : unavailable });
      expect(sendMessage).not.toHaveBeenCalled();
      rerender({ snapshot: selectionSnapshot([OTHER_ID], false) });
      expect(result.current.tool.activeTool).toBeNull();
      expect(result.current.selection.selectedObjectIds).toEqual([]);
      expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
      rerender({ snapshot: { ...selectionSnapshot([OTHER_ID], false), stateVersion: 5 } });
      expect(result.current.selection.selectedObjectIds).toEqual([]);
      expect(sendMessage).toHaveBeenCalledTimes(1);
    },
  );

  it("an initially non-DM player is not a role-loss transition", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OWNED_ID], false);
    rerender({ snapshot: selectionSnapshot([OWNED_ID], false) });
    expect(result.current.tool.activeTool).toBe("select");
    expect(result.current.selection.selectedObjectIds).toEqual([OWNED_ID]);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("a tool change and confirmed demotion in one update send one deselect", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OTHER_ID], true);
    act(() => {
      result.current.tool.setActiveTool("draw");
      rerender({ snapshot: selectionSnapshot([OTHER_ID], false) });
    });
    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
  });

  it("demotion clears a different authoritative selection while an earlier clear was pending", () => {
    const { result, rerender, sendMessage } = mountSelectedOwners([OWNED_ID], true);
    act(() => result.current.selection.clearSelection());
    sendMessage.mockClear();
    rerender({ snapshot: selectionSnapshot([OTHER_ID], false) });
    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selection.selectedObjectIds).toEqual([]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
  });
});
