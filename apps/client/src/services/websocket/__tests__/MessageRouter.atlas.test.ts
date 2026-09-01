import { describe, expect, it, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

// THREE hand-lists must agree on a new server message (websocket.ts's config
// copy, MessageRouter's type union, and its runtime isControlMessage guard) —
// and ONLY the runtime guard changes behavior: an unlisted type is silently
// warn-dropped at the router's floor, which is how a new server message ships
// inert. This test reds when the GUARD entry is removed; tsc catches the two
// type lists.
describe("MessageRouter atlas events", () => {
  it("routes atlas-error as a control message instead of dropping it", () => {
    const onMessage = vi.fn();
    const onControlMessage = vi.fn();
    const router = new MessageRouter({ onMessage, onControlMessage });

    const message = {
      t: "atlas-error",
      code: "rejected",
      reason: "That node already has a map.",
      nodeId: "n1",
    };
    router.route(JSON.stringify(message));

    expect(onControlMessage).toHaveBeenCalledWith(message);
    expect(onMessage).not.toHaveBeenCalled();
  });
});
