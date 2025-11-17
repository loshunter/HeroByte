/**
 * Characterization tests for NPCEditor component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:298-509
 * Target: apps/client/src/features/dm/components/NPCEditor.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Character } from "@shared";
import { NPCEditor } from "../../NPCEditor";

describe("NPCEditor - Characterization Tests", () => {
  const mockNPC: Character = {
    id: "npc-1",
    name: "Goblin",
    type: "npc",
    hp: 10,
    maxHp: 15,
    portrait: "https://example.com/goblin-portrait.jpg",
    tokenImage: "https://example.com/goblin-token.png",
    uid: "user-123",
  };

  const createMockHandlers = () => ({
    onUpdate: vi.fn(),
    onPlace: vi.fn(),
    onDelete: vi.fn(),
  });

  describe("Initial Rendering", () => {
    it("should render NPC editor with all fields populated", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      expect(screen.getByLabelText("Name")).toHaveValue("Goblin");
      expect(screen.getByLabelText("HP")).toHaveValue(10);
      expect(screen.getByLabelText("Max HP")).toHaveValue(15);
      expect(screen.getByLabelText("Portrait URL")).toHaveValue(
        "https://example.com/goblin-portrait.jpg",
      );
      expect(screen.getByLabelText("Token Image URL")).toHaveValue(
        "https://example.com/goblin-token.png",
      );
    });

    it("should show portrait and token previews when URLs are present", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitPreview = screen.getByAltText("Goblin portrait");
      const tokenPreview = screen.getByAltText("Goblin token preview");

      expect(portraitPreview).toBeInTheDocument();
      expect(portraitPreview).toHaveAttribute("src", "https://example.com/goblin-portrait.jpg");
      expect(tokenPreview).toBeInTheDocument();
      expect(tokenPreview).toHaveAttribute("src", "https://example.com/goblin-token.png");
    });

    it("should not show previews when URLs are empty", () => {
      const handlers = createMockHandlers();
      const npcWithoutImages: Character = {
        ...mockNPC,
        portrait: undefined,
        tokenImage: undefined,
      };
      render(<NPCEditor npc={npcWithoutImages} {...handlers} />);

      expect(screen.queryByAltText(/portrait/i)).not.toBeInTheDocument();
      expect(screen.queryByAltText(/token preview/i)).not.toBeInTheDocument();
    });
  });

  describe("Name Editing", () => {
    it("should update name field on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "Orc Warrior" } });

      expect(nameInput).toHaveValue("Orc Warrior");
    });

    it("should commit name on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "Orc Warrior" } });
      fireEvent.blur(nameInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Orc Warrior",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
    });

    it("should commit name on Enter key", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "Orc Warrior" } });
      fireEvent.keyDown(nameInput, { key: "Enter", code: "Enter" });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Orc Warrior",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
    });

    it("should use 'NPC' as default when name is empty or whitespace", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "   " } });
      fireEvent.blur(nameInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "NPC",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
    });

    it("should trim whitespace from name", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "  Orc Warrior  " } });
      fireEvent.blur(nameInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Orc Warrior",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
    });
  });

  describe("HP Editing", () => {
    it("should update HP field on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByLabelText("HP");
      fireEvent.change(hpInput, { target: { value: "12" } });

      expect(hpInput).toHaveValue(12);
    });

    it("should commit HP on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByLabelText("HP");
      fireEvent.change(hpInput, { target: { value: "12" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 12,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
    });

    it("should clamp HP to 0 minimum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByLabelText("HP");
      fireEvent.change(hpInput, { target: { value: "-5" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 0,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
      expect(hpInput).toHaveValue(0);
    });

    it("should clamp HP to maxHp maximum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByLabelText("HP");
      fireEvent.change(hpInput, { target: { value: "20" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 15,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
      expect(hpInput).toHaveValue(15);
    });

    it("should handle non-numeric HP input as 0", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByLabelText("HP");
      fireEvent.change(hpInput, { target: { value: "abc" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 0,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
    });
  });

  describe("Max HP Editing", () => {
    it("should update maxHp field on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByLabelText("Max HP");
      fireEvent.change(maxHpInput, { target: { value: "20" } });

      expect(maxHpInput).toHaveValue(20);
    });

    it("should commit maxHp on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByLabelText("Max HP");
      fireEvent.change(maxHpInput, { target: { value: "20" } });
      fireEvent.blur(maxHpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 10,
        maxHp: 20,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
    });

    it("should clamp maxHp to 1 minimum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByLabelText("Max HP");
      fireEvent.change(maxHpInput, { target: { value: "0" } });
      fireEvent.blur(maxHpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 1,
        maxHp: 1,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
      expect(maxHpInput).toHaveValue(1);
    });

    it("should clamp HP when maxHp is reduced below current HP", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByLabelText("Max HP");
      fireEvent.change(maxHpInput, { target: { value: "5" } });
      fireEvent.blur(maxHpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 5,
        maxHp: 5,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
      expect(screen.getByLabelText("HP")).toHaveValue(5);
    });
  });

  describe("Portrait Editing", () => {
    it("should update portrait URL on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitInput = screen.getByLabelText("Portrait URL");
      fireEvent.change(portraitInput, {
        target: { value: "https://example.com/new-portrait.jpg" },
      });

      expect(portraitInput).toHaveValue("https://example.com/new-portrait.jpg");
    });

    it("should commit portrait URL on blur", async () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitInput = screen.getByLabelText("Portrait URL");
      fireEvent.change(portraitInput, {
        target: { value: "https://example.com/new-portrait.jpg" },
      });
      fireEvent.blur(portraitInput);

      await waitFor(() => {
        expect(handlers.onUpdate).toHaveBeenCalledWith({
          name: "Goblin",
          hp: 10,
          maxHp: 15,
          portrait: "https://example.com/new-portrait.jpg",
          tokenImage: "https://example.com/goblin-token.png",
          initiativeModifier: 0,
        });
      });
    });

    it("should set portrait to undefined when URL is empty or whitespace", async () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitInput = screen.getByLabelText("Portrait URL");
      fireEvent.change(portraitInput, { target: { value: "   " } });
      fireEvent.blur(portraitInput);

      await waitFor(() => {
        expect(handlers.onUpdate).toHaveBeenCalledWith({
          name: "Goblin",
          hp: 10,
          maxHp: 15,
          portrait: undefined,
          tokenImage: "https://example.com/goblin-token.png",
          initiativeModifier: 0,
        });
      });
    });

    it("should show portrait preview when URL is valid", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const preview = screen.getByAltText("Goblin portrait");
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveStyle({ maxHeight: "100px" });
    });
  });

  describe("Token Image Editing", () => {
    it("should update token image URL on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const tokenInput = screen.getByLabelText("Token Image URL");
      fireEvent.change(tokenInput, { target: { value: "https://example.com/new-token.png" } });

      expect(tokenInput).toHaveValue("https://example.com/new-token.png");
    });

    it("should commit token image URL on blur", async () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const tokenInput = screen.getByLabelText("Token Image URL");
      fireEvent.change(tokenInput, { target: { value: "https://example.com/new-token.png" } });
      fireEvent.blur(tokenInput);

      await waitFor(() => {
        expect(handlers.onUpdate).toHaveBeenCalledWith({
          name: "Goblin",
          hp: 10,
          maxHp: 15,
          portrait: "https://example.com/goblin-portrait.jpg",
          tokenImage: "https://example.com/new-token.png",
          initiativeModifier: 0,
        });
      });
    });

    it("should set token image to undefined when URL is empty or whitespace", async () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const tokenInput = screen.getByLabelText("Token Image URL");
      fireEvent.change(tokenInput, { target: { value: "   " } });
      fireEvent.blur(tokenInput);

      await waitFor(() => {
        expect(handlers.onUpdate).toHaveBeenCalledWith({
          name: "Goblin",
          hp: 10,
          maxHp: 15,
          portrait: "https://example.com/goblin-portrait.jpg",
          tokenImage: undefined,
          initiativeModifier: 0,
        });
      });
    });

    it("should show token preview when URL is valid", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const preview = screen.getByAltText("Goblin token preview");
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveStyle({ width: "48px", height: "48px" });
    });
  });

  describe("Action Buttons", () => {
    it("should call onPlace when Place on Map button is clicked", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const placeButton = screen.getByRole("button", { name: /place on map/i });
      fireEvent.click(placeButton);

      expect(handlers.onPlace).toHaveBeenCalledTimes(1);
    });

    it("should commit updates before calling onPlace", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "Dragon" } });

      const placeButton = screen.getByRole("button", { name: /place on map/i });
      fireEvent.click(placeButton);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Dragon",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
        initiativeModifier: 0,
      });
      expect(handlers.onPlace).toHaveBeenCalledTimes(1);
    });

    it("should call onDelete when Delete button is clicked", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const deleteButton = screen.getByRole("button", { name: /delete/i });
      fireEvent.click(deleteButton);

      expect(handlers.onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Props Updates", () => {
    it("should sync internal state when npc prop changes", async () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<NPCEditor npc={mockNPC} {...handlers} />);

      const updatedNPC: Character = {
        ...mockNPC,
        name: "Orc",
        hp: 20,
        maxHp: 25,
      };

      rerender(<NPCEditor npc={updatedNPC} {...handlers} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Name")).toHaveValue("Orc");
        expect(screen.getByLabelText("HP")).toHaveValue(20);
        expect(screen.getByLabelText("Max HP")).toHaveValue(25);
      });
    });
  });

  describe("Initiative Modifier Editing", () => {
    it("should render with initiative modifier value", () => {
      const handlers = createMockHandlers();
      const npcWithModifier: Character = {
        ...mockNPC,
        initiativeModifier: 3,
      };
      render(<NPCEditor npc={npcWithModifier} {...handlers} />);

      expect(screen.getByLabelText("Init Mod")).toHaveValue(3);
    });

    it("should default to 0 when initiative modifier is undefined", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      expect(screen.getByLabelText("Init Mod")).toHaveValue(0);
    });

    it("should update initiative modifier on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const initModInput = screen.getByLabelText("Init Mod");
      fireEvent.change(initModInput, { target: { value: "5" } });
      fireEvent.blur(initModInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          initiativeModifier: 5,
        }),
      );
    });

    it("should clamp initiative modifier to -20 minimum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const initModInput = screen.getByLabelText("Init Mod");
      fireEvent.change(initModInput, { target: { value: "-25" } });
      fireEvent.blur(initModInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          initiativeModifier: -20,
        }),
      );
      expect(initModInput).toHaveValue(-20);
    });

    it("should clamp initiative modifier to +20 maximum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const initModInput = screen.getByLabelText("Init Mod");
      fireEvent.change(initModInput, { target: { value: "25" } });
      fireEvent.blur(initModInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          initiativeModifier: 20,
        }),
      );
      expect(initModInput).toHaveValue(20);
    });
  });
});
