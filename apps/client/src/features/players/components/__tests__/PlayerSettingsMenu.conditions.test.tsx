// Each condition row is a <label> wrapping a 16px checkbox and its text. The
// row ALSO carried its own onClick calling the same toggle, so a click on the
// text ran the handler once and the browser's own label activation ran it
// again — two toggles, net zero. The row looked like a big target and only a
// direct hit on the checkbox worked, which is worst on a finger (UX-03).
//
// The gesture under test is a click on the LABEL TEXT, which is what a user
// aims at. If the row's own handler ever comes back, the count goes to two and
// these fail.

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayerSettingsMenu } from "../PlayerSettingsMenu";

function openPicker(selectedEffects: string[] = []) {
  const onStatusEffectsChange = vi.fn();
  render(
    <PlayerSettingsMenu
      isOpen
      onClose={vi.fn()}
      tokenImageInput=""
      onTokenImageInputChange={vi.fn()}
      onTokenImageClear={vi.fn()}
      onTokenImageApply={vi.fn()}
      onSavePlayerState={vi.fn()}
      onLoadPlayerState={vi.fn()}
      selectedEffects={selectedEffects}
      onStatusEffectsChange={onStatusEffectsChange}
      isDM={false}
      onToggleDMMode={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /effect/i }));
  return { onStatusEffectsChange };
}

/** The visible text of a row, which is what a finger or cursor lands on. */
const labelText = (label: string) => screen.getByText(`🤢 ${label}`);

describe("PlayerSettingsMenu — toggling a condition by its label", () => {
  it("adds the condition on a single click of the text", () => {
    const { onStatusEffectsChange } = openPicker();

    fireEvent.click(labelText("Poisoned"));

    expect(onStatusEffectsChange).toHaveBeenCalledExactlyOnceWith(["poisoned"]);
    expect(screen.getByRole("checkbox", { name: /poisoned/i })).toBeChecked();
  });

  it("removes an already-active condition on a single click of the text", () => {
    const { onStatusEffectsChange } = openPicker(["poisoned"]);

    fireEvent.click(labelText("Poisoned"));

    expect(onStatusEffectsChange).toHaveBeenCalledExactlyOnceWith([]);
    expect(screen.getByRole("checkbox", { name: /poisoned/i })).not.toBeChecked();
  });

  it("clicking the checkbox itself still toggles exactly once", () => {
    const { onStatusEffectsChange } = openPicker();

    fireEvent.click(screen.getByRole("checkbox", { name: /poisoned/i }));

    expect(onStatusEffectsChange).toHaveBeenCalledExactlyOnceWith(["poisoned"]);
  });

  it("leaves the other conditions alone", () => {
    const { onStatusEffectsChange } = openPicker(["prone"]);

    fireEvent.click(labelText("Poisoned"));

    expect(onStatusEffectsChange).toHaveBeenCalledExactlyOnceWith(["prone", "poisoned"]);
  });
});
