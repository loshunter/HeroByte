import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileResultOverlay } from "../MobileResultOverlay";
import { EscapeRootProvider, escapeRegistry } from "../../../features/interaction/useEscapeOwner";
import { dismissalFocus } from "../../../features/interaction/dismissalFocus";
import {
  MobileDiceComposition,
  readLayers,
  requestAndAnswer,
  rollerProps,
  serverRoll,
} from "./mobileDiceFrames.fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("real mobile Dice and Result paint roots", () => {
  it("shares nested Result with connected Dice root 2000/local 2100; standalone owns 2100", () => {
    const register = vi.spyOn(escapeRegistry, "register");
    const props = rollerProps();
    const ui = (answer = null as ReturnType<typeof serverRoll> | null) => (
      <MobileDiceComposition {...props} latestOwnRoll={answer}>
        <MobileResultOverlay result={serverRoll("standalone")} onClose={vi.fn()} />
      </MobileDiceComposition>
    );
    const view = render(ui());
    requestAndAnswer(view, ui(serverRoll()));
    expect(props.onRoll).toHaveBeenCalledExactlyOnceWith({
      formula: "d20",
      mode: "normal",
      visibility: "public",
    });
    const diceNode = screen.getByTestId("dice-roller");
    const nestedNode = within(diceNode).getByTestId("mobile-roll-result");
    const standaloneNode = screen
      .getAllByTestId("mobile-roll-result")
      .find((node) => node !== nestedNode);
    const layers = readLayers(register);
    const dice = layers.find((owner) => owner.anchor === diceNode);
    const nested = layers.find((owner) => owner.anchor === nestedNode);
    const standalone = layers.find((owner) => owner.anchor === standaloneNode);
    if (!dice || !nested || !standalone) throw new Error("Missing actual mobile blocking owners");
    expect(dice.root.node()).toBe(diceNode);
    expect(dice.root.band()).toBe(2000);
    expect(dice.localBand).toBe(0);
    expect(nested.root).toBe(dice.root);
    expect(nested.localBand).toBe(2100);
    expect(standalone.root).not.toBe(dice.root);
    expect(standalone.root.node()).toBe(standaloneNode);
    expect(standalone.root.band()).toBe(2100);
    expect(standalone.localBand).toBe(0);
    expect(layers.every((owner) => owner.handle === undefined)).toBe(true);
  });

  it("blocks a retained Dice editor beneath its Result while allowing Result's own Escape", () => {
    const props = rollerProps();
    const view = render(<MobileDiceComposition {...props} />);
    fireEvent.click(screen.getByTestId("mobile-roller-hand-entry-open"));
    const lowerInput = screen.getByTestId("mobile-roller-hand-entry-input");
    fireEvent.change(lowerInput, { target: { value: "18" } });
    requestAndAnswer(view, <MobileDiceComposition {...props} latestOwnRoll={serverRoll()} />);
    expect(props.onRoll).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(lowerInput, { key: "Escape" });
    expect(screen.getByTestId("mobile-roller-hand-entry-input")).toHaveValue(18);
    expect(screen.getByTestId("mobile-roll-result")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("result-hand-entry-open"));
    fireEvent.change(screen.getByTestId("result-hand-entry-input"), { target: { value: "19" } });
    fireEvent.keyDown(screen.getByTestId("result-hand-entry-input"), { key: "Escape" });
    expect(screen.queryByTestId("result-hand-entry-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-roll-result")).toBeInTheDocument();
    expect(props.onEnterRoll).not.toHaveBeenCalled();
    expect(props.onOverrideRoll).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("does not promote nested 2100 above a sibling 2050 root; standalone 2100 does block it", () => {
    const props = rollerProps();
    const enter = vi.fn();
    const ui = (answer = null as ReturnType<typeof serverRoll> | null, standalone = false) => (
      <MobileDiceComposition {...props} latestOwnRoll={answer}>
        <div data-testid="middle">
          <MobileResultOverlay
            result={serverRoll("middle")}
            zIndex={2050}
            onClose={vi.fn()}
            onEnterRoll={enter}
          />
        </div>
        {standalone && <MobileResultOverlay result={serverRoll("top")} onClose={vi.fn()} />}
      </MobileDiceComposition>
    );
    const view = render(ui());
    requestAndAnswer(view, ui(serverRoll()));
    expect(
      within(screen.getByTestId("dice-roller")).getByTestId("mobile-roll-result"),
    ).toBeInTheDocument();
    const middle = within(screen.getByTestId("middle"));
    fireEvent.click(middle.getByTestId("result-hand-entry-open"));
    fireEvent.keyDown(middle.getByTestId("result-hand-entry-input"), { key: "Escape" });
    expect(middle.queryByTestId("result-hand-entry-input")).not.toBeInTheDocument();
    fireEvent.click(middle.getByTestId("result-hand-entry-open"));
    const input = middle.getByTestId("result-hand-entry-input");
    fireEvent.change(input, { target: { value: "21" } });
    view.rerender(ui(serverRoll(), true));
    fireEvent.keyDown(input, { key: "Escape" });
    expect(middle.getByTestId("result-hand-entry-input")).toHaveValue(21);
    expect(enter).not.toHaveBeenCalled();
  });

  it("does not infer a standalone Result's paint root from an unrelated React provider", () => {
    const parentNode = document.createElement("div");
    document.body.append(parentNode);
    const unrelatedRoot = { node: () => parentNode, band: () => 7000 };
    const register = vi.spyOn(escapeRegistry, "register");
    try {
      render(
        <EscapeRootProvider value={unrelatedRoot}>
          <MobileResultOverlay result={serverRoll()} onClose={vi.fn()} />
        </EscapeRootProvider>,
      );
      const resultNode = screen.getByTestId("mobile-roll-result");
      const owner = readLayers(register).find((entry) => entry.anchor === resultNode);
      expect(owner?.root).not.toBe(unrelatedRoot);
      expect(owner?.root.node()).toBe(resultNode);
      expect(owner?.root.band()).toBe(2100);
    } finally {
      parentNode.remove();
    }
  });

  it("registers no null-result frame and removes the real owner when the result clears", () => {
    const fallback = vi.fn();
    const release = escapeRegistry.register(() => ({
      kind: "tool",
      name: "tool",
      active: true,
      order: 0,
      handle: fallback,
    }));
    try {
      const close = vi.fn();
      const view = render(<MobileResultOverlay result={null} onClose={close} />);
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(fallback).toHaveBeenCalledTimes(1);
      view.rerender(<MobileResultOverlay result={serverRoll()} onClose={close} />);
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      view.rerender(<MobileResultOverlay result={null} onClose={close} />);
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(fallback).toHaveBeenCalledTimes(2);
    } finally {
      act(() => release());
    }
  });
});
