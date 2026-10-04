import { afterEach, vi } from "vitest";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";
import { MapStudioService } from "../../../../domains/mapStudio/service.js";
import { createEmptyRoomState } from "../../../../domains/room/model.js";
import { MapStudioMessageHandler } from "../../MapStudioMessageHandler.js";

afterEach(() => vi.restoreAllMocks());

export const generation: Extract<ClientMessage, { t: "map-studio-generate" }> = {
  t: "map-studio-generate",
  documentId: "outcome-map",
  commandId: "generation-1",
  recipe: "dungeon",
  seed: 42,
  bounds: { x: 2, y: 2, cols: 24, rows: 20 },
  params: { theme: "stone", density: "medium" },
};

export function outcomeHarness() {
  const service = new MapStudioService();
  service.create("outcome-room", { id: "outcome-map", name: "Outcome map", timestamp: 1 });
  const room = createEmptyRoomState();
  const send = vi.fn<(uid: string, message: ServerMessage) => void>();
  const broadcast = vi.fn<(roomId: string, message: ServerMessage) => void>();
  const handler = new MapStudioMessageHandler(
    service,
    send,
    broadcast,
    () => room,
    () => 100,
  );
  const generate = () => handler.handle(generation, "outcome-dm", "outcome-room", true);
  const document = () => service.get("outcome-room", "outcome-map");
  const errors = () =>
    send.mock.calls
      .map(([, message]) => message)
      .filter(
        (message): message is Extract<ServerMessage, { t: "map-studio-error" }> =>
          "t" in message && message.t === "map-studio-error",
      );
  const clearFrames = () => {
    send.mockClear();
    broadcast.mockClear();
  };
  return { service, room, send, broadcast, generate, document, errors, clearFrames };
}
