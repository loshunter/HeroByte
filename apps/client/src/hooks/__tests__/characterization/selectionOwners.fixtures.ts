import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type { ClientMessage, RoomSnapshot, SelectionStateEntry } from "@herobyte/shared";
import { useToolMode } from "../../useToolMode";
import { useDMRole } from "../../useDMRole";
import { useKeyboardNavigation } from "../../useKeyboardNavigation";
import { useSelectionManager } from "../../../features/selection/SelectionManager";

export const UID = "selection-player";
export const OWNED_ID = "token:owned";
export const OTHER_ID = "token:other";

export function selectionSnapshot(ids: string[] = [], isDM = false): RoomSnapshot {
  const entry: SelectionStateEntry | undefined =
    ids.length === 1
      ? { mode: "single", objectId: ids[0]! }
      : ids.length > 1
        ? { mode: "multiple", objectIds: ids }
        : undefined;
  return {
    users: [UID, "other-player"],
    players: [
      { uid: UID, name: "Selection player", isDM },
      { uid: "other-player", name: "Other player" },
    ],
    tokens: [
      { id: "owned", owner: UID, x: 2, y: 3, color: "#00ff00" },
      { id: "other", owner: "other-player", x: 4, y: 5, color: "#ff0000" },
    ],
    sceneObjects: [
      {
        id: OWNED_ID,
        type: "token",
        owner: UID,
        zIndex: 1,
        transform: { x: 100, y: 150, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { color: "#00ff00" },
      },
      {
        id: OTHER_ID,
        type: "token",
        owner: "other-player",
        zIndex: 2,
        transform: { x: 200, y: 250, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { color: "#ff0000" },
      },
    ],
    characters: [],
    pointers: [],
    drawings: [],
    diceRolls: [],
    gridSize: 50,
    selectionState: entry ? { [UID]: entry } : {},
  };
}

// The only doubles are transport and the unused drawing-selection callback.
// Production selection, DM-role derivation, and Escape-owner hooks are real.
export function mountSelectedOwners(ids: string[] = [OWNED_ID], isDM = false) {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  const handleSelectDrawing = vi.fn<(id: string | null) => void>();
  const harness = renderHook(
    ({ snapshot }: { snapshot: RoomSnapshot | null }) => {
      const { isDM: effectiveIsDM } = useDMRole({ uid: UID, snapshot, send: sendMessage });
      const tool = useToolMode({ snapshot, uid: UID, isDM: effectiveIsDM });
      const selection = useSelectionManager({
        uid: UID,
        snapshot,
        sendMessage,
        activeTool: tool.activeTool,
        isDM: effectiveIsDM,
      });
      useKeyboardNavigation({
        selectedDrawingId: null,
        selectMode: tool.selectMode,
        sendMessage,
        handleSelectDrawing,
        selectedObjectId: selection.selectedObjectId,
        onSelectObject: selection.handleObjectSelection,
      });
      return { tool, selection };
    },
    { initialProps: { snapshot: selectionSnapshot([], isDM) as RoomSnapshot | null } },
  );
  // Separate acts model choosing Select, then selecting a visible token.
  act(() => harness.result.current.tool.setActiveTool("select"));
  act(() => harness.result.current.selection.handleObjectSelectionBatch(ids));
  const selectedSnapshot = selectionSnapshot(ids, isDM);
  harness.rerender({ snapshot: selectedSnapshot });
  sendMessage.mockClear();
  return { ...harness, sendMessage, selectedSnapshot };
}

export function pressEscape() {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  act(() => document.body.dispatchEvent(event));
  return event;
}
