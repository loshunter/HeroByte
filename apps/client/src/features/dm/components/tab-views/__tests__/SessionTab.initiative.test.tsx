/**
 * SessionTab — the initiative manual-override toggle
 *
 * The sibling player-props toggle defaults OFF; this one defaults ON, and the
 * asymmetry is exactly where it would go wrong. A box that renders unchecked on
 * a table which never touched the setting invites the DM to "fix" it by writing
 * an explicit value that was already the default.
 *
 * The neighbouring characterization file tests an inline STUB of this component
 * from before it was extracted, so it cannot see any of this.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionTab from "../SessionTab";

function renderTab(overrides: Record<string, unknown> = {}) {
  const onInitiativeManualOverrideChange = vi.fn();
  render(
    <SessionTab
      sessionName="Test"
      setSessionName={vi.fn()}
      saveDisabled={false}
      loadDisabled={false}
      playerCount={2}
      onInitiativeManualOverrideChange={onInitiativeManualOverrideChange}
      {...overrides}
    />,
  );
  return { onInitiativeManualOverrideChange };
}

describe("SessionTab - initiative manual override", () => {
  const toggle = () => screen.getByTestId("initiative-manual-override-toggle") as HTMLInputElement;

  it("renders CHECKED when the prop is omitted, because the setting defaults ON", () => {
    renderTab();

    expect(toggle().checked).toBe(true);
  });

  it("renders checked when explicitly on", () => {
    renderTab({ initiativeManualOverride: true });

    expect(toggle().checked).toBe(true);
  });

  it("renders unchecked only when explicitly off", () => {
    renderTab({ initiativeManualOverride: false });

    expect(toggle().checked).toBe(false);
  });

  it("reports the new value when the DM turns it off", () => {
    const { onInitiativeManualOverrideChange } = renderTab({ initiativeManualOverride: true });

    fireEvent.click(toggle());

    expect(onInitiativeManualOverrideChange).toHaveBeenCalledWith(false);
  });

  it("reports the new value when the DM turns it back on", () => {
    const { onInitiativeManualOverrideChange } = renderTab({ initiativeManualOverride: false });

    fireEvent.click(toggle());

    expect(onInitiativeManualOverrideChange).toHaveBeenCalledWith(true);
  });

  it("says what turning it off actually does", () => {
    // The blurb is the only place a DM learns that hand-entered numbers still
    // reach the log, and reach it MARKED — without which the setting reads as
    // "let players cheat". Asserted on the substance rather than a phrase, so
    // rewording the copy cannot break it while dropping the promise can.
    renderTab();

    const blurb = screen.getByTestId("initiative-manual-override-toggle").closest("div");
    expect(blurb).toHaveTextContent(/roll log/i);
    expect(blurb).toHaveTextContent(/BY HAND/i);
  });

  it("no longer describes the setting as initiative-only", () => {
    // It governs every roll since the physical-dice slice. A DM reading
    // "initiative" here would not know they had just switched off the dice
    // roller's entry control too.
    renderTab();

    const blurb = screen.getByTestId("initiative-manual-override-toggle").closest("div");
    expect(blurb).not.toHaveTextContent(/enter initiative by hand/i);
  });

  it("renders no panel at all when the handler is absent", () => {
    // Matches the sibling toggle: a menu built without the callback should not
    // show a dead control.
    render(
      <SessionTab
        sessionName="Test"
        setSessionName={vi.fn()}
        saveDisabled={false}
        loadDisabled={false}
        playerCount={2}
      />,
    );

    expect(screen.queryByTestId("initiative-manual-override-toggle")).not.toBeInTheDocument();
  });
});
