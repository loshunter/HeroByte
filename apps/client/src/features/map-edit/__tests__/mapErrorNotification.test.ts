import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToast } from "../../../hooks/useToast";
import { useMapStudio } from "../../map-studio/useMapStudio";
import { useMapEditState } from "../useMapEditState";

afterEach(cleanup);
describe("a map error owns its notification through a deliberate retry", () => {
  it("retires a superseded map error while preserving unrelated notifications and a later refusal", () => {
    const send = vi.fn(),
      setActiveTool = vi.fn();
    const h = renderHook(
      ({ error }: { error: string | null }) => {
        const controller = useMapStudio(send);
        const toast = useToast();
        useMapEditState({
          controller: { ...controller, error },
          sendMessage: send,
          mapEditMode: true,
          setActiveTool,
          isDM: true,
          snapshotLoaded: true,
          liveMapDocumentId: undefined,
          sceneSourceDocumentId: undefined,
          roomGridSize: 50,
          hasRasterBackground: false,
          notifyError: toast.error,
          dismissError: toast.dismiss,
        });
        return toast;
      },
      { initialProps: { error: null as string | null } },
    );
    act(() => h.result.current.error("Unrelated upload failed"));
    h.rerender({ error: "Walls are locked" });
    expect(h.result.current.messages.map((m) => m.message)).toEqual([
      "Unrelated upload failed",
      "Walls are locked",
    ]);
    const firstId = h.result.current.messages[1]!.id;
    // Dispatch clears the controller's old error before awaiting the new result.
    h.rerender({ error: null });
    expect(h.result.current.messages.map((m) => m.message)).toEqual(["Unrelated upload failed"]);
    h.rerender({ error: "Walls are locked" });
    expect(h.result.current.messages.map((m) => m.message)).toEqual([
      "Unrelated upload failed",
      "Walls are locked",
    ]);
    expect(h.result.current.messages[1]!.id).not.toBe(firstId);
  });
});
