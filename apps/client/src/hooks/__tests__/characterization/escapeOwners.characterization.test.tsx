import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useToolMode } from "../../useToolMode";
import { useKeyboardNavigation } from "../../useKeyboardNavigation";
import { HelpMenuButton } from "../../../features/help/HelpMenuButton";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

describe("production Escape owners use one ladder step per event", () => {
  it("exits the active tool before a later Escape clears selection", () => {
    const { result } = renderHook(useOwners);
    act(() => result.current.tool.setActiveTool("draw"));
    expect(result.current.tool.activeTool).toBe("draw");
    expect(result.current.selectedObjectId).toBe("token:owned");

    const toolEvent = escapeFrom(document.body);
    expect(toolEvent.defaultPrevented).toBe(true);
    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selectedObjectId).toBe("token:owned");

    const selectionEvent = escapeFrom(document.body);
    expect(selectionEvent.defaultPrevented).toBe(true);
    expect(result.current.tool.activeTool).toBeNull();
    expect(result.current.selectedObjectId).toBeNull();
    expect(escapeFrom(document.body).defaultPrevented).toBe(false);
    expect(noMessage).not.toHaveBeenCalled();
    expect(noDrawingSelection).not.toHaveBeenCalled();
  });

  it("leaves native input focus, text, tool and selection intact", () => {
    const { result } = renderHook(useOwners);
    act(() => result.current.tool.setActiveTool("draw"));
    const field = document.createElement("input");
    field.value = "unfinished draft";
    document.body.appendChild(field);
    try {
      field.focus();
      const event = escapeFrom(field);
      expect(event.defaultPrevented).toBe(false);
      expect(result.current.tool.activeTool).toBe("draw");
      expect(result.current.selectedObjectId).toBe("token:owned");
      expect(document.activeElement).toBe(field);
      expect(field.value).toBe("unfinished draft");

      // The actual fallback owners remain usable after the typing surface yields.
      field.blur();
      expect(escapeFrom(document.body).defaultPrevented).toBe(true);
      expect(result.current.tool.activeTool).toBeNull();
      expect(result.current.selectedObjectId).toBe("token:owned");
      expect(escapeFrom(document.body).defaultPrevented).toBe(true);
      expect(result.current.selectedObjectId).toBeNull();
      expect(noMessage).not.toHaveBeenCalled();
      expect(noDrawingSelection).not.toHaveBeenCalled();
    } finally {
      field.remove();
    }
  });

  it("closes real portalled Help before later tool and selection steps", () => {
    render(<HelpOwners />);
    fireEvent.click(screen.getByRole("button", { name: "Arm drawing" }));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    const help = screen.getByRole("dialog", { name: "HeroByte help" });
    expect(screen.getByTestId("mode")).toHaveTextContent("draw");
    expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");
    // Keep the original native event path through a real portalled descendant.
    const event = escapeFrom(help.querySelector("button") ?? help);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog", { name: "HeroByte help" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("mode")).toHaveTextContent("draw");
    expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");

    expect(escapeFrom(document.body).defaultPrevented).toBe(true);
    expect(screen.getByTestId("mode")).toHaveTextContent("move");
    expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");
    expect(escapeFrom(document.body).defaultPrevented).toBe(true);
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
    expect(escapeFrom(document.body).defaultPrevented).toBe(false);
    expect(noMessage).not.toHaveBeenCalled();
    expect(noDrawingSelection).not.toHaveBeenCalled();
  });
});
