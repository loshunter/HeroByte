import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiceRoller } from "../../../components/dice/DiceRoller";
import { ResultPanel } from "../../../components/dice/ResultPanel";
import { DicePanels } from "../../../layouts/DicePanels";
import { escapeRegistry } from "../useEscapeOwner";
import { dismissalFocus } from "../dismissalFocus";
import { frameQueue } from "./focusFixtures";
import { viewport } from "./frameInteraction.fixtures";
import { dicePanelProps, roll } from "./desktopFrames.fixtures";

let previousViewport: [number, number];
beforeEach(() => {
  previousViewport = [innerWidth, innerHeight];
  viewport(1440, 900);
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", undefined);
  frameQueue();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  viewport(...previousViewport);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("explicit Dice/Result containment and blocking", () => {
  it("nested Result stays below the later Chat root, while standalone Result blocks Chat", () => {
    const props = { ...dicePanelProps(), diceRollerOpen: true };
    const view = render(<DicePanels {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add d20" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll dice" }));
    expect(props.handleRoll).toHaveBeenCalledTimes(1);
    view.rerender(<DicePanels {...props} latestOwnRoll={roll()} />);
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole("button", { name: "Close ⚂ ROLL RESULT ⚂" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(props.toggleRollLog).toHaveBeenCalledExactlyOnceWith(false);
    vi.mocked(props.toggleRollLog).mockClear();
    view.rerender(
      <DicePanels {...props} latestOwnRoll={roll()} viewingRoll={roll("standalone")} />,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(props.toggleRollLog).not.toHaveBeenCalled();
    expect(props.handleViewRoll).not.toHaveBeenCalled();
  });

  it("nested Result shares Dice root 1000 with local 1001; standalone owns root 1001", () => {
    const register = vi.spyOn(escapeRegistry, "register");
    const onRoll = vi.fn();
    const view = render(
      <>
        <DiceRoller onRoll={onRoll} onClose={vi.fn()} />
        <ResultPanel result={roll("other")} onClose={vi.fn()} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add d20" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll dice" }));
    expect(onRoll).toHaveBeenCalledTimes(1);
    view.rerender(
      <>
        <DiceRoller onRoll={onRoll} latestOwnRoll={roll()} onClose={vi.fn()} />
        <ResultPanel result={roll("other")} onClose={vi.fn()} />
      </>,
    );
    act(() => vi.advanceTimersByTime(600));
    const layers = register.mock.calls
      .map(([read]) => read())
      .filter((owner) => owner.kind === "panel" && owner.name === "blocking-frame");
    const nested = layers.find((owner) => "localBand" in owner && owner.localBand === 1001);
    const dice = layers.find(
      (owner) => "root" in owner && owner.root.band() === 1000 && owner.localBand === 0,
    );
    const standalone = layers.find((owner) => "root" in owner && owner.root.band() === 1001);
    if (
      !nested ||
      !dice ||
      !standalone ||
      !("root" in nested) ||
      !("root" in dice) ||
      !("root" in standalone)
    )
      throw new Error("Missing real Dice/Result blocking owners");
    expect(nested.root).toBe(dice.root);
    expect(standalone.root).not.toBe(dice.root);
    expect(nested.handle).toBeUndefined();
    expect(standalone.handle).toBeUndefined();
  });

  it("retained Dice input cannot Escape through a later nested Result; Result editor can", () => {
    const enter = vi.fn();
    const override = vi.fn();
    const onRoll = vi.fn();
    const view = render(
      <DiceRoller
        onRoll={onRoll}
        onClose={vi.fn()}
        onEnterRoll={enter}
        onOverrideRoll={override}
      />,
    );
    fireEvent.click(screen.getByTestId("roller-hand-entry-open"));
    const lowerInput = screen.getByTestId("roller-hand-entry-input");
    fireEvent.change(lowerInput, { target: { value: "17" } });
    fireEvent.click(screen.getByRole("button", { name: "Add d20" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll dice" }));
    expect(onRoll).toHaveBeenCalledTimes(1);
    view.rerender(
      <DiceRoller
        onRoll={onRoll}
        onClose={vi.fn()}
        onEnterRoll={enter}
        onOverrideRoll={override}
        latestOwnRoll={roll()}
      />,
    );
    act(() => vi.advanceTimersByTime(600));
    fireEvent.keyDown(lowerInput, { key: "Escape" });
    expect(screen.getByTestId("roller-hand-entry-input")).toHaveValue(17);
    expect(screen.getByRole("button", { name: "Close ⚂ ROLL RESULT ⚂" })).toBeInTheDocument();
    expect(enter).not.toHaveBeenCalled();
    // Result's own HandEntry remains eligible within the winning layer.
    fireEvent.click(screen.getByTestId("result-hand-entry-open"));
    fireEvent.keyDown(screen.getByTestId("result-hand-entry-input"), { key: "Escape" });
    expect(screen.queryByTestId("result-hand-entry-input")).not.toBeInTheDocument();
    expect(override).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close ⚂ ROLL RESULT ⚂" })).toBeInTheDocument();
  });

  it("opening a blocking Dice window does not acquire modal cancellation or a focus ticket", () => {
    let pending = true;
    const cancel = vi.fn(() => {
      pending = false;
    });
    const release = escapeRegistry.register(() => ({
      kind: "gesture",
      name: "pending-map",
      active: pending,
      order: 20,
      handle: cancel,
    }));
    const close = vi.fn();
    const request = vi.spyOn(dismissalFocus, "request");
    try {
      render(<DiceRoller onClose={close} />);
      expect(cancel).not.toHaveBeenCalled();
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(cancel).toHaveBeenCalledTimes(1); // Pending gesture precedes content panels.
      expect(close).not.toHaveBeenCalled();
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(cancel).toHaveBeenCalledTimes(1); // Idle passive panel consumes without closing.
      expect(close).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Close ⚂ DICE ROLLER" }));
      expect(close).toHaveBeenCalledTimes(1);
      expect(request).not.toHaveBeenCalled();
    } finally {
      act(() => release());
    }
  });
});
