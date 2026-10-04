// @vitest-environment jsdom
import { StrictMode, useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createEscapeRegistry, type EscapeRegistry } from "../escapeRegistry";
import {
  EscapeRootProvider,
  useEscapeOwner,
  useEscapeRoot,
  useEscapeRootContext,
  useLocalEscape,
  usePendingGestureLabel,
} from "../useEscapeOwner";
import type { LayerOwner } from "../escapeTypes";

let registry: EscapeRegistry;
beforeEach(() => {
  registry = createEscapeRegistry(() => window, vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Layer({
  name,
  band,
  kind = "panel",
  children,
  close,
}: {
  name: string;
  band: number;
  kind?: LayerOwner["kind"];
  children?: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const root = useEscapeRoot(ref, band, registry);
  useEscapeOwner(
    () => ({
      kind,
      name,
      active: true,
      root,
      anchor: ref.current,
      handle: close,
    }),
    registry,
  );
  return (
    <EscapeRootProvider value={root}>
      <div ref={ref} role="dialog" aria-label={name}>
        {children}
      </div>
    </EscapeRootProvider>
  );
}

function LocalEditor({ cancel }: { cancel: () => void }) {
  const tryCancel = useLocalEscape(registry);
  return <input aria-label="Local editor" onKeyDown={(event) => tryCancel(event, cancel)} />;
}

function Effects({ cancel }: { cancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const root = useEscapeRootContext();
  if (!root) throw new Error("Fixture requires parent root");
  useEscapeOwner(
    () => ({
      kind: "popover",
      name: "effects",
      active: true,
      root,
      anchor: ref.current,
      localBand: 1000,
      handle: cancel,
    }),
    registry,
  );
  return <div ref={ref}>Effects</div>;
}

describe("React adapter lifetime and local ownership", () => {
  it("uses committed live callbacks without listener churn on ordinary rerenders", () => {
    const add = vi.spyOn(window, "addEventListener");
    const oldClose = vi.fn();
    const newClose = vi.fn();
    const view = render(<Layer name="chat" band={1000} close={oldClose} />);
    view.rerender(<Layer name="chat" band={1000} close={newClose} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(oldClose).not.toHaveBeenCalled();
    expect(newClose).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([key]) => key === "keydown")).toHaveLength(1);
  });

  it("StrictMode rehearsal and final unmount never leave duplicate/stale owners", () => {
    const close = vi.fn();
    const view = render(
      <StrictMode>
        <Layer name="chat" band={1000} close={close} />
      </StrictMode>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    view.unmount();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    expect(registry.getPendingLabel()).toBeNull();
  });

  it("valid local cancellation blocks React ancestors and the global owner", () => {
    const local = vi.fn();
    const close = vi.fn();
    const ancestor = vi.fn();
    render(
      <Layer name="chat" band={1000} close={close}>
        <div onKeyDown={ancestor}>
          <LocalEditor cancel={local} />
        </div>
      </Layer>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(local).toHaveBeenCalledTimes(1);
    expect(ancestor).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("a retained lower input focus does not cancel that editor before higher Help", () => {
    const local = vi.fn();
    const chat = vi.fn();
    const help = vi.fn();
    const view = render(
      <>
        <Layer name="chat" band={1000} close={chat}>
          <LocalEditor cancel={local} />
        </Layer>
      </>,
    );
    const input = screen.getByRole("textbox");
    input.focus();
    view.rerender(
      <>
        <Layer name="chat" band={1000} close={chat}>
          <LocalEditor cancel={local} />
        </Layer>
        <Layer name="help" kind="popover" band={2000} close={help} />
      </>,
    );
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(local).not.toHaveBeenCalled();
    expect(help).toHaveBeenCalledTimes(1);
    expect(chat).not.toHaveBeenCalled();
  });

  it("a nested effects owner shares the Character root through context", () => {
    const alice = vi.fn();
    const effects = vi.fn();
    const bob = vi.fn();
    render(
      <>
        <Layer name="alice" band={2500} close={alice}>
          <Effects cancel={effects} />
        </Layer>
        <Layer name="bob" band={2500} close={bob} />
      </>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(bob).toHaveBeenCalledTimes(1);
    expect(effects).not.toHaveBeenCalled();
    expect(alice).not.toHaveBeenCalled();
  });

  it("unmount does not itself call a dismissal callback", () => {
    const close = vi.fn();
    const view = render(<Layer name="character" band={2500} close={close} />);
    view.unmount();
    expect(close).not.toHaveBeenCalled();
  });

  it("gesture registration and modal registration reconcile both React effect orders", () => {
    const cancel = vi.fn();
    function Driver() {
      const pending = useRef(true);
      useEscapeOwner(
        () => ({
          kind: "gesture",
          name: "brush",
          active: pending.current,
          order: 0,
          handle: () => {
            pending.current = false;
            cancel();
          },
        }),
        registry,
      );
      return null;
    }
    const view = render(
      <>
        <Driver />
        <Layer name="elevation" kind="modal" band={3000} close={vi.fn()} />
      </>,
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    view.unmount();
    render(
      <>
        <Layer name="elevation" kind="modal" band={3000} close={vi.fn()} />
        <Driver />
      </>,
    );
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});

describe("optional scalar pending view", () => {
  it("a sibling control observes pending refs and invokes the same cancellation", () => {
    let start: () => void = () => {};
    const cancelled = vi.fn();
    function Driver() {
      const pending = useRef(false);
      const notify = useEscapeOwner(
        () => ({
          kind: "gesture",
          name: "annotation",
          active: pending.current,
          order: 0,
          label: "Cancel drawing",
          handle: () => {
            pending.current = false;
            cancelled();
          },
        }),
        registry,
      );
      start = () => {
        pending.current = true;
        notify();
      };
      return null;
    }
    function Control() {
      const label = usePendingGestureLabel(registry);
      return label ? (
        <button onClick={registry.cancelPending}>{label}</button>
      ) : (
        <span>No pending gesture</span>
      );
    }
    render(
      <>
        <Driver />
        <Control />
      </>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    act(() => start());
    fireEvent.click(screen.getByRole("button", { name: "Cancel drawing" }));
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("No pending gesture")).toBeTruthy();
  });
});
