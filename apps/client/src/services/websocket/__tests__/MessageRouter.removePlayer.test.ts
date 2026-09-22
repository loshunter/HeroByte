import { describe, expect, it, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

// The Players tab's REMOVE has exactly one failure surface: the server's
// remove-player-refused frame, sent to the DM alone. The first live pass of
// the feature watched the server refuse and the router warn-drop the frame as
// an "unknown message type" — the same road session-file shipped inert on.
// This reds when the runtime guard entry goes; tsc catches the type lists.
describe("MessageRouter remove-player events", () => {
  it("routes remove-player-refused as a control message instead of dropping it", () => {
    const onMessage = vi.fn();
    const onControlMessage = vi.fn();
    const router = new MessageRouter({ onMessage, onControlMessage });

    const message = { t: "remove-player-refused", uid: "ghost", reason: "connected" };
    router.route(JSON.stringify(message));

    expect(onControlMessage).toHaveBeenCalledWith(message);
    expect(onMessage).not.toHaveBeenCalled();
  });
});
