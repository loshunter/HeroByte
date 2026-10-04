import { act, render } from "@testing-library/react";
import { vi } from "vitest";
import {
  createMapDocument,
  type ClientMessage,
  type MapDocument,
  type MapDoorElement,
} from "@herobyte/shared";
import { useMapStudio } from "../../map-studio/useMapStudio";
import type { MapStudioController, MapStudioServerMessage } from "../../map-studio/types";
import type {
  CommandDeliveryEvent,
  RegisterCommandDelivery,
} from "../../../services/websocket/serviceTypes";
import { useMapEditState } from "../useMapEditState";
import { MapEditDocumentPanels } from "../MapEditDocumentPanels";
import { MobileSelectPanel } from "../mobile/MobileSelectPanel";

export const propertyDoor: MapDoorElement = {
  id: "door-a",
  type: "door",
  layerId: "walls",
  hidden: false,
  locked: false,
  transform: { x: 100, y: 150, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
};
export const propertyDocument = (id = "properties-a"): MapDocument => ({
  ...createMapDocument({ id, name: id, timestamp: 1 }),
  elements: [structuredClone(propertyDoor), { ...structuredClone(propertyDoor), id: "door-b" }],
});

export function propertyHarness(mobile = false) {
  let delivery: (event: CommandDeliveryEvent) => void = () => {};
  const register: RegisterCommandDelivery = (handler) => {
    delivery = handler;
    return () => {};
  };
  const send = vi.fn<(message: ClientMessage) => void>((message) =>
    delivery({ type: "send-attempt", message }),
  );
  const setActiveTool = vi.fn();
  let current!: { controller: MapStudioController; state: ReturnType<typeof useMapEditState> };
  function App({ phone = mobile, dm = true, shown = true, loaded = true } = {}) {
    const controller = useMapStudio(send, undefined, true, register);
    const state = useMapEditState({
      controller,
      sendMessage: send,
      setActiveTool,
      mapEditMode: true,
      isDM: dm,
      snapshotLoaded: loaded,
      liveMapDocumentId: "properties-a",
      sceneSourceDocumentId: undefined,
      roomGridSize: 50,
      hasRasterBackground: false,
    });
    current = { controller, state };
    if (!shown) return null;
    return phone ? (
      <MobileSelectPanel {...state.toolbarProps} />
    ) : (
      <MapEditDocumentPanels {...state.toolbarProps} inspectorOpen />
    );
  }
  const view = render(<App />);
  const initial = propertyDocument();
  const receive = async (message: MapStudioServerMessage) => {
    await act(async () => {
      current.controller.handleServerMessage(message);
      await Promise.resolve();
    });
  };
  const select = (id: string | null) => act(() => current.state.onSelectElement(id));
  const commands = () =>
    send.mock.calls
      .map(([m]) => m)
      .filter(
        (m): m is Extract<ClientMessage, { t: "map-studio-command" }> =>
          m.t === "map-studio-command",
      );
  const command = (index = 0) => {
    const message = commands()[index];
    if (!message) throw new Error(`No property command ${index}`);
    return message.command;
  };
  return {
    ...view,
    send,
    initial,
    receive,
    select,
    commands,
    command,
    current: () => current,
    presentation: (options: { phone?: boolean; dm?: boolean; shown?: boolean; loaded?: boolean }) =>
      view.rerender(<App {...options} />),
    open: async (document: MapDocument) => {
      act(() => current.controller.openDocument(document.id));
      await receive({ t: "map-studio-document", document });
    },
    start: async () => {
      await receive({ t: "map-studio-document", document: initial });
      select(propertyDoor.id);
    },
    ack: async (index: number, document: MapDocument) =>
      receive({ t: "map-studio-document", document, appliedCommandId: command(index).commandId }),
    refuse: async (index: number, uncertain = false) =>
      receive({
        t: "map-studio-error",
        documentId: command(index).documentId,
        commandId: command(index).commandId,
        code: uncertain ? "command-rejected" : "command-not-applied",
        reason: "Authoritative refusal",
      }),
  };
}
