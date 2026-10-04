import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  };

  // This menu is only ever the PER-TOKEN control, so an empty value here means
  // "inherit the table default", never "unlimited". The flag is a plain boolean
  // that tsc will not miss if it is dropped, and dropping it puts back exactly
  // the wrong label the review caught.
  describe("Sight radius wording", () => {
    it("tells the shared field that an empty value inherits the table default", () => {
      render(<PlayerSettingsMenu {...defaultProps} onTokenVisionRadiusChange={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Table Default" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Unlimited" })).not.toBeInTheDocument();
    });
  });

  describe("a DM's own card keeps its token controls", () => {
    it("token image, size and lock render for a DM's card whenever a handler is supplied", () => {
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          isDM={true}
          onTokenSizeChange={vi.fn()}
          onToggleTokenLock={vi.fn()}
          tokenLocked={false}
        />,
      );
      // The image field is on by defaultProps' handlers; size and lock by the ones above.
      expect(screen.getByText(/Token Size/i)).toBeInTheDocument();
      expect(screen.getByText(/Token Lock/i)).toBeInTheDocument();
      expect(screen.getByText(/Token Image/i)).toBeInTheDocument();
    });

    it("+ Add Character renders on a DM's card whenever the caller hands it the handler (a DM-run ally needs a card to be added from)", () => {
      render(<PlayerSettingsMenu {...defaultProps} isDM={true} onAddCharacter={vi.fn()} />);
      expect(screen.getByText(/Add Character/i)).toBeInTheDocument();
    });
  });

  describe("Movement speed", () => {
    it("renders the DM-only speed field when a handler is supplied, and commits to it", () => {
      const onCharacterSpeedChange = vi.fn();
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          characterSpeed={30}
          onCharacterSpeedChange={onCharacterSpeedChange}
        />,
      );
      const field = screen.getByLabelText("Movement speed in feet per turn");
      expect(field).toHaveValue(30);
      fireEvent.change(field, { target: { value: "25" } });
      fireEvent.blur(field);
      expect(onCharacterSpeedChange).toHaveBeenCalledWith(25);
    });

    it("carries the DM's reset beside the speed when a budget is supplied, and fires it", () => {
      const onReset = vi.fn();
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          characterSpeed={30}
          onCharacterSpeedChange={vi.fn()}
          characterBudget={{ used: 10, onReset }}
        />,
      );
      expect(screen.getByText("Used 10 ft")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Reset movement budget" }));
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it("a budget without the speed handler shows nothing — the Movement panel keys on the speed", () => {
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          characterSpeed={30}
          characterBudget={{ used: 10, onReset: vi.fn() }}
        />,
      );
      expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
    });

    it("is absent without a handler — a player's own menu never offers it", () => {
      render(<PlayerSettingsMenu {...defaultProps} />);
      expect(screen.queryByLabelText("Movement speed in feet per turn")).not.toBeInTheDocument();
    });
  });

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

  describe("Initiative Controls", () => {
    it("renders clear initiative button when handler is provided", () => {
      const onClearInitiative = vi.fn();
      render(
        <PlayerSettingsMenu
          {...defaultProps}
          initiative={16}
          onClearInitiative={onClearInitiative}
        />,
      );

      const button = screen.getByRole("button", { name: /clear initiative/i });
      expect(button).toBeEnabled();

      fireEvent.click(button);
      expect(onClearInitiative).toHaveBeenCalledTimes(1);
    });

    it("disables clear initiative button when initiative is not set", () => {
      const onClearInitiative = vi.fn();
      render(<PlayerSettingsMenu {...defaultProps} onClearInitiative={onClearInitiative} />);

      const button = screen.getByRole("button", { name: /clear initiative/i });
      expect(button).toBeDisabled();
    });
  });

  describe("Role is the table's, not this character's (U9)", () => {
    it("has no Table role section and no DM mode control, for a player, their own card or a DM", () => {
      // Enter / Leave DM mode moved to the Table menu. The interim Table role
      // section is gone for good, and leaves no pointer behind: one control, one home.
      const { rerender } = render(<PlayerSettingsMenu {...defaultProps} />);
      expect(screen.queryByRole("region", { name: "Table role" })).toBeNull();
      expect(screen.queryByRole("button", { name: /DM Mode/i })).toBeNull();
      expect(screen.queryByText(/Dungeon Master Mode/i)).toBeNull();

      rerender(<PlayerSettingsMenu {...defaultProps} isDM viewerIsDM />);
      expect(screen.queryByRole("region", { name: "Table role" })).toBeNull();
      expect(screen.queryByRole("button", { name: /DM Mode|Leave DM/i })).toBeNull();
      expect(screen.queryByText(/Table menu/i)).toBeNull();
    });
  });

  describe("Character file — Save character / Load character (U9)", () => {
    it("names its scope before a file is chosen: this character and your drawings, never the table", () => {
      render(<PlayerSettingsMenu {...defaultProps} />);
      expect(screen.getByText("Character file")).toBeInTheDocument();
      expect(screen.getByText(/plus your own drawings, if you have any/)).toBeInTheDocument();
      // A file saved with no drawings carries none, and loading it leaves yours alone.
      expect(
        screen.getByText(
          /loading a file that holds drawings replaces the ones you have on the map/i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/never saves or restores the table/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save character" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Load character…" })).toBeInTheDocument();
      // The old names are gone.
      expect(screen.queryByText("Player State")).toBeNull();
      expect(screen.queryByRole("button", { name: /Save to File|Load from File/ })).toBeNull();
    });

    it("tells a DM the truth about another player's card: their drawings are saved, a load leaves them", () => {
      // The file holds the row owner's drawings, and only a load onto the loader's OWN card
      // replaces anyone's (usePlayerActions sends sync-player-drawings for that alone).
      render(<PlayerSettingsMenu {...defaultProps} viewerIsDM />);
      expect(screen.getByText(/plus its player's drawings, if they have any/)).toBeInTheDocument();
      expect(
        screen.getByText(/replaces your drawings on the map if the file holds any/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/onto another player's it leaves their drawings alone/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/plus your own drawings/)).toBeNull();
    });

    it("Save character calls the save handler", () => {
      const onSavePlayerState = vi.fn();
      render(<PlayerSettingsMenu {...defaultProps} onSavePlayerState={onSavePlayerState} />);
      fireEvent.click(screen.getByRole("button", { name: "Save character" }));
      expect(onSavePlayerState).toHaveBeenCalledTimes(1);
    });

    it("Load character hands the chosen file to the load handler, and resets the picker", async () => {
      const onLoadPlayerState = vi.fn().mockResolvedValue(undefined);
      render(<PlayerSettingsMenu {...defaultProps} onLoadPlayerState={onLoadPlayerState} />);
      const input = screen.getByLabelText("Choose a character file to load") as HTMLInputElement;
      // jsdom reads a file input's value as "" whatever was assigned, so the assignment the
      // component makes is what is observed.
      const assigned: string[] = [];
      Object.defineProperty(input, "value", {
        configurable: true,
        get: () => "C:\\fakepath\\aria.json",
        set: (next: string) => {
          assigned.push(next);
        },
      });
      const file = new File(["{}"], "aria.json", { type: "application/json" });
      fireEvent.change(input, { target: { files: [file] } });
      await vi.waitFor(() => expect(onLoadPlayerState).toHaveBeenCalledWith(file));
      await vi.waitFor(() => expect(assigned).toEqual([""]));
    });

    it("shows the loader's own sentence when the file is the wrong kind, and changes nothing", async () => {
      const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
      const wrongKind = "That is a table backup (the whole table), not a character file.";
      const onLoadPlayerState = vi.fn().mockRejectedValue(new Error(wrongKind));
      render(<PlayerSettingsMenu {...defaultProps} onLoadPlayerState={onLoadPlayerState} />);
      const input = screen.getByLabelText("Choose a character file to load");
      const assigned: string[] = [];
      Object.defineProperty(input, "value", {
        configurable: true,
        get: () => "C:\\fakepath\\table.json",
        set: (next: string) => {
          assigned.push(next);
        },
      });
      fireEvent.change(input, {
        target: { files: [new File(["{}"], "table.json", { type: "application/json" })] },
      });
      await vi.waitFor(() => expect(alert).toHaveBeenCalledWith(wrongKind));
      // A refusal resets the picker too, or the same wrong file could not be tried twice.
      await vi.waitFor(() => expect(assigned).toEqual([""]));
      alert.mockRestore();
    });

    it("omits the whole panel without BOTH handlers: a half-wired file control is worse than none", () => {
      const { rerender } = render(
        <PlayerSettingsMenu {...defaultProps} onLoadPlayerState={undefined} />,
      );
      expect(screen.queryByText("Character file")).toBeNull();
      rerender(<PlayerSettingsMenu {...defaultProps} onSavePlayerState={undefined} />);
      expect(screen.queryByText("Character file")).toBeNull();
    });
  });
});
