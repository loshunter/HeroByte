import { describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { MessageRouter } from "../MessageRouter";

describe("MessageRouter Map Studio events", () => {
  it.each([
    { t: "map-studio-documents", documents: [] },
    {
      t: "map-studio-document",
      document: createMapDocument({ id: "map", name: "Map", timestamp: 1 }),
    },
    { t: "map-studio-deleted", documentId: "map" },
    {
      t: "map-studio-error",
      commandId: "command",
      documentId: "map",
      code: "revision-conflict",
      reason: "Map changed",
      actualRevision: 2,
    },
  ])("routes $t as a control message instead of a room snapshot", (message) => {
    const onMessage = vi.fn();
    const onControlMessage = vi.fn();
    const router = new MessageRouter({ onMessage, onControlMessage });

    router.route(JSON.stringify(message));

    expect(onControlMessage).toHaveBeenCalledWith(message);
    expect(onMessage).not.toHaveBeenCalled();
  });
});
