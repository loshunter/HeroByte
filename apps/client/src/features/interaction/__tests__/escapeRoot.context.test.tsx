// @vitest-environment jsdom
import { StrictMode, Suspense, startTransition, useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createEscapeRegistry, type EscapeRegistry } from "../escapeRegistry";
import {
  EscapeRootProvider,
  useEscapeFramePresence,
  useEscapeOwner,
  useEscapeRoot,
  useEscapeRootContext,
  useLocalEscape,
} from "../useEscapeOwner";
import type { EscapeRoot } from "../escapeTypes";

let registry: EscapeRegistry;
beforeEach(() => {
  registry = createEscapeRegistry(() => window, vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Root({
  name,
  band,
  present = false,
  children,
}: {
  name: string;
  band: number;
  present?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const root = useEscapeRoot(ref, band, registry);
  useEscapeFramePresence(root, present, registry);
  return (
    <EscapeRootProvider value={root}>
      <div ref={ref} data-testid={name}>
        {children}
      </div>
    </EscapeRootProvider>
  );
}

function NestedLayer({
  kind = "panel",
  name,
  close,
  capture,
}: {
  kind?: "panel" | "popover";
  name: string;
  close: () => void;
  capture?: (root: EscapeRoot) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const root = useEscapeRootContext();
  if (!root) throw new Error("Fixture requires one containing root");
  capture?.(root);
  useEscapeOwner(
    () => ({ kind, name, active: true, root, anchor: ref.current, localBand: 999, handle: close }),
    registry,
  );
  return <div ref={ref} data-testid={name} />;
}

describe("root identity and passive presence are separate", () => {
  it("persistent canvas and palette context leave successive Escape fallback reachable", () => {
    const calls: string[] = [];
    let pending = true;
    let tool = true;
    function Driver() {
      useEscapeOwner(
        () => ({
          kind: "gesture",
          active: pending,
          name: "grass",
          order: 0,
          handle: () => {
            pending = false;
            calls.push("cancel");
          },
        }),
        registry,
      );
      useEscapeOwner(
        () => ({
          kind: "tool",
          active: tool,
          name: "paint",
          order: 0,
          handle: () => {
            tool = false;
            calls.push("move");
          },
        }),
        registry,
      );
      useEscapeOwner(
        () => ({
          kind: "selection",
          active: true,
          name: "selection",
          order: 0,
          handle: () => {
            calls.push("clear selection");
          },
        }),
        registry,
      );
      return null;
    }
    const wheel = vi.fn();
    const tree = (open: boolean) => (
      <>
        <Root name="canvas" band={0}>
          <Driver />
          {open && <NestedLayer kind="popover" name="wheel" close={wheel} />}
        </Root>
        <Root name="palette" band={200} />
      </>
    );
    const view = render(tree(true));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(wheel).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
    view.rerender(tree(false));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(calls).toEqual(["cancel"]);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(calls).toEqual(["cancel", "move"]);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(calls).toEqual(["cancel", "move", "clear selection"]);
  });

  it("one wrapper root is shared with its nested window and explicitly blocks beneath Result", () => {
    const chat = vi.fn();
    const captured: EscapeRoot[] = [];
    const tree = (result: boolean) => (
      <>
        <Root name="chat wrapper" band={1000} present>
          <NestedLayer name="chat frame" close={chat} capture={(root) => captured.push(root)} />
        </Root>
        {result && <Root name="result" band={1001} present />}
      </>
    );
    const view = render(tree(true));
    fireEvent.keyDown(screen.getByTestId("chat frame"), { key: "Escape" });
    expect(chat).not.toHaveBeenCalled();
    expect(captured[0].node()).toBe(screen.getByTestId("chat wrapper"));
    expect(captured[0].band()).toBe(1000);
    view.rerender(tree(false));
    expect(captured.at(-1)).toBe(captured[0]);
    fireEvent.keyDown(screen.getByTestId("chat frame"), { key: "Escape" });
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("a still-mounted frame stops blocking when its committed visibility becomes false", () => {
    const chat = vi.fn();
    const tree = (visible: boolean) => (
      <>
        <Root name="chat" band={1000}>
          <NestedLayer name="chat frame" close={chat} />
        </Root>
        <Root name="result" band={1001} present={visible} />
      </>
    );
    const view = render(tree(true));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(chat).not.toHaveBeenCalled();
    view.rerender(tree(false));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("StrictMode leaves one live dispatcher and final unmount calls no close", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const close = vi.fn();
    const view = render(
      <StrictMode>
        <Root name="chat" band={1000} present>
          <NestedLayer name="frame" close={close} />
        </Root>
      </StrictMode>,
    );
    const keyCount = (calls: typeof add.mock.calls) =>
      calls.filter(([key]) => key === "keydown").length;
    expect(keyCount(add.mock.calls) - keyCount(remove.mock.calls)).toBe(1);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(keyCount(add.mock.calls) - keyCount(remove.mock.calls)).toBe(0);
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("only committed renders and eligible local editors act", () => {
  it("an abandoned suspended render cannot publish its proposed callback", () => {
    const oldClose = vi.fn();
    const proposedClose = vi.fn();
    const unresolved = new Promise<void>(() => {});
    function DraftOwner({ close, suspend }: { close: () => void; suspend: boolean }) {
      useEscapeOwner(
        () => ({ kind: "tool", name: "draw", active: true, order: 0, handle: close }),
        registry,
      );
      if (suspend) throw unresolved;
      return <span>Committed tool</span>;
    }
    const tree = (close: () => void, suspend: boolean) => (
      <Suspense fallback={<span>Loading</span>}>
        <DraftOwner close={close} suspend={suspend} />
      </Suspense>
    );
    const view = render(tree(oldClose, false));
    act(() => {
      startTransition(() => {
        view.rerender(tree(proposedClose, true));
      });
    });
    expect(screen.getByText("Committed tool")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(oldClose).toHaveBeenCalledTimes(1);
    expect(proposedClose).not.toHaveBeenCalled();
  });

  it.each(["select", "composition"])("local %s Escape remains entirely native", (mode) => {
    const cancel = vi.fn();
    const close = vi.fn();
    function Editor() {
      const attempt = useLocalEscape(registry);
      return mode === "select" ? (
        <select aria-label="Editor" onKeyDown={(event) => attempt(event, cancel)}>
          <option>One</option>
        </select>
      ) : (
        <input aria-label="Editor" onKeyDown={(event) => attempt(event, cancel)} />
      );
    }
    render(
      <Root name="character" band={2500}>
        <Editor />
        <NestedLayer name="character owner" close={close} />
      </Root>,
    );
    const editor = screen.getByLabelText("Editor");
    if (mode === "composition") fireEvent.compositionStart(editor);
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    fireEvent(editor, event);
    expect(event.defaultPrevented).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
