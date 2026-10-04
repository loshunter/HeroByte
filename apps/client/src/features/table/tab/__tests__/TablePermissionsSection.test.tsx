/**
 * Table → Permissions (U9): what players may do at this table, stated as what
 * happens. It is the Session tab's two "table policy" panels, moved.
 *
 * The sibling player-props toggle defaults OFF; the hand-entered-rolls one
 * defaults ON, and the asymmetry is exactly where it would go wrong. A box that
 * renders unchecked on a table which never touched the setting invites the DM to
 * "fix" it by writing an explicit value that was already the default.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TablePermissionsSection from "../TablePermissionsSection";

function renderSection(overrides: Record<string, unknown> = {}) {
  const onInitiativeManualOverrideChange = vi.fn();
  const onPlayerPropsEnabledChange = vi.fn();
  render(
    <TablePermissionsSection
      onInitiativeManualOverrideChange={onInitiativeManualOverrideChange}
      onPlayerPropsEnabledChange={onPlayerPropsEnabledChange}
      {...overrides}
    />,
  );
  return { onInitiativeManualOverrideChange, onPlayerPropsEnabledChange };
}

describe("TablePermissionsSection - hand-entered rolls", () => {
  const toggle = () => screen.getByTestId("initiative-manual-override-toggle") as HTMLInputElement;
  const blurb = () => toggle().closest("div") as HTMLElement;

  it("renders CHECKED when the prop is omitted, because the setting defaults ON", () => {
    renderSection();

    expect(toggle().checked).toBe(true);
  });

  it("renders checked when explicitly on", () => {
    renderSection({ initiativeManualOverride: true });

    expect(toggle().checked).toBe(true);
  });

  it("renders unchecked only when explicitly off", () => {
    renderSection({ initiativeManualOverride: false });

    expect(toggle().checked).toBe(false);
  });

  it("reports the new value when the DM turns it off", () => {
    const { onInitiativeManualOverrideChange } = renderSection({ initiativeManualOverride: true });

    fireEvent.click(toggle());

    expect(onInitiativeManualOverrideChange).toHaveBeenCalledWith(false);
  });

  it("reports the new value when the DM turns it back on", () => {
    const { onInitiativeManualOverrideChange } = renderSection({ initiativeManualOverride: false });

    fireEvent.click(toggle());

    expect(onInitiativeManualOverrideChange).toHaveBeenCalledWith(true);
  });

  it("says who may enter a result when it is on, and that the DM always may", () => {
    renderSection({ initiativeManualOverride: true });

    expect(blurb()).toHaveTextContent(/Players can type what they rolled at a real table/i);
    expect(blurb()).toHaveTextContent(/You can always enter rolls by hand/i);
    expect(blurb()).not.toHaveTextContent(/server's die only/i);
  });

  it("says who may enter a result when it is off: players get the server's die, the DM still types", () => {
    renderSection({ initiativeManualOverride: false });

    expect(blurb()).toHaveTextContent(/Players get the server's die only/i);
    expect(blurb()).toHaveTextContent(/You can still enter rolls by hand/i);
    expect(blurb()).not.toHaveTextContent(/Players can type what they rolled/i);
  });

  it("says, either way, that a hand-entered number reaches the log marked", () => {
    // The blurb is the only place a DM learns that hand-entered numbers still reach
    // the log, and reach it MARKED — without which the setting reads as "let players
    // cheat". Asserted on the substance rather than a phrase.
    for (const value of [true, false]) {
      const { unmount } = render(
        <TablePermissionsSection
          initiativeManualOverride={value}
          onInitiativeManualOverrideChange={vi.fn()}
        />,
      );
      const text = screen.getByTestId("initiative-manual-override-toggle").closest("div");
      expect(text).toHaveTextContent(/roll log/i);
      expect(text).toHaveTextContent(/BY HAND/);
      unmount();
    }
  });

  it("no longer explains replacement styling or the server's roll internals", () => {
    // The audit (IA-19) found this panel explaining its badge colours and strikethroughs
    // at length. An outcome statement says who may do what; the rest is help.
    renderSection();
    expect(blurb()).not.toHaveTextContent(/struck through|in its own colour|disguised/i);
  });

  it("no longer describes the setting as initiative-only", () => {
    // It governs every roll since the physical-dice slice. A DM reading
    // "initiative" here alone would not know they had just switched off the dice
    // roller's entry control too.
    renderSection();

    expect(blurb()).not.toHaveTextContent(/enter initiative by hand/i);
    expect(blurb()).toHaveTextContent(/dice roller/i);
  });

  it("renders no panel at all when the handler is absent", () => {
    // Matches the sibling toggle: a menu built without the callback should not
    // show a dead control.
    render(<TablePermissionsSection />);

    expect(screen.queryByTestId("initiative-manual-override-toggle")).not.toBeInTheDocument();
  });
});

describe("TablePermissionsSection - player props", () => {
  const toggle = () => screen.getByLabelText("Players can add props") as HTMLInputElement;

  it("defaults OFF when the prop is omitted", () => {
    renderSection();
    expect(toggle().checked).toBe(false);
  });

  it("reports the new value when flipped", () => {
    const { onPlayerPropsEnabledChange } = renderSection();
    fireEvent.click(toggle());
    expect(onPlayerPropsEnabledChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("says players get their own props and never map tools", () => {
    renderSection();
    const note = toggle().closest("div") as HTMLElement;
    expect(note).toHaveTextContent(/their own props/i);
    expect(note).toHaveTextContent(/never get map tools/i);
  });

  it("renders no panel when the handler is absent", () => {
    render(<TablePermissionsSection />);
    expect(screen.queryByLabelText("Players can add props")).not.toBeInTheDocument();
  });
});
