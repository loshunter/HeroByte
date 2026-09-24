import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ActualModal,
  Controlled,
  LowerOwners,
  PendingGesture,
  actions,
  escape,
  kinds,
  overlay,
} from "./modalOwners.fixtures";

afterEach(cleanup);

describe.each(kinds)("%s foreground modal ownership", (kind) => {
  it.each([false, true])(
    "loading=%s consumes one Escape without invoking lower owners",
    (loading) => {
      const calls = actions();
      const tool = vi.fn();
      const selection = vi.fn();
      render(
        <Controlled
          kind={kind}
          calls={calls}
          loading={loading}
          tool={tool}
          selection={selection}
        />,
      );
      const root = overlay();
      expect(root.isConnected).toBe(true);

      const event = escape(document.body);

      expect(event.defaultPrevented).toBe(true);
      expect(calls.close).toHaveBeenCalledTimes(loading ? 0 : 1);
      expect(root.isConnected).toBe(loading);
      expect(tool).not.toHaveBeenCalled();
      expect(selection).not.toHaveBeenCalled();
      for (const call of [
        calls.set,
        calls.roll,
        calls.create,
        calls.elevate,
        calls.bootstrap,
        calls.revoke,
      ])
        expect(call).not.toHaveBeenCalled();
    },
  );

  it.each(["modal-first", "gesture-first"])(
    "opening cancels live work in %s layout-effect order",
    (order) => {
      const calls = actions();
      const pending = { current: true };
      const cancelled = vi.fn();
      const modal = <ActualModal key="modal" kind={kind} calls={calls} loading />;
      const gesture = <PendingGesture key="gesture" pending={pending} cancelled={cancelled} />;
      render(<>{order === "modal-first" ? [modal, gesture] : [gesture, modal]}</>);

      expect(overlay().isConnected).toBe(true);
      expect(pending.current).toBe(false);
      expect(cancelled).toHaveBeenCalledExactlyOnceWith("foreground-modal");
      expect(calls.close).not.toHaveBeenCalled();
      expect(escape(document.body).defaultPrevented).toBe(true);
      expect(cancelled).toHaveBeenCalledTimes(1);
      expect(calls.close).not.toHaveBeenCalled();
    },
  );

  it("opening sees ref-only work armed just before the modal commit", () => {
    const calls = actions();
    const pending = { current: false };
    const cancelled = vi.fn();
    function Opening() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <PendingGesture pending={pending} cancelled={cancelled} />
          <button
            onClick={() => {
              pending.current = true;
              setOpen(true);
            }}
          >
            Arm then open
          </button>
          <ActualModal kind={kind} calls={calls} open={open} />
        </>
      );
    }
    render(<Opening />);
    expect(cancelled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Arm then open" }));
    expect(cancelled).toHaveBeenCalledExactlyOnceWith("foreground-modal");
    expect(pending.current).toBe(false);
    expect(calls.close).not.toHaveBeenCalled();
  });

  it("a closed or unmounted modal cannot consume the next Escape", () => {
    const calls = actions();
    const tool = vi.fn();
    const selection = vi.fn();
    const view = render(
      <>
        <LowerOwners tool={tool} selection={selection} />
        <ActualModal kind={kind} calls={calls} />
      </>,
    );
    const oldRoot = overlay();
    view.rerender(
      <>
        <LowerOwners tool={tool} selection={selection} />
        <ActualModal kind={kind} calls={calls} open={false} />
      </>,
    );
    expect(oldRoot.isConnected).toBe(false);
    const event = escape(document.body);
    expect(event.defaultPrevented).toBe(true);
    expect(calls.close).not.toHaveBeenCalled();
    expect(tool).toHaveBeenCalledTimes(1);
    expect(selection).not.toHaveBeenCalled();
  });
});

it("Initiative's actual 10000 overlay wins over a later mounted DM 3000 overlay", () => {
  const initiative = actions();
  const dm = actions();
  render(
    <>
      <ActualModal kind="initiative" calls={initiative} />
      <ActualModal kind="dm" calls={dm} />
    </>,
  );
  escape(screen.getByLabelText("Enter DM Password:"));
  expect(initiative.close).toHaveBeenCalledTimes(1);
  expect(dm.close).not.toHaveBeenCalled();
});
