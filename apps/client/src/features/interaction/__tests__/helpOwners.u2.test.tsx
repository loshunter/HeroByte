import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HelpMenuButton } from "../../help/HelpMenuButton";
import { useToolMode } from "../../../hooks/useToolMode";
import { CharacterWindow, escape } from "./popoverOwners.fixtures";

afterEach(cleanup);
function HelpWithTool() {
  const tool = useToolMode();
  return (
    <>
      <button onClick={() => tool.setActiveTool("draw")}>Arm drawing</button>
      <output data-testid="tool-mode">{tool.activeTool ?? "move"}</output>
      <HelpMenuButton />
    </>
  );
}
function openHelp() {
  fireEvent.click(screen.getByRole("button", { name: "Help" }));
  return screen.getByRole("dialog", { name: "HeroByte help" });
}

describe("Help's existing close joins the foreground ownership ladder", () => {
  it("a body-portalled Help consumes one Escape and preserves the actual draw tool", () => {
    const { container } = render(
      <div style={{ position: "fixed", zIndex: 100 }}>
        <HelpWithTool />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Arm drawing" }));
    const help = openHelp();
    expect(container.contains(help)).toBe(false);
    expect(help.parentElement).toBe(document.body);
    expect(help.style.zIndex).toBe("2000");
    expect(escape(help.querySelector("button") ?? help).defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog", { name: "HeroByte help" })).toBeNull();
    expect(screen.getByTestId("tool-mode")).toHaveTextContent("draw");
    escape(document.body);
    expect(screen.getByTestId("tool-mode")).toHaveTextContent("move");
  });

  it("actual Character settings at 2500 blocks Help at 2000 even from a Help descendant", () => {
    const close = vi.fn();
    const view = render(
      <>
        <HelpMenuButton />
      </>,
    );
    const help = openHelp();
    view.rerender(
      <>
        <HelpMenuButton />
        <CharacterWindow close={close} />
      </>,
    );
    expect(escape(help.querySelector("button") ?? help).defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "HeroByte help" })).toBe(help);
  });

  it.each(["composing", "legacy composing", "prevented", "select"])(
    "%s Escape leaves Help open and the lower tool unchanged",
    (mode) => {
      render(<HelpWithTool />);
      fireEvent.click(screen.getByRole("button", { name: "Arm drawing" }));
      const help = openHelp();
      const target = mode === "select" ? document.createElement("select") : help;
      if (target !== help) help.appendChild(target);
      const event = escape(
        target,
        { isComposing: mode === "composing", keyCode: mode === "legacy composing" ? 229 : 0 },
        mode === "prevented" ? (key) => key.preventDefault() : undefined,
      );
      expect(event.defaultPrevented).toBe(mode === "prevented");
      expect(screen.getByRole("dialog", { name: "HeroByte help" })).toBe(help);
      expect(screen.getByTestId("tool-mode")).toHaveTextContent("draw");
    },
  );

  it("tracked composition blocks Escape even when the key has no composition flag", () => {
    render(<HelpMenuButton />);
    const help = openHelp();
    fireEvent.compositionStart(help);
    expect(escape(help).defaultPrevented).toBe(false);
    expect(help).toBeInTheDocument();
    fireEvent.compositionEnd(help);
    expect(escape(help).defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog", { name: "HeroByte help" })).toBeNull();
  });

  it("ordinary keys and inside mouse down preserve Help; outside mouse down still closes", () => {
    render(<HelpMenuButton />);
    const help = openHelp();
    fireEvent.keyDown(help, { key: "Enter" });
    fireEvent.mouseDown(help);
    expect(help).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "HeroByte help" })).toBeNull();
  });
});
