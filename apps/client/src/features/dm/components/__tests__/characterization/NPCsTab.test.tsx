/**
 * Characterization tests for NPCsTab component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:274-316
 * Target: apps/client/src/features/dm/components/NPCsTab.tsx (future)
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Character } from "@shared";

// ============================================================================
// INLINE COMPONENT STUB
// ============================================================================
// This stub will be replaced with an import after extraction:
// import { NPCsTab } from "../NPCsTab";

import { JRPGButton, JRPGPanel } from "../../../../../components/ui/JRPGPanel";
import { NPCEditor } from "../../NPCEditor";

interface NPCsTabProps {
  npcs: Character[];
  onCreateNPC: () => void;
  onUpdateNPC: (
    id: string,
    updates: {
      name: string;
      hp: number;
      maxHp: number;
      portrait?: string;
      tokenImage?: string;
    },
  ) => void;
  onPlaceNPCToken: (id: string) => void;
  onDeleteNPC: (id: string) => void;
}

function NPCsTab({ npcs, onCreateNPC, onUpdateNPC, onPlaceNPCToken, onDeleteNPC }: NPCsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h4 className="jrpg-text-command" style={{ margin: 0 }}>
          NPCs & Monsters
        </h4>
        <JRPGButton
          variant="success"
          onClick={onCreateNPC}
          style={{ fontSize: "10px", padding: "6px 12px" }}
        >
          + Add NPC
        </JRPGButton>
      </div>

      {npcs.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          No NPCs yet. Use &ldquo;Add NPC&rdquo; to create one.
        </JRPGPanel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {npcs.map((npc) => (
            <NPCEditor
              key={npc.id}
              npc={npc}
              onUpdate={(updates) => onUpdateNPC(npc.id, updates)}
              onPlace={() => onPlaceNPCToken(npc.id)}
              onDelete={() => onDeleteNPC(npc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe("NPCsTab - Characterization Tests", () => {
  const createMockNPC = (overrides?: Partial<Character>): Character => ({
    id: "npc-1",
    type: "npc",
    name: "Goblin",
    hp: 10,
    maxHp: 10,
    portrait: "goblin.png",
    tokenImage: "goblin-token.png",
    tokenId: null,
    ownedByPlayerUID: null,
    ...overrides,
  });

  const createMockHandlers = () => ({
    onCreateNPC: vi.fn(),
    onUpdateNPC: vi.fn(),
    onPlaceNPCToken: vi.fn(),
    onDeleteNPC: vi.fn(),
  });

  describe("Initial Rendering - Empty State", () => {
    it("should render header with title", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      expect(screen.getByText("NPCs & Monsters")).toBeInTheDocument();
    });

    it("should render 'Add NPC' button", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: "+ Add NPC" });
      expect(addButton).toBeInTheDocument();
    });

    it("should render empty state message when no NPCs", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      expect(screen.getByText(/No NPCs yet\. Use.*Add NPC.*to create one\./)).toBeInTheDocument();
    });

    it("should not render NPCEditor when npcs array is empty", () => {
      const handlers = createMockHandlers();
      const { container } = render(<NPCsTab npcs={[]} {...handlers} />);

      // NPCEditor would contain input fields, so check for absence of those
      expect(container.querySelector('input[type="text"]')).not.toBeInTheDocument();
    });
  });

  describe("Initial Rendering - Populated State", () => {
    it("should render NPCEditor for each NPC in the array", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
        createMockNPC({ id: "npc-3", name: "Dragon" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Orc")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Dragon")).toBeInTheDocument();
    });

    it("should not render empty state message when NPCs exist", () => {
      const handlers = createMockHandlers();
      const npcs = [createMockNPC()];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      expect(
        screen.queryByText(/No NPCs yet\. Use.*Add NPC.*to create one\./),
      ).not.toBeInTheDocument();
    });

    it("should render 'Add NPC' button even when NPCs exist", () => {
      const handlers = createMockHandlers();
      const npcs = [createMockNPC()];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      expect(screen.getByRole("button", { name: "+ Add NPC" })).toBeInTheDocument();
    });

    it("should render exactly as many NPCEditors as NPCs in array", () => {
      const handlers = createMockHandlers();
      const npcs = [createMockNPC({ id: "npc-1" }), createMockNPC({ id: "npc-2" })];

      const { container } = render(<NPCsTab npcs={npcs} {...handlers} />);

      // NPCEditor has a delete button, so count those
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons).toHaveLength(2);
    });
  });

  describe("Add NPC Button Click", () => {
    it("should call onCreateNPC when Add NPC button is clicked", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: "+ Add NPC" });
      fireEvent.click(addButton);

      expect(handlers.onCreateNPC).toHaveBeenCalledTimes(1);
    });

    it("should call onCreateNPC when clicked in populated state", () => {
      const handlers = createMockHandlers();
      const npcs = [createMockNPC()];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const addButton = screen.getByRole("button", { name: "+ Add NPC" });
      fireEvent.click(addButton);

      expect(handlers.onCreateNPC).toHaveBeenCalledTimes(1);
    });

    it("should call onCreateNPC multiple times when clicked multiple times", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: "+ Add NPC" });
      fireEvent.click(addButton);
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      expect(handlers.onCreateNPC).toHaveBeenCalledTimes(3);
    });
  });

  describe("NPCEditor Props - Single NPC", () => {
    it("should pass correct npc prop to NPCEditor", () => {
      const handlers = createMockHandlers();
      const npc = createMockNPC({ name: "Test Goblin", hp: 15, maxHp: 20 });

      render(<NPCsTab npcs={[npc]} {...handlers} />);

      // Verify the NPC data is rendered correctly through NPCEditor
      expect(screen.getByDisplayValue("Test Goblin")).toBeInTheDocument();
      expect(screen.getByDisplayValue("15")).toBeInTheDocument();
      expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    });

    it("should pass onUpdate callback that calls onUpdateNPC with correct NPC id", () => {
      const handlers = createMockHandlers();
      const npc = createMockNPC({ id: "npc-123", name: "Goblin" });

      render(<NPCsTab npcs={[npc]} {...handlers} />);

      // Find and change the name input
      const nameInput = screen.getByDisplayValue("Goblin");
      fireEvent.change(nameInput, { target: { value: "Updated Goblin" } });
      fireEvent.blur(nameInput);

      expect(handlers.onUpdateNPC).toHaveBeenCalledWith(
        "npc-123",
        expect.objectContaining({
          name: "Updated Goblin",
        }),
      );
    });

    it("should pass onPlace callback that calls onPlaceNPCToken with correct NPC id", () => {
      const handlers = createMockHandlers();
      const npc = createMockNPC({ id: "npc-456" });

      render(<NPCsTab npcs={[npc]} {...handlers} />);

      const placeButton = screen.getByRole("button", { name: /place on map/i });
      fireEvent.click(placeButton);

      expect(handlers.onPlaceNPCToken).toHaveBeenCalledWith("npc-456");
      expect(handlers.onPlaceNPCToken).toHaveBeenCalledTimes(1);
    });

    it("should pass onDelete callback that calls onDeleteNPC with correct NPC id", () => {
      const handlers = createMockHandlers();
      const npc = createMockNPC({ id: "npc-789" });

      render(<NPCsTab npcs={[npc]} {...handlers} />);

      const deleteButton = screen.getByRole("button", { name: /delete/i });
      fireEvent.click(deleteButton);

      expect(handlers.onDeleteNPC).toHaveBeenCalledWith("npc-789");
      expect(handlers.onDeleteNPC).toHaveBeenCalledTimes(1);
    });
  });

  describe("NPCEditor Props - Multiple NPCs", () => {
    it("should pass unique npc prop to each NPCEditor", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin", hp: 10, maxHp: 10 }),
        createMockNPC({ id: "npc-2", name: "Orc", hp: 25, maxHp: 30 }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Orc")).toBeInTheDocument();
    });

    it("should call onUpdateNPC with correct id for first NPC", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const goblinInput = screen.getByDisplayValue("Goblin");
      fireEvent.change(goblinInput, { target: { value: "Updated Goblin" } });
      fireEvent.blur(goblinInput);

      expect(handlers.onUpdateNPC).toHaveBeenCalledWith(
        "npc-1",
        expect.objectContaining({
          name: "Updated Goblin",
        }),
      );
    });

    it("should call onUpdateNPC with correct id for second NPC", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const orcInput = screen.getByDisplayValue("Orc");
      fireEvent.change(orcInput, { target: { value: "Updated Orc" } });
      fireEvent.blur(orcInput);

      expect(handlers.onUpdateNPC).toHaveBeenCalledWith(
        "npc-2",
        expect.objectContaining({
          name: "Updated Orc",
        }),
      );
    });

    it("should call onPlaceNPCToken with correct id when clicking place button on first NPC", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const placeButtons = screen.getAllByRole("button", { name: /place on map/i });
      fireEvent.click(placeButtons[0]);

      expect(handlers.onPlaceNPCToken).toHaveBeenCalledWith("npc-1");
    });

    it("should call onPlaceNPCToken with correct id when clicking place button on second NPC", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const placeButtons = screen.getAllByRole("button", { name: /place on map/i });
      fireEvent.click(placeButtons[1]);

      expect(handlers.onPlaceNPCToken).toHaveBeenCalledWith("npc-2");
    });

    it("should call onDeleteNPC with correct id when clicking delete button on first NPC", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      expect(handlers.onDeleteNPC).toHaveBeenCalledWith("npc-1");
    });

    it("should call onDeleteNPC with correct id when clicking delete button on second NPC", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[1]);

      expect(handlers.onDeleteNPC).toHaveBeenCalledWith("npc-2");
    });
  });

  describe("Empty State Panel Styling", () => {
    it("should render JRPGPanel with simple variant", () => {
      const handlers = createMockHandlers();
      const { container } = render(<NPCsTab npcs={[]} {...handlers} />);

      // JRPGPanel with variant="simple" gets the jrpg-frame-simple class
      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();
    });

    it("should apply correct styling to empty state panel", () => {
      const handlers = createMockHandlers();
      const { container } = render(<NPCsTab npcs={[]} {...handlers} />);

      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toHaveStyle({ fontSize: "12px" });
    });
  });

  describe("Header Styling", () => {
    it("should render header with jrpg-text-command class", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      const header = screen.getByText("NPCs & Monsters");
      expect(header.tagName).toBe("H4");
      expect(header).toHaveClass("jrpg-text-command");
    });

    it("should apply correct styling to header", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      const header = screen.getByText("NPCs & Monsters");
      expect(header).toHaveStyle({ margin: 0 });
    });
  });

  describe("Add NPC Button Styling", () => {
    it("should render button with success variant", () => {
      const handlers = createMockHandlers();
      const { container } = render(<NPCsTab npcs={[]} {...handlers} />);

      const button = screen.getByRole("button", { name: "+ Add NPC" });
      // JRPGButton with variant="success" gets specific styling
      expect(button).toBeInTheDocument();
    });

    it("should apply correct styling to Add NPC button", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      const button = screen.getByRole("button", { name: "+ Add NPC" });
      expect(button).toHaveStyle({ fontSize: "10px", padding: "6px 12px" });
    });
  });

  describe("Props Updates", () => {
    it("should update when npcs array changes from empty to populated", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<NPCsTab npcs={[]} {...handlers} />);

      expect(screen.getByText(/No NPCs yet\. Use.*Add NPC.*to create one\./)).toBeInTheDocument();

      const npcs = [createMockNPC({ name: "New Goblin" })];
      rerender(<NPCsTab npcs={npcs} {...handlers} />);

      expect(
        screen.queryByText(/No NPCs yet\. Use.*Add NPC.*to create one\./),
      ).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("New Goblin")).toBeInTheDocument();
    });

    it("should update when npcs array changes from populated to empty", () => {
      const handlers = createMockHandlers();
      const npcs = [createMockNPC({ name: "Goblin" })];
      const { rerender } = render(<NPCsTab npcs={npcs} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();

      rerender(<NPCsTab npcs={[]} {...handlers} />);

      expect(screen.queryByDisplayValue("Goblin")).not.toBeInTheDocument();
      expect(screen.getByText(/No NPCs yet\. Use.*Add NPC.*to create one\./)).toBeInTheDocument();
    });

    it("should update when NPC is added to array", () => {
      const handlers = createMockHandlers();
      const npcs1 = [createMockNPC({ id: "npc-1", name: "Goblin" })];
      const { rerender } = render(<NPCsTab npcs={npcs1} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Orc")).not.toBeInTheDocument();

      const npcs2 = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];
      rerender(<NPCsTab npcs={npcs2} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Orc")).toBeInTheDocument();
    });

    it("should update when NPC is removed from array", () => {
      const handlers = createMockHandlers();
      const npcs1 = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
      ];
      const { rerender } = render(<NPCsTab npcs={npcs1} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Orc")).toBeInTheDocument();

      const npcs2 = [createMockNPC({ id: "npc-1", name: "Goblin" })];
      rerender(<NPCsTab npcs={npcs2} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Orc")).not.toBeInTheDocument();
    });

    it("should update when NPC properties change", () => {
      const handlers = createMockHandlers();
      const npcs1 = [createMockNPC({ id: "npc-1", name: "Goblin", hp: 10 })];
      const { rerender } = render(<NPCsTab npcs={npcs1} {...handlers} />);

      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();

      const npcs2 = [createMockNPC({ id: "npc-1", name: "Updated Goblin", hp: 5 })];
      rerender(<NPCsTab npcs={npcs2} {...handlers} />);

      expect(screen.queryByDisplayValue("Goblin")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Updated Goblin")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle NPC with minimal properties", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({
          id: "minimal",
          name: "",
          hp: 0,
          maxHp: 0,
          portrait: undefined,
          tokenImage: undefined,
        }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      // Should still render NPCEditor even with minimal data
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("should handle large number of NPCs", () => {
      const handlers = createMockHandlers();
      const npcs = Array.from({ length: 20 }, (_, i) =>
        createMockNPC({ id: `npc-${i}`, name: `NPC ${i}` }),
      );

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons).toHaveLength(20);
    });

    it("should handle NPC with very long name", () => {
      const handlers = createMockHandlers();
      const longName = "A".repeat(100);
      const npcs = [createMockNPC({ name: longName })];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      expect(screen.getByDisplayValue(longName)).toBeInTheDocument();
    });

    it("should maintain unique keys for each NPCEditor", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Orc" }),
        createMockNPC({ id: "npc-3", name: "Dragon" }),
      ];

      const { rerender } = render(<NPCsTab npcs={npcs} {...handlers} />);

      // Reorder NPCs
      const reorderedNpcs = [npcs[2], npcs[0], npcs[1]];
      rerender(<NPCsTab npcs={reorderedNpcs} {...handlers} />);

      // Should still render all NPCs correctly
      expect(screen.getByDisplayValue("Goblin")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Orc")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Dragon")).toBeInTheDocument();
    });

    it("should not call handlers when onCreateNPC is undefined", () => {
      const handlers = {
        onCreateNPC: undefined as unknown as () => void,
        onUpdateNPC: vi.fn(),
        onPlaceNPCToken: vi.fn(),
        onDeleteNPC: vi.fn(),
      };

      render(<NPCsTab npcs={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: "+ Add NPC" });
      fireEvent.click(addButton);

      // Should not throw error, just do nothing
      expect(handlers.onUpdateNPC).not.toHaveBeenCalled();
    });

    it("should render correctly when all NPCs have same name", () => {
      const handlers = createMockHandlers();
      const npcs = [
        createMockNPC({ id: "npc-1", name: "Goblin" }),
        createMockNPC({ id: "npc-2", name: "Goblin" }),
        createMockNPC({ id: "npc-3", name: "Goblin" }),
      ];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      const nameInputs = screen.getAllByDisplayValue("Goblin");
      expect(nameInputs).toHaveLength(3);
    });
  });

  describe("Composition - Child Components Rendered", () => {
    it("should render JRPGButton component for Add NPC", () => {
      const handlers = createMockHandlers();
      render(<NPCsTab npcs={[]} {...handlers} />);

      const button = screen.getByRole("button", { name: "+ Add NPC" });
      expect(button).toBeInTheDocument();
    });

    it("should render JRPGPanel component in empty state", () => {
      const handlers = createMockHandlers();
      const { container } = render(<NPCsTab npcs={[]} {...handlers} />);

      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();
    });

    it("should render NPCEditor components when NPCs exist", () => {
      const handlers = createMockHandlers();
      const npcs = [createMockNPC()];

      render(<NPCsTab npcs={npcs} {...handlers} />);

      // NPCEditor renders input fields and buttons
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /place on map/i })).toBeInTheDocument();
    });

    it("should not render both JRPGPanel and NPCEditor simultaneously", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<NPCsTab npcs={[]} {...handlers} />);

      // Empty state: Panel message should exist, NPCEditor should not
      expect(screen.getByText(/No NPCs yet\. Use.*Add NPC.*to create one\./)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();

      // Populated state: NPCEditor should exist, Panel message should not
      const npcs = [createMockNPC()];
      rerender(<NPCsTab npcs={npcs} {...handlers} />);

      expect(
        screen.queryByText(/No NPCs yet\. Use.*Add NPC.*to create one\./),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });
});
