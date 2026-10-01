// Real launchers, machine and frames; fireEvent.click deliberately supplies no focus.
import { useState, type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileFloatingControls } from "../MobileFloatingControls";
import { MobilePlayerRow } from "../MobilePlayerRow";
import { useMobileSurface, type MobileSurface } from "../../../hooks/useMobileSurface";
import { MobileScreen } from "../../../layouts/mobile/MobileScreen";
import { toolbarProps } from "../../../layouts/mobile/__tests__/mobileInteraction.fixtures";
import { dismissalFocus } from "../../../features/interaction/dismissalFocus";
import { frameQueue, visible } from "../../../features/interaction/__tests__/focusFixtures";

let queue: ReturnType<typeof frameQueue>;
beforeEach(() => {
  queue = frameQueue();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  vi.restoreAllMocks();
});

function DockHost({
  isDM,
  onToggle,
}: {
  isDM: boolean;
  onToggle: (surface: MobileSurface, focused: Element | null) => void;
}) {
  const [diceRollerOpen, toggleDiceRoller] = useState(false);
  const [rollLogOpen, toggleRollLog] = useState(false);
  const machine = useMobileSurface({
    diceRollerOpen,
    toggleDiceRoller,
    rollLogOpen,
    toggleRollLog,
    isDM,
    mapEditMode: false,
    alignmentMode: false,
  });
  const panel = machine.surface === "log" ? "chat" : machine.surface === "dm" ? "dm" : null;
  return (
    <>
      <input aria-label="Previously focused control" />
      <MobileFloatingControls
        surface={machine.surface}
        worldReturn={machine.worldReturn}
        onToggleSurface={(next) => {
          onToggle(next, document.activeElement);
          machine.toggleSurface(next);
        }}
        onToolSelect={vi.fn()}
        onSnapToGridChange={vi.fn()}
        onResetCamera={vi.fn()}
        activeTool={null}
        snapToGrid={false}
        isDM={isDM}
        mode={false}
        mapEditToolbarProps={toolbarProps()}
      />
      {panel && (
        <MobileScreen
          title={panel === "chat" ? "Chat & Rolls" : "DM Menu"}
          surface={panel === "chat" ? "log" : "dm"}
          isConnected
          onClose={machine.closeExplicitSurface}
          interaction={{ behavior: "close", panel }}
        >
          <input aria-label="Frame autofocus" autoFocus />
        </MobileScreen>
      )}
    </>
  );
}

describe("actual phone dock launchers", () => {
  it.each([
    ["Chat", "log", false, "Chat & Rolls"],
    ["DM", "dm", true, "DM Menu"],
  ] as const)(
    "%s focuses its exact button before the machine opens the frame",
    (label, surface, isDM, title) => {
      const onToggle = vi.fn();
      render(<DockHost isDM={isDM} onToggle={onToggle} />);
      const dock = screen.getByRole("navigation", { name: "Mobile actions" });
      const opener = visible(within(dock).getByRole("button", { name: label }));
      screen.getByRole("textbox", { name: "Previously focused control" }).focus();
      expect(document.activeElement).not.toBe(opener);
      const focus = vi.spyOn(opener, "focus");
      fireEvent.click(opener);
      expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
      expect(onToggle).toHaveBeenCalledExactlyOnceWith(surface, opener);
      expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Frame autofocus" }));
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      act(() => queue.flush());
      expect(screen.queryByRole("dialog", { name: title })).toBeNull();
      expect(document.activeElement).toBe(opener);
      expect(onToggle).toHaveBeenCalledTimes(1);
    },
  );

  it("retains the player's five-slot dock and DM gate", () => {
    const onToggle = vi.fn();
    render(<DockHost isDM={false} onToggle={onToggle} />);
    const dock = screen.getByRole("navigation", { name: "Mobile actions" });
    expect(within(dock).getAllByRole("button")).toHaveLength(5);
    expect(within(dock).queryByRole("button", { name: "DM" })).toBeNull();
    expect(within(dock).getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
  });
});

function rowProps(isMe: boolean, isDM: boolean): ComponentProps<typeof MobilePlayerRow> {
  return {
    player: { uid: "seat-alice", characterId: "pc-alice", name: "Alice", hp: 10, maxHp: 10 },
    isMe,
    isDM,
    editingHpUID: null,
    hpInput: "",
    onHpInputChange: vi.fn(),
    onHpEdit: vi.fn(),
    onHpSubmit: vi.fn(),
    editingMaxHpUID: null,
    maxHpInput: "",
    onMaxHpInputChange: vi.fn(),
    onMaxHpEdit: vi.fn(),
    onMaxHpSubmit: vi.fn(),
    onCharacterHpChange: vi.fn(),
    onCharacterNameUpdate: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
  };
}

describe("actual phone Character EDIT launcher", () => {
  it.each([
    [true, false],
    [false, true],
  ])("captures EDIT before opening for owner=%s/DM=%s", (isMe, isDM) => {
    const props = rowProps(isMe, isDM);
    render(
      <>
        <input aria-label="Previously focused control" />
        <MobilePlayerRow {...props} />
      </>,
    );
    const opener = visible(screen.getByRole("button", { name: /EDIT/ }));
    const focusBeforeFrame = vi.fn(() => ({
      focused: document.activeElement,
      frameOpen: Boolean(screen.queryByPlaceholderText("Enter Name")),
    }));
    opener.addEventListener("focus", focusBeforeFrame);
    screen.getByRole("textbox", { name: "Previously focused control" }).focus();
    const focus = vi.spyOn(opener, "focus");
    fireEvent.click(opener);
    expect(focusBeforeFrame).toHaveBeenCalledTimes(1);
    expect(focusBeforeFrame.mock.results[0].value).toEqual({ focused: opener, frameOpen: false });
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    opener.removeEventListener("focus", focusBeforeFrame);
    const name = screen.getByPlaceholderText("Enter Name");
    name.focus();
    fireEvent.keyDown(name, { key: "Escape" });
    act(() => queue.flush());
    expect(screen.queryByPlaceholderText("Enter Name")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(props.onCharacterNameUpdate).not.toHaveBeenCalled();
  });

  it("still refuses another player's EDIT to a plain player", () => {
    render(<MobilePlayerRow {...rowProps(false, false)} />);
    expect(screen.queryByRole("button", { name: /EDIT/ })).toBeNull();
    expect(screen.queryByPlaceholderText("Enter Name")).toBeNull();
  });
});
