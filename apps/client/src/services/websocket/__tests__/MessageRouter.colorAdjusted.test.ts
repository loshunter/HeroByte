import { describe, expect, it, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

// Personal colour (C1): the server snaps a chosen colour out of another player's
// zone and tells the sender alone with color-adjusted. Like locked-refused, it must
// reach the control handler: an unlisted type is warn-dropped at the router's floor,
// and the player would see their colour jump with no word of why.
describe("MessageRouter color-adjusted events", () => {
  it("routes color-adjusted as a control message instead of dropping it", () => {
    const onMessage = vi.fn();
    const onControlMessage = vi.fn();
    const router = new MessageRouter({ onMessage, onControlMessage });

    const message = { t: "color-adjusted", tokenId: "t-1", color: "#aabbcc", near: "Bors" };
    router.route(JSON.stringify(message));

    expect(onControlMessage).toHaveBeenCalledWith(message);
    expect(onMessage).not.toHaveBeenCalled();
  });
});
