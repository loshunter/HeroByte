import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { useObjectSelection } from "../../useObjectSelection";
import { OWNED_ID, OTHER_ID, selectionSnapshot, UID } from "./selectionOwners.fixtures";

afterEach(cleanup);

function mountSelection(ids: string[] = [OWNED_ID]) {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  const hook = renderHook(
    ({ uid, snapshot }: { uid: string; snapshot: RoomSnapshot | null }) =>
      useObjectSelection({ uid, snapshot, sendMessage }),
    { initialProps: { uid: UID, snapshot: selectionSnapshot(ids) as RoomSnapshot | null } },
  );
  return { ...hook, sendMessage };
}

describe("U2 ordered selection clear intent", () => {
  it.each(["deselect", "selectObject(null)"] as const)(
    "%s survives fresh equivalent entries and reconnect, then accepts a changed entry",
    (clearMethod) => {
      const { result, rerender, sendMessage } = mountSelection();
      act(() => {
        if (clearMethod === "deselect") result.current.deselect();
        else result.current.selectObject(null);
      });
      expect(result.current.selectedObjectIds).toEqual([]);
      rerender({ uid: UID, snapshot: { ...selectionSnapshot([OWNED_ID]), stateVersion: 2 } });
      expect(result.current.selectedObjectIds).toEqual([]);
      rerender({ uid: UID, snapshot: null });
      rerender({ uid: UID, snapshot: { ...selectionSnapshot([OWNED_ID]), stateVersion: 3 } });
      expect(result.current.selectedObjectIds).toEqual([]);
      expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
      // This is authoritative state reconciliation, not a correlated command ack.
      rerender({ uid: UID, snapshot: selectionSnapshot([OTHER_ID]) });
      expect(result.current.selectedObjectIds).toEqual([OTHER_ID]);
      expect(result.current.selectedObjectId).toBe(OTHER_ID);
      expect(sendMessage).toHaveBeenCalledTimes(1);
    },
  );

  it("reordered authoritative IDs are a different entry and change the primary object", () => {
    const { result, rerender, sendMessage } = mountSelection([OWNED_ID, OTHER_ID]);
    expect(result.current.selectedObjectId).toBe(OTHER_ID);
    act(() => result.current.deselect());
    rerender({ uid: UID, snapshot: selectionSnapshot([OWNED_ID, OTHER_ID]) });
    expect(result.current.selectedObjectIds).toEqual([]);
    rerender({ uid: UID, snapshot: selectionSnapshot([OTHER_ID, OWNED_ID]) });
    expect(result.current.selectedObjectIds).toEqual([OTHER_ID, OWNED_ID]);
    expect(result.current.selectedObjectId).toBe(OWNED_ID);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("loaded empty state settles the clear, allowing a later authoritative selection", () => {
    const { result, rerender, sendMessage } = mountSelection();
    act(() => result.current.deselect());
    rerender({ uid: UID, snapshot: selectionSnapshot() });
    expect(result.current.selectedObjectIds).toEqual([]);
    rerender({ uid: UID, snapshot: selectionSnapshot([OWNED_ID]) });
    expect(result.current.selectedObjectIds).toEqual([OWNED_ID]);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("a new local multi-selection wins immediately and keeps positive-selection resync policy", () => {
    const { result, rerender, sendMessage } = mountSelection();
    act(() => result.current.deselect());
    act(() => result.current.selectMultiple([OTHER_ID, OWNED_ID]));
    expect(result.current.selectedObjectIds).toEqual([OTHER_ID, OWNED_ID]);
    expect(result.current.selectedObjectId).toBe(OWNED_ID);
    expect(sendMessage.mock.calls).toEqual([
      [{ t: "deselect-object", uid: UID }],
      [{ t: "select-multiple", uid: UID, objectIds: [OTHER_ID, OWNED_ID], mode: "replace" }],
    ]);
    // U2 does not introduce a new positive-selection command acknowledgment policy.
    rerender({ uid: UID, snapshot: selectionSnapshot([OWNED_ID]) });
    expect(result.current.selectedObjectIds).toEqual([OWNED_ID]);
  });

  it.each(["replace", "append", "subtract"] as const)(
    "an empty no-op %s does not supersede an explicit clear",
    (mode) => {
      const { result, rerender, sendMessage } = mountSelection();
      act(() => result.current.deselect());
      act(() => result.current.selectMultiple([], mode));
      rerender({ uid: UID, snapshot: selectionSnapshot([OWNED_ID]) });
      expect(result.current.selectedObjectIds).toEqual([]);
      expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
    },
  );

  it("a clear for one UID does not suppress another UID's identical server entry", () => {
    const { result, rerender, sendMessage } = mountSelection();
    act(() => result.current.deselect());
    const otherUID = "another-session";
    const anotherSnapshot = selectionSnapshot();
    anotherSnapshot.selectionState = { [otherUID]: { mode: "single", objectId: OWNED_ID } };
    rerender({ uid: otherUID, snapshot: anotherSnapshot });
    expect(result.current.selectedObjectIds).toEqual([OWNED_ID]);
    expect(sendMessage.mock.calls).toEqual([[{ t: "deselect-object", uid: UID }]]);
  });
});
