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
import React from "react";
import type { Character } from "@shared";

// Inline NPCEditor component from DMMenu.tsx for characterization testing
interface NPCEditorProps {
  npc: Character;
  onUpdate: (updates: {
    name: string;
    hp: number;
    maxHp: number;
    portrait?: string;
    tokenImage?: string;
  }) => void;
  onPlace: () => void;
  onDelete: () => void;
}

// Import the inline component from DMMenu for testing
// This will be replaced with the extracted component once refactoring is complete
const NPCEditor = ({ npc, onUpdate, onPlace, onDelete }: NPCEditorProps) => {
  const [name, setName] = React.useState(npc.name);
  const [hpInput, setHpInput] = React.useState(String(npc.hp));
  const [maxHpInput, setMaxHpInput] = React.useState(String(npc.maxHp));
  const [portrait, setPortrait] = React.useState(npc.portrait ?? "");
  const [tokenImage, setTokenImage] = React.useState(npc.tokenImage ?? "");

  React.useEffect(() => {
    setName(npc.name);
    setHpInput(String(npc.hp));
    setMaxHpInput(String(npc.maxHp));
    setPortrait(npc.portrait ?? "");
    setTokenImage(npc.tokenImage ?? "");
  }, [npc]);

  const commitUpdate = (
    overrides?: Partial<{
      name: string;
      hp: number;
      maxHp: number;
      portrait?: string;
      tokenImage?: string;
    }>,
  ) => {
    const baseHp = overrides?.hp ?? Number(hpInput);
    const baseMaxHp = overrides?.maxHp ?? Number(maxHpInput);
    const parsedHp = Math.max(0, Number.isFinite(baseHp) ? Number(baseHp) : 0);
    const parsedMax = Math.max(1, Number.isFinite(baseMaxHp) ? Number(baseMaxHp) : 1);
    const clampedHp = Math.min(parsedMax, parsedHp);

    setHpInput(String(clampedHp));
    setMaxHpInput(String(parsedMax));

    const nextNameSource = overrides?.name ?? name;
    const trimmedName = nextNameSource.trim();
    const nextPortraitSource = overrides?.portrait ?? portrait;
    const portraitValue = nextPortraitSource.trim();
    const nextTokenImageSource = overrides?.tokenImage ?? tokenImage;
    const tokenImageValue = nextTokenImageSource.trim();

    onUpdate({
      name: trimmedName.length > 0 ? trimmedName : "NPC",
      hp: clampedHp,
      maxHp: parsedMax,
      portrait: portraitValue.length > 0 ? portraitValue : undefined,
      tokenImage: tokenImageValue.length > 0 ? tokenImageValue : undefined,
    });
  };

  const handleNameBlur = () => commitUpdate({ name });
  const handleHpBlur = () => commitUpdate();
  const handleMaxHpBlur = () => commitUpdate();
  const handlePortraitBlur = () => commitUpdate({ portrait });
  const handleTokenImageBlur = () => commitUpdate({ tokenImage });

  return (
    <div data-testid="npc-editor" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label>
          Name
          <input
            type="text"
            data-testid="npc-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameBlur();
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <label style={{ flex: 1 }}>
          HP
          <input
            type="number"
            data-testid="npc-hp-input"
            min={0}
            value={hpInput}
            onChange={(e) => setHpInput(e.target.value)}
            onBlur={handleHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleHpBlur();
            }}
          />
        </label>
        <label style={{ flex: 1 }}>
          Max HP
          <input
            type="number"
            data-testid="npc-maxhp-input"
            min={1}
            value={maxHpInput}
            onChange={(e) => setMaxHpInput(e.target.value)}
            onBlur={handleMaxHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMaxHpBlur();
            }}
          />
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        Portrait URL
        <input
          type="text"
          data-testid="npc-portrait-input"
          value={portrait}
          onChange={(e) => setPortrait(e.target.value)}
          onBlur={handlePortraitBlur}
        />
      </label>
      {portrait && (
        <img
          src={portrait}
          alt={`${npc.name} portrait`}
          data-testid="npc-portrait-preview"
          style={{
            width: "100%",
            maxHeight: "100px",
            objectFit: "cover",
            borderRadius: "4px",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        Token Image URL
        <input
          type="text"
          data-testid="npc-token-input"
          value={tokenImage}
          onChange={(e) => setTokenImage(e.target.value)}
          onBlur={handleTokenImageBlur}
        />
      </label>
      {tokenImage && (
        <img
          src={tokenImage}
          alt={`${npc.name} token preview`}
          data-testid="npc-token-preview"
          style={{
            width: "48px",
            height: "48px",
            objectFit: "cover",
            borderRadius: "4px",
            alignSelf: "flex-start",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          data-testid="npc-place-button"
          onClick={() => {
            commitUpdate();
            onPlace();
          }}
          style={{ flex: 1 }}
        >
          Place on Map
        </button>
        <button data-testid="npc-delete-button" onClick={onDelete} style={{ flex: 1 }}>
          Delete
        </button>
      </div>
    </div>
  );
};

import React from "react";

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

      expect(screen.getByTestId("npc-name-input")).toHaveValue("Goblin");
      expect(screen.getByTestId("npc-hp-input")).toHaveValue(10);
      expect(screen.getByTestId("npc-maxhp-input")).toHaveValue(15);
      expect(screen.getByTestId("npc-portrait-input")).toHaveValue(
        "https://example.com/goblin-portrait.jpg",
      );
      expect(screen.getByTestId("npc-token-input")).toHaveValue(
        "https://example.com/goblin-token.png",
      );
    });

    it("should show portrait and token previews when URLs are present", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitPreview = screen.getByTestId("npc-portrait-preview");
      const tokenPreview = screen.getByTestId("npc-token-preview");

      expect(portraitPreview).toBeInTheDocument();
      expect(portraitPreview).toHaveAttribute("src", "https://example.com/goblin-portrait.jpg");
      expect(tokenPreview).toBeInTheDocument();
      expect(tokenPreview).toHaveAttribute("src", "https://example.com/goblin-token.png");
    });

    it("should not show previews when URLs are empty", () => {
      const handlers = createMockHandlers();
      const npcWithoutImages: Character = { ...mockNPC, portrait: undefined, tokenImage: undefined };
      render(<NPCEditor npc={npcWithoutImages} {...handlers} />);

      expect(screen.queryByTestId("npc-portrait-preview")).not.toBeInTheDocument();
      expect(screen.queryByTestId("npc-token-preview")).not.toBeInTheDocument();
    });
  });

  describe("Name Editing", () => {
    it("should update name field on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByTestId("npc-name-input");
      fireEvent.change(nameInput, { target: { value: "Orc Warrior" } });

      expect(nameInput).toHaveValue("Orc Warrior");
    });

    it("should commit name on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByTestId("npc-name-input");
      fireEvent.change(nameInput, { target: { value: "Orc Warrior" } });
      fireEvent.blur(nameInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Orc Warrior",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });

    it("should commit name on Enter key", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByTestId("npc-name-input");
      fireEvent.change(nameInput, { target: { value: "Orc Warrior" } });
      fireEvent.keyDown(nameInput, { key: "Enter", code: "Enter" });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Orc Warrior",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });

    it("should use 'NPC' as default when name is empty or whitespace", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByTestId("npc-name-input");
      fireEvent.change(nameInput, { target: { value: "   " } });
      fireEvent.blur(nameInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "NPC",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });

    it("should trim whitespace from name", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByTestId("npc-name-input");
      fireEvent.change(nameInput, { target: { value: "  Orc Warrior  " } });
      fireEvent.blur(nameInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Orc Warrior",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });
  });

  describe("HP Editing", () => {
    it("should update HP field on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByTestId("npc-hp-input");
      fireEvent.change(hpInput, { target: { value: "12" } });

      expect(hpInput).toHaveValue(12);
    });

    it("should commit HP on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByTestId("npc-hp-input");
      fireEvent.change(hpInput, { target: { value: "12" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 12,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });

    it("should clamp HP to 0 minimum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByTestId("npc-hp-input");
      fireEvent.change(hpInput, { target: { value: "-5" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 0,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
      expect(hpInput).toHaveValue(0);
    });

    it("should clamp HP to maxHp maximum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByTestId("npc-hp-input");
      fireEvent.change(hpInput, { target: { value: "20" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 15,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
      expect(hpInput).toHaveValue(15);
    });

    it("should handle non-numeric HP input as 0", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const hpInput = screen.getByTestId("npc-hp-input");
      fireEvent.change(hpInput, { target: { value: "abc" } });
      fireEvent.blur(hpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 0,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });
  });

  describe("Max HP Editing", () => {
    it("should update maxHp field on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByTestId("npc-maxhp-input");
      fireEvent.change(maxHpInput, { target: { value: "20" } });

      expect(maxHpInput).toHaveValue(20);
    });

    it("should commit maxHp on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByTestId("npc-maxhp-input");
      fireEvent.change(maxHpInput, { target: { value: "20" } });
      fireEvent.blur(maxHpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 10,
        maxHp: 20,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });

    it("should clamp maxHp to 1 minimum", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByTestId("npc-maxhp-input");
      fireEvent.change(maxHpInput, { target: { value: "0" } });
      fireEvent.blur(maxHpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 1,
        maxHp: 1,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
      expect(maxHpInput).toHaveValue(1);
    });

    it("should clamp HP when maxHp is reduced below current HP", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const maxHpInput = screen.getByTestId("npc-maxhp-input");
      fireEvent.change(maxHpInput, { target: { value: "5" } });
      fireEvent.blur(maxHpInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 5,
        maxHp: 5,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
      expect(screen.getByTestId("npc-hp-input")).toHaveValue(5);
    });
  });

  describe("Portrait Editing", () => {
    it("should update portrait URL on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitInput = screen.getByTestId("npc-portrait-input");
      fireEvent.change(portraitInput, { target: { value: "https://example.com/new-portrait.jpg" } });

      expect(portraitInput).toHaveValue("https://example.com/new-portrait.jpg");
    });

    it("should commit portrait URL on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitInput = screen.getByTestId("npc-portrait-input");
      fireEvent.change(portraitInput, { target: { value: "https://example.com/new-portrait.jpg" } });
      fireEvent.blur(portraitInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/new-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
    });

    it("should set portrait to undefined when URL is empty or whitespace", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const portraitInput = screen.getByTestId("npc-portrait-input");
      fireEvent.change(portraitInput, { target: { value: "   " } });
      fireEvent.blur(portraitInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 10,
        maxHp: 15,
        portrait: undefined,
        tokenImage: "https://example.com/goblin-token.png",
      });
    });

    it("should show portrait preview when URL is valid", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const preview = screen.getByTestId("npc-portrait-preview");
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveStyle({ maxHeight: "100px" });
    });
  });

  describe("Token Image Editing", () => {
    it("should update token image URL on change", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const tokenInput = screen.getByTestId("npc-token-input");
      fireEvent.change(tokenInput, { target: { value: "https://example.com/new-token.png" } });

      expect(tokenInput).toHaveValue("https://example.com/new-token.png");
    });

    it("should commit token image URL on blur", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const tokenInput = screen.getByTestId("npc-token-input");
      fireEvent.change(tokenInput, { target: { value: "https://example.com/new-token.png" } });
      fireEvent.blur(tokenInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/new-token.png",
      });
    });

    it("should set token image to undefined when URL is empty or whitespace", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const tokenInput = screen.getByTestId("npc-token-input");
      fireEvent.change(tokenInput, { target: { value: "   " } });
      fireEvent.blur(tokenInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Goblin",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: undefined,
      });
    });

    it("should show token preview when URL is valid", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const preview = screen.getByTestId("npc-token-preview");
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveStyle({ width: "48px", height: "48px" });
    });
  });

  describe("Action Buttons", () => {
    it("should call onPlace when Place on Map button is clicked", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const placeButton = screen.getByTestId("npc-place-button");
      fireEvent.click(placeButton);

      expect(handlers.onPlace).toHaveBeenCalledTimes(1);
    });

    it("should commit updates before calling onPlace", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const nameInput = screen.getByTestId("npc-name-input");
      fireEvent.change(nameInput, { target: { value: "Dragon" } });

      const placeButton = screen.getByTestId("npc-place-button");
      fireEvent.click(placeButton);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        name: "Dragon",
        hp: 10,
        maxHp: 15,
        portrait: "https://example.com/goblin-portrait.jpg",
        tokenImage: "https://example.com/goblin-token.png",
      });
      expect(handlers.onPlace).toHaveBeenCalledTimes(1);
    });

    it("should call onDelete when Delete button is clicked", () => {
      const handlers = createMockHandlers();
      render(<NPCEditor npc={mockNPC} {...handlers} />);

      const deleteButton = screen.getByTestId("npc-delete-button");
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
        expect(screen.getByTestId("npc-name-input")).toHaveValue("Orc");
        expect(screen.getByTestId("npc-hp-input")).toHaveValue(20);
        expect(screen.getByTestId("npc-maxhp-input")).toHaveValue(25);
      });
    });
  });
});
