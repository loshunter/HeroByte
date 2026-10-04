// @vitest-environment jsdom
import { useLayoutEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileScreen } from "../MobileScreen";
import { MobileSheet } from "../MobileSheet";
import { dismissalFocus } from "../../../features/interaction/dismissalFocus";
import {
  escapeRegistry,
  useEscapeOwner,
  useEscapeRootContext,
} from "../../../features/interaction/useEscapeOwner";
import type { EscapeRoot } from "../../../features/interaction/escapeTypes";
import { frameQueue, launcher } from "../../../features/interaction/__tests__/focusFixtures";

let queue: ReturnType<typeof frameQueue>;
beforeEach(() => {
  queue = frameQueue();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function Probe({ capture }: { capture: (root: EscapeRoot | null) => void }) {
  const root = useEscapeRootContext();
  useLayoutEffect(() => {
    capture(root);
  }, [capture, root]);
  return <button>Inner control</button>;
}
function HiddenTool({ handle }: { handle: () => void }) {
  useEscapeOwner(() => ({ kind: "tool", name: "underlying map", active: true, order: 0, handle }));
  return null;
}
function PendingGesture({ cancel }: { cancel: () => void }) {
  const [active, setActive] = useState(true);
  useEscapeOwner(() => ({
    kind: "gesture",
    name: "held map stroke",
    active,
    order: 0,
    handle: () => {
      cancel();
      setActive(false);
    },
  }));
  return null;
}

describe("ordinary phone frames block without gaining Escape dismissal", () => {
  it("cancels a pending gesture before the passive screen consumes the next Escape", () => {
    const cancel = vi.fn();
    const tool = vi.fn();
    const close = vi.fn();
    render(
      <>
        <PendingGesture cancel={cancel} />
        <HiddenTool handle={tool} />
        <MobileScreen title="Party" surface="party" isConnected onClose={close}>
          <p>Party</p>
        </MobileScreen>
      </>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(cancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(tool).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(queue.count()).toBe(0);
  });
  it.each(["party", "props", "kick", "tools", "help"] as const)(
    "%s provides its exact connected root and preserves only its existing X close",
    (surface) => {
      const close = vi.fn();
      const tool = vi.fn();
      const capture = vi.fn<(root: EscapeRoot | null) => void>();
      const content = <Probe capture={capture} />;
      render(
        <>
          <HiddenTool handle={tool} />
          {surface === "tools" || surface === "help" ? (
            <MobileSheet title={surface} label={surface} surface={surface} onClose={close}>
              {content}
            </MobileSheet>
          ) : (
            <MobileScreen title={surface} surface={surface} isConnected onClose={close}>
              {content}
            </MobileScreen>
          )}
        </>,
      );
      const dialog = screen.getByRole("dialog", { name: surface });
      const root = capture.mock.calls.at(-1)?.[0];
      expect(root?.node()).toBe(dialog);
      expect(root?.band()).toBe(surface === "tools" || surface === "help" ? 1600 : 1700);
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(close).not.toHaveBeenCalled();
      expect(tool).not.toHaveBeenCalled();
      const canvas = document.createElement("button");
      document.body.append(canvas);
      const canvasRoot: EscapeRoot = { node: () => canvas, band: () => 0 };
      expect(
        escapeRegistry.canHandleShortcut(
          new KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
          { root: canvasRoot, anchor: canvas },
        ),
      ).toBe(false);
      fireEvent.click(within(dialog).getByRole("button", { name: /^Close/ }));
      expect(close).toHaveBeenCalledTimes(1);
      expect(queue.count()).toBe(0);
    },
  );
});

describe("only explicit Chat/World/DM screen opt-ins gain close and return", () => {
  it.each(["chat", "world", "dm"] as const)("%s shares X and Escape dismissal", (panel) => {
    const opener = launcher();
    opener.focus();
    const closed = vi.fn();
    const surface = panel === "chat" ? "log" : panel === "world" ? "atlas" : "dm";
    function Host() {
      const [open, setOpen] = useState(true);
      return open ? (
        <MobileScreen
          title={panel}
          surface={surface}
          isConnected
          interaction={{ behavior: "close", panel }}
          onClose={() => {
            closed();
            setOpen(false);
          }}
        >
          <input aria-label="Draft" autoFocus />
        </MobileScreen>
      ) : null;
    }
    const view = render(<Host />);
    fireEvent.keyDown(screen.getByLabelText("Draft"), { key: "Escape" });
    expect(closed).toHaveBeenCalledTimes(1);
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
    view.unmount();
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: `Close ${panel}` }));
    expect(closed).toHaveBeenCalledTimes(2);
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
  });

  it.each(["native select", "composition"] as const)("%s retains first refusal", (mode) => {
    const close = vi.fn();
    render(
      <MobileScreen
        title="Chat"
        surface="log"
        isConnected
        onClose={close}
        interaction={{ behavior: "close", panel: "chat" }}
      >
        {mode === "native select" ? (
          <select aria-label="Editor">
            <option>One</option>
          </select>
        ) : (
          <input aria-label="Editor" />
        )}
      </MobileScreen>,
    );
    const editor = screen.getByLabelText("Editor");
    if (mode === "composition") fireEvent.compositionStart(editor);
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    fireEvent(editor, event);
    expect(event.defaultPrevented).toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(queue.count()).toBe(0);
  });

  it("raw screen removal creates no dismissal or focus ticket", () => {
    const close = vi.fn();
    const view = render(
      <MobileScreen
        title="DM"
        surface="dm"
        isConnected
        onClose={close}
        interaction={{ behavior: "close", panel: "dm" }}
      >
        <input autoFocus />
      </MobileScreen>,
    );
    view.unmount();
    expect(close).not.toHaveBeenCalled();
    expect(queue.count()).toBe(0);
  });
});
