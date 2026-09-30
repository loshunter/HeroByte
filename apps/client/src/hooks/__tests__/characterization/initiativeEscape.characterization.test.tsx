// U2 baseline at 44c6ab82, before changing modal Escape ownership.
// Not run. Replace BASELINE BUG expectations in the U2 ownership repair.
import React, { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { useToolMode } from "../../useToolMode";
import { useKeyboardNavigation } from "../../useKeyboardNavigation";
import { InitiativeModal } from "../../../features/initiative/components/InitiativeModal";

afterEach(cleanup);

const character: SnapshotCharacter = {
  id: "character:escape",
  type: "pc",
  name: "Escape fixture",
  hp: 10,
  maxHp: 10,
  initiativeModifier: 2,
};
const noMessage = vi.fn();
const noDrawingSelection = vi.fn();

interface OwnersProps {
  loading: boolean;
  onClose: () => void;
  onSetInitiative: (value: number, modifier: number) => void;
  onRollInitiative: (modifier: number) => void;
}

// Production hooks + real portalled modal; no keyboard handler is copied.
// The production JRPGPanel/Button remain real as well.
function InitiativeOwners({ loading, onClose, onSetInitiative, onRollInitiative }: OwnersProps) {
  const tool = useToolMode();
  const [selectedObjectId, selectObject] = useState<string | null>("token:owned");
  const [open, setOpen] = useState(false);
  useKeyboardNavigation({
    selectedDrawingId: null,
    selectMode: tool.selectMode,
    sendMessage: noMessage,
    handleSelectDrawing: noDrawingSelection,
    selectedObjectId,
    onSelectObject: selectObject,
  });
  const close = useCallback(() => {
    onClose();
    setOpen(false);
  }, [onClose]);

  return (
    <div>
      <button onClick={() => tool.setActiveTool("draw")}>Arm drawing</button>
      <button onClick={() => setOpen(true)}>Open initiative</button>
      <output data-testid="mode">{tool.activeTool ?? "move"}</output>
      <output data-testid="selection">{selectedObjectId ?? "none"}</output>
      {open && (
        <InitiativeModal
          character={character}
          onClose={close}
          onSetInitiative={onSetInitiative}
          onRollInitiative={onRollInitiative}
          isLoading={loading}
        />
      )}
    </div>
  );
}

function renderOwners(loading: boolean) {
  const props = {
    loading,
    onClose: vi.fn(),
    onSetInitiative: vi.fn(),
    onRollInitiative: vi.fn(),
  };
  const view = render(<InitiativeOwners {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Arm drawing" }));
  fireEvent.click(screen.getByRole("button", { name: "Open initiative" }));
  expect(screen.getByText("Initiative: Escape fixture")).toBeInTheDocument();
  expect(screen.getByTestId("mode")).toHaveTextContent("draw");
  expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");
  if (loading) {
    // "Loading" is the dialog's OWN save in flight (dialogGuards.useOwnSave):
    // make it — hand entry 11, Save — and clear the spy for the case below.
    fireEvent.click(screen.getByRole("button", { name: /Physical Dice|by hand/i }));
    fireEvent.change(screen.getByPlaceholderText("Enter roll..."), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    props.onSetInitiative.mockClear();
  }
  return { ...view, props };
}

function escapeFrom(target: HTMLElement) {
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

describe("Initiative and underlying production Escape ownership", () => {
  it.each([false, true])(
    "loading=%s, button Escape leaves underlying tool and selection alone",
    (loading) => {
      const { props } = renderOwners(loading);
      // Roll is enabled in both states. Do not try to focus the disabled
      // loading Cancel button and accidentally dispatch from document.body.
      const button = screen.getByRole("button", { name: "Roll Initiative" });
      button.focus();
      expect(document.activeElement).toBe(button);

      const event = escapeFrom(button);

      if (loading) {
        expect(screen.getByText("Initiative: Escape fixture")).toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      } else {
        expect(screen.queryByText("Initiative: Escape fixture")).not.toBeInTheDocument();
        expect(props.onClose).toHaveBeenCalledTimes(1);
      }
      expect(screen.getByTestId("mode")).toHaveTextContent("draw");
      expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");
      expect(event.defaultPrevented).toBe(true);
      expect(props.onSetInitiative).not.toHaveBeenCalled();
      expect(props.onRollInitiative).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "loading=%s, manual-input Escape leaves underlying selection alone",
    (loading) => {
      const { props } = renderOwners(loading);
      // A loading dialog's hand entry is already open (its own save); focus it.
      if (loading) screen.getByPlaceholderText("Enter roll...").focus();
      else fireEvent.click(screen.getByRole("button", { name: /Physical Dice|by hand/i }));
      const input = screen.getByPlaceholderText("Enter roll...");
      expect(document.activeElement).toBe(input);
      fireEvent.change(input, { target: { value: "14" } });

      const event = escapeFrom(input);

      if (loading) {
        expect(screen.getByText("Initiative: Escape fixture")).toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(input).toHaveValue(14);
        expect(document.activeElement).toBe(input);
      } else {
        expect(screen.queryByText("Initiative: Escape fixture")).not.toBeInTheDocument();
        expect(props.onClose).toHaveBeenCalledTimes(1);
      }
      // The foreground modal owns this Escape even when its input is focused.
      expect(screen.getByTestId("mode")).toHaveTextContent("draw");
      expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");
      expect(event.defaultPrevented).toBe(true);
      expect(props.onSetInitiative).not.toHaveBeenCalled();
      expect(props.onRollInitiative).not.toHaveBeenCalled();
    },
  );

  it("successful loading completion auto-closes without touching tool or selection", () => {
    const { rerender, props } = renderOwners(true);
    expect(props.onClose).not.toHaveBeenCalled();
    rerender(<InitiativeOwners {...props} loading={false} />);

    expect(screen.queryByText("Initiative: Escape fixture")).not.toBeInTheDocument();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mode")).toHaveTextContent("draw");
    expect(screen.getByTestId("selection")).toHaveTextContent("token:owned");
    expect(props.onSetInitiative).not.toHaveBeenCalled();
    expect(props.onRollInitiative).not.toHaveBeenCalled();
  });
});
