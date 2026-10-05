import { describe, expect, it, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

// A locked piece is moved or deleted by no one, the DM included; the server tells the
// one who tried with locked-refused, sent to them alone. Like remove-player-refused,
// it must reach the control handler: an unlisted type is warn-dropped at the router's
// floor, and the refusal would be silent. This reds when the runtime guard entry goes.
describe("MessageRouter locked-refused events", () => {
  it("routes locked-refused as a control message instead of dropping it", () => {
    const onMessage = vi.fn();
    const onControlMessage = vi.fn();
    const router = new MessageRouter({ onMessage, onControlMessage });

    const message = { t: "locked-refused", ids: ["token:t-1"] };
    router.route(JSON.stringify(message));

    expect(onControlMessage).toHaveBeenCalledWith(message);
    expect(onMessage).not.toHaveBeenCalled();
  });
});
