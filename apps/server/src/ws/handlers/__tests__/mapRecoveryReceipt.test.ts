import { describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@herobyte/shared";
import { MapStudioService } from "../../../domains/mapStudio/service.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import { validateMapStudioDocumentIdMessage } from "../../../middleware/validators/mapStudioValidators.js";
import { MapStudioMessageHandler } from "../MapStudioMessageHandler.js";

function setup() {
  const service = new MapStudioService();
  const send = vi.fn<(uid: string, message: ServerMessage) => void>();
  const broadcast = vi.fn<(roomId: string, message: ServerMessage) => void>();
  const handler = new MapStudioMessageHandler(service, send, broadcast, createEmptyRoomState);
  service.create("room", { id: "map", name: "Map", timestamp: 1 });
  return { handler, send, broadcast };
}

describe("private map recovery GET receipts", () => {
  it.each(["map", "missing"])(
    "echoes request identity only to the requesting DM for %s",
    (documentId) => {
      const h = setup();
      const request = { t: "map-studio-get" as const, documentId, requestId: "recovery-1" };
      h.handler.handle(request, "dm-one", "room", true);
      expect(h.send).toHaveBeenCalledTimes(1);
      expect(h.send).toHaveBeenCalledWith(
        "dm-one",
        expect.objectContaining({
          t: documentId === "map" ? "map-studio-document" : "map-studio-error",
          requestId: "recovery-1",
        }),
      );
      expect(h.broadcast).not.toHaveBeenCalled();
    },
  );

  it("preserves legacy GET replies without inventing a receipt", () => {
    const h = setup();
    h.handler.handle({ t: "map-studio-get", documentId: "map" }, "dm-one", "room", true);
    expect(h.send.mock.calls[0]?.[1]).not.toHaveProperty("requestId");
    expect(h.broadcast).not.toHaveBeenCalled();
  });

  it("refuses a player before looking up or disclosing a document", () => {
    const h = setup();
    const request = { t: "map-studio-get" as const, documentId: "map", requestId: "player-probe" };
    expect(() => h.handler.handle(request, "player", "room", false)).toThrow("DM permission");
    expect(h.send).not.toHaveBeenCalled();
    expect(h.broadcast).not.toHaveBeenCalled();
  });

  it.each(["", " ", "x".repeat(129), 7, null])(
    "rejects invalid recovery identity %j",
    (requestId) => {
      expect(
        validateMapStudioDocumentIdMessage({ t: "map-studio-get", documentId: "map", requestId })
          .valid,
      ).toBe(false);
    },
  );

  it("accepts legacy and bounded correlated GETs", () => {
    expect(
      validateMapStudioDocumentIdMessage({ t: "map-studio-get", documentId: "map" }).valid,
    ).toBe(true);
    expect(
      validateMapStudioDocumentIdMessage({
        t: "map-studio-get",
        documentId: "map",
        requestId: "recovery-1",
      }).valid,
    ).toBe(true);
  });
});
