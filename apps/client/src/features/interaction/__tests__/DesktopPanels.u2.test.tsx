import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorldMapPanel } from "../../atlas/WorldMapPanel";
import { DMMenu } from "../../dm/components/DMMenu";
import { DicePanels } from "../../../layouts/DicePanels";
import { Header } from "../../../components/layout/Header";
import { dismissalFocus } from "../dismissalFocus";
import { escapeRegistry } from "../useEscapeOwner";
import { frameQueue, visible } from "./focusFixtures";
import { viewport } from "./frameInteraction.fixtures";
import { dicePanelProps, dmProps } from "./desktopFrames.fixtures";

let queue: ReturnType<typeof frameQueue>;
let previousViewport: [number, number];
beforeEach(() => {
  previousViewport = [innerWidth, innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
  queue = frameQueue();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  viewport(...previousViewport);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("desktop close opt-ins", () => {
  it.each(["world", "dm"] as const)("%s launcher → Escape → same launcher", (panel) => {
    render(
      panel === "world" ? (
        <WorldMapPanel snapshot={null} launcherDock={document.body} />
      ) : (
        <DMMenu {...dmProps()} />
      ),
    );
    const opener = visible(
      screen.getByRole("button", { name: panel === "world" ? /WORLD/ : /DM MENU/ }),
    );
    fireEvent.click(opener);
    expect(document.activeElement).toBe(opener);
    const closeName = panel === "world" ? "Close World Map" : "Close Dungeon Master Tools";
    expect(screen.getByRole("button", { name: closeName })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("button", { name: closeName })).not.toBeInTheDocument();
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
  });

  it("the real Chat wrapper is the root at 1000 and its inner window is layer 999", () => {
    const register = vi.spyOn(escapeRegistry, "register");
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Header
            uid="me"
            snapToGrid
            activeTool={null}
            crtFilter={false}
            diceRollerOpen={false}
            rollLogOpen={open}
            onSnapToGridChange={vi.fn()}
            onToolSelect={vi.fn()}
            onCrtFilterChange={vi.fn()}
            onDiceRollerToggle={vi.fn()}
            onRollLogToggle={setOpen}
            onResetCamera={vi.fn()}
          />
          <DicePanels {...dicePanelProps()} rollLogOpen={open} toggleRollLog={setOpen} />
        </>
      );
    }
    render(<Harness />);
    const opener = visible(screen.getByRole("button", { name: /Chat & Rolls/ }));
    fireEvent.click(opener);
    const owner = register.mock.calls
      .map(([read]) => read())
      .find((value) => value.name === "chat");
    expect(owner?.kind).toBe("panel");
    if (!owner || owner.kind !== "panel") throw new Error("Missing actual Chat owner");
    expect(owner.root.band()).toBe(1000);
    expect(owner.localBand).toBe(999);
    expect(owner.root.node()).not.toBe(owner.anchor);
    expect(owner.root.node()?.contains(owner.anchor)).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Close Chat & Rolls" })).not.toBeInTheDocument();
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
  });

  it("DM role loss takes the raw close path and does not return focus", () => {
    const request = vi.spyOn(dismissalFocus, "request");
    const props = dmProps();
    const view = render(<DMMenu {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/ }));
    view.rerender(<DMMenu {...props} isDM={false} />);
    act(() => queue.flush());
    expect(
      screen.queryByRole("button", { name: "Close Dungeon Master Tools" }),
    ).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
