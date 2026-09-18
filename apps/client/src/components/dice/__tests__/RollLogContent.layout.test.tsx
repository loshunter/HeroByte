// The log panel fills the window that hosts it, and the chat composer lives at
// the bottom of that fill — so the panel's own box model decides whether SEND
// is reachable. jsdom runs no layout, so this cannot measure the clipping that
// UX-11 reported; it pins the one declaration the fix consists of, so that
// removing it fails here instead of silently shipping. The visible proof is a
// browser pass.
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { RollLogContent } from "../RollLogContent";

describe("RollLogContent layout", () => {
  it("sizes its root panel border-box, so height 100% includes padding and border", () => {
    const { container } = render(
      <RollLogContent
        rolls={[]}
        onClearLog={vi.fn()}
        onViewRoll={vi.fn()}
        chatMessages={[]}
        players={[]}
        onSendChat={vi.fn()}
      />,
    );

    const panel = container.querySelector(".jrpg-frame-bevel") as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.style.height).toBe("100%");
    // Without this the panel is 22px taller than the box it fills (8px padding
    // and 3px border on each edge), and the overflow is exactly the composer.
    expect(panel.style.boxSizing).toBe("border-box");
  });
});
