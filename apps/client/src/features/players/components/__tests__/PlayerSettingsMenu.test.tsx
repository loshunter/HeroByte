import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PlayerSettingsMenu } from "../PlayerSettingsMenu";

describe("PlayerSettingsMenu", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    tokenImageInput: "",
    onTokenImageInputChange: vi.fn(),
    onTokenImageClear: vi.fn(),
    onTokenImageApply: vi.fn(),
    onSavePlayerState: vi.fn(),
    onLoadPlayerState: vi.fn(),
    selectedEffects: [],
    onStatusEffectsChange: vi.fn(),
    isDM: false,
    onToggleDMMode: vi.fn(),
  };

  describe("Status Effects Dropdown", () => {
    it("displays 'No Effects' when no status effects are selected", () => {
      render(<PlayerSettingsMenu {...defaultProps} selectedEffects={[]} />);

      const dropdownButton = screen.getByRole("button", { name: /no effects/i });
      expect(dropdownButton).toBeInTheDocument();
    });

    it("displays count of active effects", () => {
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          selectedEffects={["poisoned", "burning", "frozen"]}
        />,
      );

      const dropdownButton = screen.getByRole("button", { name: /3 active effects/i });
      expect(dropdownButton).toBeInTheDocument();
    });

    it("displays singular form when only one effect is active", () => {
      render(<PlayerSettingsMenu {...defaultProps} selectedEffects={["poisoned"]} />);

      const dropdownButton = screen.getByRole("button", { name: /1 active effect$/i });
      expect(dropdownButton).toBeInTheDocument();
    });

    it("opens dropdown when button is clicked", () => {
      render(<PlayerSettingsMenu {...defaultProps} />);

      const dropdownButton = screen.getByRole("button", { name: /no effects/i });
      fireEvent.click(dropdownButton);

      // Should show checkboxes for all status effects
      const poisonedCheckbox = screen.getByRole("checkbox", { name: /🤢 poisoned/i });
      expect(poisonedCheckbox).toBeInTheDocument();

      const burningCheckbox = screen.getByRole("checkbox", { name: /🔥 burning/i });
      expect(burningCheckbox).toBeInTheDocument();
    });

    it("checks selected effects in the dropdown", () => {
      render(<PlayerSettingsMenu {...defaultProps} selectedEffects={["poisoned", "burning"]} />);

      const dropdownButton = screen.getByRole("button", { name: /2 active effects/i });
      fireEvent.click(dropdownButton);

      const poisonedCheckbox = screen.getByRole("checkbox", { name: /🤢 poisoned/i });
      const burningCheckbox = screen.getByRole("checkbox", { name: /🔥 burning/i });
      const frozenCheckbox = screen.getByRole("checkbox", { name: /❄️ frozen/i });

      expect(poisonedCheckbox).toBeChecked();
      expect(burningCheckbox).toBeChecked();
      expect(frozenCheckbox).not.toBeChecked();
    });

    it("toggles effect when checkbox is clicked", () => {
      const onStatusEffectsChange = vi.fn();
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          selectedEffects={["poisoned"]}
          onStatusEffectsChange={onStatusEffectsChange}
        />,
      );

      // Open dropdown
      const dropdownButton = screen.getByRole("button", { name: /1 active effect/i });
      fireEvent.click(dropdownButton);

      // Click burning checkbox to add it
      const burningCheckbox = screen.getByRole("checkbox", { name: /🔥 burning/i });
      fireEvent.click(burningCheckbox);

      expect(onStatusEffectsChange).toHaveBeenCalledWith(["poisoned", "burning"]);
    });

    it("removes effect when unchecking checkbox", () => {
      const onStatusEffectsChange = vi.fn();
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          selectedEffects={["poisoned", "burning"]}
          onStatusEffectsChange={onStatusEffectsChange}
        />,
      );

      // Open dropdown
      const dropdownButton = screen.getByRole("button", { name: /2 active effects/i });
      fireEvent.click(dropdownButton);

      // Uncheck poisoned
      const poisonedCheckbox = screen.getByRole("checkbox", { name: /🤢 poisoned/i });
      fireEvent.click(poisonedCheckbox);

      expect(onStatusEffectsChange).toHaveBeenCalledWith(["burning"]);
    });

    it("displays all 40+ status effects in the dropdown", () => {
      render(<PlayerSettingsMenu {...defaultProps} />);

      const dropdownButton = screen.getByRole("button", { name: /no effects/i });
      fireEvent.click(dropdownButton);

      // Check for a sample from each category
      expect(screen.getByRole("checkbox", { name: /🧎 prone/i })).toBeInTheDocument(); // Core D&D
      expect(screen.getByRole("checkbox", { name: /💀 dead/i })).toBeInTheDocument(); // Health
      expect(screen.getByRole("checkbox", { name: /😇 blessed/i })).toBeInTheDocument(); // Buffs
      expect(screen.getByRole("checkbox", { name: /😈 hexed/i })).toBeInTheDocument(); // Debuffs
      expect(screen.getByRole("checkbox", { name: /😠 rage/i })).toBeInTheDocument(); // Combat
      expect(screen.getByRole("checkbox", { name: /🪽 flying/i })).toBeInTheDocument(); // Special
    });

    it("handles multi-word effect names correctly", () => {
      const onStatusEffectsChange = vi.fn();
      render(
        <PlayerSettingsMenu {...defaultProps} onStatusEffectsChange={onStatusEffectsChange} />,
      );

      const dropdownButton = screen.getByRole("button", { name: /no effects/i });
      fireEvent.click(dropdownButton);

      // Check that multi-word effects use kebab-case values
      const huntersMarkCheckbox = screen.getByRole("checkbox", { name: /🎯 hunter's mark/i });
      fireEvent.click(huntersMarkCheckbox);

      expect(onStatusEffectsChange).toHaveBeenCalledWith(["hunters-mark"]);
    });
  });

  describe("Menu Visibility", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = render(<PlayerSettingsMenu {...defaultProps} isOpen={false} />);

      expect(container).toBeEmptyDOMElement();
    });

    it("renders menu when isOpen is true", () => {
      render(<PlayerSettingsMenu {...defaultProps} isOpen={true} />);

      expect(screen.getByText(/player settings/i)).toBeInTheDocument();
    });
  });
});
