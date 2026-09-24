import { useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KickPanel } from "../../atlas/KickPanel";
import { useKickedInDoor, type AtlasErrorMessage } from "../../atlas/useKickedInDoor";
import { DMMenu } from "../../dm/components/DMMenu";
import { dismissalFocus } from "../dismissalFocus";
import { escapeRegistry } from "../useEscapeOwner";
import { dmProps } from "./desktopFrames.fixtures";
import { frameQueue, visible } from "./focusFixtures";
import { viewport } from "./frameInteraction.fixtures";
import { escape, kickCalls, type KickCalls } from "./popoverOwners.fixtures";

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

// The real DM frame launches the real hook and panel through its Atlas action.
function DmKickHarness({ calls }: { calls: KickCalls }) {
  const atlasErrorRef = useRef<((message: AtlasErrorMessage) => void) | null>(null);
  const kick = useKickedInDoor({
    isDM: true,
    snapshot: null,
    activeTool: null,
    sendMessage: calls.send,
    toast: calls.toast,
    atlasErrorRef,
  });
  return (
    <>
      <DMMenu {...dmProps()} onOpenKick={kick.openKick} />
      {kick.open && (
        <KickPanel
          atlasNodes={[]}
          kick={{
            ...kick,
            closeKick: () => {
              calls.close();
              kick.closeKick();
            },
          }}
        />
      )}
    </>
  );
}

function openFromAtlas() {
  const calls = kickCalls();
  render(<DmKickHarness calls={calls} />);
  const launcher = visible(screen.getByRole("button", { name: /DM MENU/ }));
  fireEvent.click(launcher);
  fireEvent.click(screen.getByRole("button", { name: "Atlas" }));
  const draft = screen.getByLabelText("New node name");
  fireEvent.change(draft, { target: { value: "Unsent Atlas draft" } });
  fireEvent.click(screen.getByRole("button", { name: /KICK IN A DOOR/ }));
  return { calls, launcher, draft };
}

describe("desktop DM → Kick foreground ordering", () => {
  it.each(["name", "body"])(
    "first Escape from %s closes Kick only, preserving DM's draft and focus ownership",
    (site) => {
      const request = vi.spyOn(dismissalFocus, "request");
      const { calls, launcher, draft } = openFromAtlas();
      const field = screen.getByLabelText("Name");
      const dmClose = screen.getByRole("button", { name: "Close Dungeon Master Tools" });
      expect(document.activeElement).toBe(field);

      expect(escape(site === "name" ? field : document.body).defaultPrevented).toBe(true);
      expect(screen.queryByTestId("kick-panel")).not.toBeInTheDocument();
      expect(calls.close).toHaveBeenCalledTimes(1);
      expect(dmClose).toBeInTheDocument();
      expect(draft).toHaveValue("Unsent Atlas draft");
      expect(screen.getByLabelText("New node name")).toBe(draft);
      act(() => queue.flush());
      expect(request).not.toHaveBeenCalled();
      expect(document.activeElement).not.toBe(launcher);
      expect(calls.send).not.toHaveBeenCalled();

      escape(document.body);
      expect(dmClose).not.toBeInTheDocument();
      act(() => queue.flush());
      expect(document.activeElement).toBe(launcher);
      expect(calls.close).toHaveBeenCalledTimes(1);
    },
  );

  it("Kick's painted layer and Escape root agree above DM and below Help/Character", () => {
    const register = vi.spyOn(escapeRegistry, "register");
    openFromAtlas();
    const owners = register.mock.calls.map(([read]) => read());
    const kick = owners.find((owner) => owner.name === "Kick in a door");
    const dm = owners.find((owner) => owner.name === "dm");
    if (!kick || !dm || !("root" in kick) || !("root" in dm)) {
      throw new Error("Missing real DM or Kick owner");
    }
    expect(kick.root.band()).toBeGreaterThan(dm.root.band());
    expect(kick.root.band()).toBeLessThan(2000);
    expect(kick.root.band()).toBeLessThan(2500);
    expect(kick.root.node()).toHaveStyle({ zIndex: kick.root.band() });
    expect(dm.root.node()).toHaveStyle({ zIndex: dm.root.band() });
  });
});
