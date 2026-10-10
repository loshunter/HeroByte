// The desktop roll log receives each seated player's colour (C3) through the
// real chain: DicePanels -> RollLog -> RollLogContent -> the roll's name.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DicePanels } from "../../../layouts/DicePanels";
import { dismissalFocus } from "../dismissalFocus";
import { frameQueue } from "./focusFixtures";
import { viewport } from "./frameInteraction.fixtures";
import { dicePanelProps, roll } from "./desktopFrames.fixtures";

let previousViewport: [number, number];
beforeEach(() => {
  previousViewport = [innerWidth, innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
  frameQueue();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  viewport(...previousViewport);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DicePanels colours", () => {
  it("draws a roll's name in its roller's colour, lifted for the navy", () => {
    render(
      <DicePanels
        {...dicePanelProps()}
        rollHistory={[roll()]}
        playerColors={new Map([["me", "#390076"]])}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "ROLLS" }));
    expect(screen.getByText("Me").style.color).toBe("rgb(136, 103, 215)");
  });

  it("draws a chat line's name in its author's colour, through RollLogContent to ChatTab", () => {
    render(
      <DicePanels
        {...dicePanelProps()}
        chatMessages={[{ id: "m1", authorUid: "bo", authorName: "Bo", text: "hi", timestamp: 1 }]}
        playerColors={new Map([["bo", "#390076"]])}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "CHAT" }));
    const name = screen.getByText(
      (_, element) => element?.tagName === "SPAN" && element.textContent === "Bo: ",
    );
    expect(name.style.color).toBe("rgb(136, 103, 215)");
  });
});
