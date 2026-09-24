import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActualModal, Controlled, actions, escape, kinds, overlay } from "./modalOwners.fixtures";

afterEach(cleanup);

describe.each(kinds)("%s native Escape first refusal", (kind) => {
  it.each(["select", "composing", "keycode229", "prevented"])(
    "keeps %s Escape out of the modal close path",
    (native) => {
      const calls = actions();
      const tool = vi.fn();
      const selection = vi.fn();
      render(
        <Controlled kind={kind} calls={calls} loading={false} tool={tool} selection={selection} />,
      );
      const root = overlay();
      let target = root;
      if (native === "select") {
        // A native child belongs to this real connected modal root. No new public prop.
        const select = document.createElement("select");
        select.append(new Option("Native choice", "choice"));
        root.append(select);
        select.focus();
        target = select;
      }
      const event = escape(target, { isComposing: native === "composing" }, (key) => {
        if (native === "keycode229") Object.defineProperty(key, "keyCode", { value: 229 });
        if (native === "prevented") key.preventDefault();
      });

      expect(event.defaultPrevented).toBe(native === "prevented");
      expect(root.isConnected).toBe(true);
      expect(calls.close).not.toHaveBeenCalled();
      expect(tool).not.toHaveBeenCalled();
      expect(selection).not.toHaveBeenCalled();
    },
  );

  it("honors tracked composition until compositionend, then closes on one Escape", () => {
    const calls = actions();
    render(<ActualModal kind={kind} calls={calls} />);
    const root = overlay();
    fireEvent.compositionStart(root);
    expect(escape(root).defaultPrevented).toBe(false);
    expect(calls.close).not.toHaveBeenCalled();
    fireEvent.compositionEnd(root);
    expect(escape(root).defaultPrevented).toBe(true);
    expect(calls.close).toHaveBeenCalledTimes(1);
  });
});

it("Character Creation input Escape closes once without falling through its former local handler", () => {
  const calls = actions();
  const tool = vi.fn();
  const selection = vi.fn();
  render(
    <Controlled kind="character" calls={calls} loading={false} tool={tool} selection={selection} />,
  );
  const input = screen.getByPlaceholderText("Enter character name...");
  fireEvent.change(input, { target: { value: "Unsaved hero" } });
  expect(escape(input).defaultPrevented).toBe(true);
  expect(calls.close).toHaveBeenCalledTimes(1);
  expect(calls.create).not.toHaveBeenCalled();
  expect(tool).not.toHaveBeenCalled();
  expect(selection).not.toHaveBeenCalled();
});

it("DM loading Escape preserves its entered password and does not submit", () => {
  const calls = actions();
  const view = render(<ActualModal kind="dm" calls={calls} />);
  fireEvent.change(screen.getByLabelText("Enter DM Password:"), {
    target: { value: "keeper-password" },
  });
  view.rerender(<ActualModal kind="dm" calls={calls} loading />);
  expect(escape(document.body).defaultPrevented).toBe(true);
  expect(screen.getByLabelText("Enter DM Password:")).toHaveValue("keeper-password");
  expect(calls.close).not.toHaveBeenCalled();
  expect(calls.elevate).not.toHaveBeenCalled();
});

it("DM Escape uses the existing cancel path, clearing the password before reopen", () => {
  const calls = actions();
  render(<Controlled kind="dm" calls={calls} loading={false} tool={vi.fn()} selection={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Enter DM Password:"), {
    target: { value: "keeper-password" },
  });
  expect(escape(screen.getByLabelText("Enter DM Password:")).defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reopen modal" }));
  expect(screen.getByLabelText("Enter DM Password:")).toHaveValue("");
  expect(calls.close).toHaveBeenCalledTimes(1);
  expect(calls.elevate).not.toHaveBeenCalled();
});
