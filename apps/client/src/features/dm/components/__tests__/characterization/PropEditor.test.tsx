/**
 * Characterization tests for PropEditor component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:113-280
 * Target: apps/client/src/features/dm/components/PropEditor.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Prop, Player } from "@shared";
import { PropEditor } from "../../PropEditor";

describe("PropEditor - Characterization Tests", () => {
  const mockPlayers: Player[] = [
    {
      uid: "player-1",
      name: "Alice",
      character: {
        id: "char-1",
        name: "Alice",
        type: "pc",
        hp: 20,
        maxHp: 20,
        uid: "player-1",
      },
    },
    {
      uid: "player-2",
      name: "Bob",
      character: {
        id: "char-2",
        name: "Bob",
        type: "pc",
        hp: 15,
        maxHp: 15,
        uid: "player-2",
      },
    },
  ];

  const mockProp: Prop = {
    id: "prop-1",
    label: "Treasure Chest",
    imageUrl: "https://example.com/chest.png",
    position: { x: 100, y: 100 },
    owner: null,
    size: "medium",
  };

  const createMockHandlers = () => ({
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
  });

  describe("Initial Rendering", () => {
    it("should render prop editor with all fields populated", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      expect(screen.getByLabelText("Label")).toHaveValue("Treasure Chest");
      expect(screen.getByLabelText("Image URL")).toHaveValue("https://example.com/chest.png");
      expect(screen.getByLabelText("Ownership")).toHaveValue("null");
      expect(screen.getByLabelText("Size")).toHaveValue("medium");
    });

    it("should show image preview when URL is present", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const preview = screen.getByAltText(/preview/i);
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveAttribute("src", "https://example.com/chest.png");
      expect(preview).toHaveAttribute("alt", "Treasure Chest preview");
    });

    it("should not show preview when URL is empty", () => {
      const handlers = createMockHandlers();
      const propWithoutImage: Prop = { ...mockProp, imageUrl: "" };
      render(<PropEditor prop={propWithoutImage} players={mockPlayers} {...handlers} />);

      expect(screen.queryByAltText(/preview/i)).not.toBeInTheDocument();
    });

    it("should render ownership options correctly", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const select = screen.getByLabelText("Ownership");
      const options = Array.from(select.querySelectorAll("option"));

      expect(options).toHaveLength(4); // DM Only, Everyone, Alice, Bob
      expect(options[0]).toHaveValue("null");
      expect(options[0]).toHaveTextContent("DM Only");
      expect(options[1]).toHaveValue("*");
      expect(options[1]).toHaveTextContent("Everyone");
      expect(options[2]).toHaveValue("player-1");
      expect(options[2]).toHaveTextContent("Alice");
      expect(options[3]).toHaveValue("player-2");
      expect(options[3]).toHaveTextContent("Bob");
    });
  });

  describe("Label Editing", () => {
    it("should update label field on change", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const labelInput = screen.getByLabelText("Label");
      fireEvent.change(labelInput, { target: { value: "Magic Orb" } });

      expect(labelInput).toHaveValue("Magic Orb");
    });

    it("should commit label on blur", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const labelInput = screen.getByLabelText("Label");
      fireEvent.change(labelInput, { target: { value: "Magic Orb" } });
      fireEvent.blur(labelInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Magic Orb",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "medium",
      });
    });

    it("should commit label on Enter key", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const labelInput = screen.getByLabelText("Label");
      fireEvent.change(labelInput, { target: { value: "Magic Orb" } });
      fireEvent.keyDown(labelInput, { key: "Enter", code: "Enter" });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Magic Orb",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "medium",
      });
    });

    it("should use 'Prop' as default when label is empty or whitespace", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const labelInput = screen.getByLabelText("Label");
      fireEvent.change(labelInput, { target: { value: "   " } });
      fireEvent.blur(labelInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Prop",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "medium",
      });
    });

    it("should trim whitespace from label", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const labelInput = screen.getByLabelText("Label");
      fireEvent.change(labelInput, { target: { value: "  Magic Orb  " } });
      fireEvent.blur(labelInput);

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Magic Orb",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "medium",
      });
    });
  });

  describe("Image URL Editing", () => {
    it("should update image URL on change", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const imageInput = screen.getByLabelText("Image URL");
      fireEvent.change(imageInput, { target: { value: "https://example.com/orb.png" } });

      expect(imageInput).toHaveValue("https://example.com/orb.png");
    });

    it("should commit image URL on blur", async () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const imageInput = screen.getByLabelText("Image URL");
      fireEvent.change(imageInput, { target: { value: "https://example.com/orb.png" } });
      fireEvent.blur(imageInput);

      await waitFor(() => {
        expect(handlers.onUpdate).toHaveBeenCalledWith({
          label: "Treasure Chest",
          imageUrl: "https://example.com/orb.png",
          owner: null,
          size: "medium",
        });
      });
    });

    it("should trim whitespace from image URL", async () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const imageInput = screen.getByLabelText("Image URL");
      fireEvent.change(imageInput, { target: { value: "  https://example.com/orb.png  " } });
      fireEvent.blur(imageInput);

      await waitFor(() => {
        expect(handlers.onUpdate).toHaveBeenCalledWith({
          label: "Treasure Chest",
          imageUrl: "https://example.com/orb.png",
          owner: null,
          size: "medium",
        });
      });
    });
  });

  describe("Ownership Selection", () => {
    it("should commit ownership change to null (DM Only)", () => {
      const handlers = createMockHandlers();
      const propWithOwner: Prop = { ...mockProp, owner: "player-1" };
      render(<PropEditor prop={propWithOwner} players={mockPlayers} {...handlers} />);

      const ownerSelect = screen.getByLabelText("Ownership");
      fireEvent.change(ownerSelect, { target: { value: "null" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "medium",
      });
    });

    it("should commit ownership change to * (Everyone)", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const ownerSelect = screen.getByLabelText("Ownership");
      fireEvent.change(ownerSelect, { target: { value: "*" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: "*",
        size: "medium",
      });
    });

    it("should commit ownership change to specific player", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const ownerSelect = screen.getByLabelText("Ownership");
      fireEvent.change(ownerSelect, { target: { value: "player-1" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: "player-1",
        size: "medium",
      });
    });

    it("should update ownership immediately on change", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const ownerSelect = screen.getByLabelText("Ownership");
      fireEvent.change(ownerSelect, { target: { value: "player-2" } });

      // Should be called immediately, not on blur
      expect(handlers.onUpdate).toHaveBeenCalledTimes(1);
      expect(ownerSelect).toHaveValue("player-2");
    });
  });

  describe("Size Selection", () => {
    it("should commit size change to tiny", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const sizeSelect = screen.getByLabelText("Size");
      fireEvent.change(sizeSelect, { target: { value: "tiny" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "tiny",
      });
    });

    it("should commit size change to small", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const sizeSelect = screen.getByLabelText("Size");
      fireEvent.change(sizeSelect, { target: { value: "small" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "small",
      });
    });

    it("should commit size change to large", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const sizeSelect = screen.getByLabelText("Size");
      fireEvent.change(sizeSelect, { target: { value: "large" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "large",
      });
    });

    it("should commit size change to huge", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const sizeSelect = screen.getByLabelText("Size");
      fireEvent.change(sizeSelect, { target: { value: "huge" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "huge",
      });
    });

    it("should commit size change to gargantuan", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const sizeSelect = screen.getByLabelText("Size");
      fireEvent.change(sizeSelect, { target: { value: "gargantuan" } });

      expect(handlers.onUpdate).toHaveBeenCalledWith({
        label: "Treasure Chest",
        imageUrl: "https://example.com/chest.png",
        owner: null,
        size: "gargantuan",
      });
    });

    it("should update size immediately on change", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const sizeSelect = screen.getByLabelText("Size");
      fireEvent.change(sizeSelect, { target: { value: "large" } });

      // Should be called immediately, not on blur
      expect(handlers.onUpdate).toHaveBeenCalledTimes(1);
      expect(sizeSelect).toHaveValue("large");
    });
  });

  describe("Delete Button", () => {
    it("should call onDelete when delete button is clicked", () => {
      const handlers = createMockHandlers();
      render(<PropEditor prop={mockProp} players={mockPlayers} {...handlers} />);

      const deleteButton = screen.getByRole("button", { name: /delete/i });
      fireEvent.click(deleteButton);

      expect(handlers.onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Props Updates", () => {
    it("should update all fields when prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <PropEditor prop={mockProp} players={mockPlayers} {...handlers} />,
      );

      const newProp: Prop = {
        id: "prop-2",
        label: "Ancient Relic",
        imageUrl: "https://example.com/relic.png",
        position: { x: 200, y: 200 },
        owner: "player-1",
        size: "small",
      };

      rerender(<PropEditor prop={newProp} players={mockPlayers} {...handlers} />);

      expect(screen.getByLabelText("Label")).toHaveValue("Ancient Relic");
      expect(screen.getByLabelText("Image URL")).toHaveValue("https://example.com/relic.png");
      expect(screen.getByLabelText("Ownership")).toHaveValue("player-1");
      expect(screen.getByLabelText("Size")).toHaveValue("small");
    });
  });
});
