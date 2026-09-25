import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { createMapDocument, type ClientMessage } from "@herobyte/shared";
import { useMapStudio } from "../../../map-studio/useMapStudio";
import { useMapEditState } from "../../useMapEditState";
import type { MapEditToolbarProps } from "../../mapEditTypes";

/** A real bound controller/state bag, never an incomplete cast-only palette. */
export function boundPalette() {
  const send = vi.fn<(message: ClientMessage) => void>();
  const setActiveTool = vi.fn();
  const hook = renderHook(
    ({ isDM }) => {
      const controller = useMapStudio(send);
      const state = useMapEditState({
        controller,
        sendMessage: send,
        setActiveTool,
        mapEditMode: true,
        isDM,
        snapshotLoaded: true,
        liveMapDocumentId: "palette-map",
        roomGridSize: 50,
        hasRasterBackground: false,
      });
      return { controller, state };
    },
    { initialProps: { isDM: true } },
  );
  const document = createMapDocument({
    id: "palette-map",
    name: "Lantern courtyard",
    width: 4000,
    height: 4000,
    timestamp: 1,
  });
  act(() =>
    hook.result.current.controller.handleServerMessage({ t: "map-studio-document", document }),
  );
  const props = (overrides: Partial<MapEditToolbarProps> = {}): MapEditToolbarProps => ({
    ...hook.result.current.state.toolbarProps,
    ...overrides,
  });
  return { ...hook, props, send, setActiveTool, document };
}
