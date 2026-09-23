// U2 baseline at 44c6ab82. Replace temporary bug pins during ownership repair.
// Baseline bug assertions must be replaced, not kept as final U2 requirements.
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useToolMode } from "../../useToolMode";
import { useKeyboardNavigation } from "../../useKeyboardNavigation";
import { HelpMenuButton } from "../../../features/help/HelpMenuButton";

afterEach(cleanup);

const noMessage = vi.fn();
const noDrawingSelection = vi.fn();

// This composes production owners. It does not copy either Escape handler.
function useOwners() {
  const tool = useToolMode();
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>("token:owned");
  useKeyboardNavigation({
    selectedDrawingId: null,
    selectMode: tool.selectMode,
    sendMessage: noMessage,
    handleSelectDrawing: noDrawingSelection,
    selectedObjectId,
    onSelectObject: setSelectedObjectId,
  });
  return { tool, selectedObjectId };
}

function escapeFrom(target: EventTarget) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function HelpOwners() {
  const { tool, selectedObjectId } = useOwners();
  return (
    <div>
      <button onClick={() => tool.setActiveTool("draw")}>Arm drawing</button>
      <output data-testid="mode">{tool.activeTool ?? "move"}</output>
      <output data-testid="selection">{selectedObjectId ?? "none"}</output>
      <HelpMenuButton />
    </div>
  );
}

describe("production Escape owners before U2 extraction", () => {
  it("BASELINE BUG: one Escape exits a tool and clears selection", () => {
    const { result } = renderHook(useOwners);
    act(() => result.current.tool.setActiveTool("draw"));
    expect(result.current.tool.activeTool).toBe("draw");
    expect(result.current.selectedObjectId).toBe("token:owned");

    const event = escapeFrom(document.body);

    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selectedObjectId).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it("BASELINE BUG: an input preserves the tool but still loses selection", () => {
    const { result } = renderHook(useOwners);
    act(() => result.current.tool.setActiveTool("draw"));
    const field = document.createElement("input");
    document.body.appendChild(field);
    try {
      field.focus();
      escapeFrom(field);
      expect(result.current.tool.activeTool).toBe("draw");
      expect(result.current.selectedObjectId).toBeNull();
      expect(document.activeElement).toBe(field);
    } finally {
      field.remove();
    }
  });

  it("BASELINE BUG: real Help closes and the same event also exits tool and selection", () => {
    render(<HelpOwners />);
    fireEvent.click(screen.getByRole("button", { name: "Arm drawing" }));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    const help = screen.getByRole("dialog", { name: "HeroByte help" });
    expect(screen.getByTestId("mode")).toHaveTextContent("draw");
    expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");

    // A portalled descendant bubbles through document and then window.
    const event = escapeFrom(help.querySelector("button") ?? help);

    expect(screen.queryByRole("dialog", { name: "HeroByte help" })).not.toBeInTheDocument();
    expect(screen.getByTestId("mode")).toHaveTextContent("move");
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
    expect(event.defaultPrevented).toBe(false);
  });
});
