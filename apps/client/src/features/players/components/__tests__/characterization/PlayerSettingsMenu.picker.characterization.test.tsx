// DRAFT, NOT RUN. Destination:
// features/players/components/__tests__/characterization/
// PlayerSettingsMenu.picker.characterization.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlayerSettingsMenu } from "../../PlayerSettingsMenu";

afterEach(cleanup);

function props() {
  return {
    isOpen: true,
    onClose: vi.fn(),
    selectedEffects: ["prone"],
    onStatusEffectsChange: vi.fn(),
    onToggleDMMode: vi.fn(),
  };
}

const toggle = () => fireEvent.click(screen.getByRole("button", { name: /effect/i }));
const checkbox = (name: string) => screen.getByRole("checkbox", { name: new RegExp(name, "i") });

describe("real Character settings picker lifetime before extraction", () => {
  it("toggles a label once and preserves another selected condition", () => {
    const options = props();
    render(<PlayerSettingsMenu {...options} />);
    toggle();
    fireEvent.click(screen.getByText("🤢 Poisoned"));
    expect(options.onStatusEffectsChange).toHaveBeenCalledExactlyOnceWith(["prone", "poisoned"]);
    expect(checkbox("prone")).toBeChecked();
    expect(checkbox("poisoned")).toBeChecked();
  });

  it("freezes open local edits, then synchronizes the newest snapshot on outside close", () => {
    const options = props();
    const { rerender } = render(<PlayerSettingsMenu {...options} />);
    toggle();
    rerender(<PlayerSettingsMenu {...options} selectedEffects={["stunned"]} />);
    expect(checkbox("prone")).toBeChecked();
    expect(checkbox("stunned")).not.toBeChecked();
    fireEvent.click(checkbox("poisoned"));
    expect(options.onStatusEffectsChange).toHaveBeenCalledExactlyOnceWith(["prone", "poisoned"]);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("checkbox", { name: /prone/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 Active Effect" })).toBeInTheDocument();
    toggle();
    expect(checkbox("stunned")).toBeChecked();
    expect(checkbox("prone")).not.toBeChecked();
    expect(checkbox("poisoned")).not.toBeChecked();
  });

  it("keeps open picker state while the mounted Character parent returns null", () => {
    const options = props();
    const { rerender } = render(<PlayerSettingsMenu {...options} />);
    toggle();
    rerender(<PlayerSettingsMenu {...options} isOpen={false} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    rerender(<PlayerSettingsMenu {...options} isOpen={false} selectedEffects={["stunned"]} />);
    rerender(<PlayerSettingsMenu {...options} selectedEffects={["stunned"]} />);
    // Existing lifetime, not a proposed new UX: dropdownOpen and its draft
    // live in the always-mounted parent, so conditional child state would differ.
    expect(checkbox("prone")).toBeChecked();
    expect(checkbox("stunned")).not.toBeChecked();
    fireEvent.mouseDown(document.body);
    toggle();
    expect(checkbox("stunned")).toBeChecked();
    expect(options.onStatusEffectsChange).not.toHaveBeenCalled();
  });

  it("synchronizes snapshot changes while the picker is closed", () => {
    const options = props();
    const { rerender } = render(<PlayerSettingsMenu {...options} />);
    rerender(<PlayerSettingsMenu {...options} selectedEffects={["stunned", "poisoned"]} />);
    expect(screen.getByRole("button", { name: "2 Active Effects" })).toBeInTheDocument();
    toggle();
    expect(checkbox("prone")).not.toBeChecked();
    expect(checkbox("stunned")).toBeChecked();
    expect(checkbox("poisoned")).toBeChecked();
    expect(options.onStatusEffectsChange).not.toHaveBeenCalled();
  });
});
