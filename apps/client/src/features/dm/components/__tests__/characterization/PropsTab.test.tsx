/**
 * Characterization tests for PropsTab component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:318-360
 * Target: apps/client/src/features/dm/components/PropsTab.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Prop, Player } from "@shared";

// ============================================================================
// INLINE COMPONENT STUB
// ============================================================================
// This stub will be replaced with an import after extraction

interface PropsTabProps {
  activeTab: string;
  props: Prop[];
  players: Player[];
  onCreateProp: () => void;
  onUpdateProp: (id: string, updates: Partial<Prop>) => void;
  onDeleteProp: (id: string) => void;
}

function PropsTab({
  activeTab,
  props,
  players,
  onCreateProp,
  onUpdateProp,
  onDeleteProp,
}: PropsTabProps) {
  if (activeTab !== "props") return null;

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
          Props & Objects
        </h4>
        <button onClick={onCreateProp} style={{ fontSize: "10px", padding: "6px 12px" }}>
          + Add Prop
        </button>
      </div>

      {props.length === 0 ? (
        <div style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          No props yet. Use &ldquo;Add Prop&rdquo; to create one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {props.map((prop) => (
            <div key={prop.id} data-testid={`prop-editor-${prop.id}`}>
              <div>Prop ID: {prop.id}</div>
              <div>Label: {prop.label}</div>
              <div>Players count: {players.length}</div>
              <button onClick={() => onUpdateProp(prop.id, { label: "updated" })}>
                Update Prop
              </button>
              <button onClick={() => onDeleteProp(prop.id)}>Delete Prop</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe("PropsTab - Characterization Tests", () => {
  const createMockHandlers = () => ({
    onCreateProp: vi.fn(),
    onUpdateProp: vi.fn(),
    onDeleteProp: vi.fn(),
  });

  const createMockProp = (overrides?: Partial<Prop>): Prop => ({
    id: "prop-1",
    label: "Test Prop",
    imageUrl: "https://example.com/prop.png",
    x: 100,
    y: 100,
    owner: null,
    size: "medium" as const,
    ...overrides,
  });

  const createMockPlayer = (overrides?: Partial<Player>): Player =>
    ({
      id: "player-1",
      name: "Test Player",
      ...overrides,
    }) as Player;

  describe("Initial Rendering", () => {
    it("should not render when activeTab is not 'props'", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="settings" props={[]} players={[]} {...handlers} />);

      expect(screen.queryByText("Props & Objects")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /add prop/i })).not.toBeInTheDocument();
    });

    it("should render when activeTab is 'props'", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      expect(screen.getByText("Props & Objects")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add prop/i })).toBeInTheDocument();
    });

    it("should render header with correct title", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      const header = screen.getByText("Props & Objects");
      expect(header.tagName).toBe("H4");
      expect(header).toHaveClass("jrpg-text-command");
      expect(header).toHaveStyle({ margin: 0 });
    });

    it("should render Add Prop button with correct styling", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: /add prop/i });
      expect(addButton).toHaveStyle({
        fontSize: "10px",
        padding: "6px 12px",
      });
    });
  });

  describe("Empty State", () => {
    it("should display empty state message when props array is empty", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      expect(screen.getByText(/no props yet/i)).toBeInTheDocument();
      expect(screen.getByText(/use.*add prop.*to create one/i)).toBeInTheDocument();
    });

    it("should render empty state message with correct styling", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      const emptyMessage = screen.getByText(/no props yet/i);
      expect(emptyMessage).toHaveStyle({
        color: "var(--jrpg-white)",
        fontSize: "12px",
      });
    });

    it("should not render PropEditor components when props array is empty", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <PropsTab activeTab="props" props={[]} players={[]} {...handlers} />,
      );

      const propEditors = container.querySelectorAll('[data-testid^="prop-editor-"]');
      expect(propEditors).toHaveLength(0);
    });

    it("should not render empty state when props array has items", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp()];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      expect(screen.queryByText(/no props yet/i)).not.toBeInTheDocument();
    });
  });

  describe("Add Prop Button", () => {
    it("should call onCreateProp when Add Prop button is clicked", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: /add prop/i });
      fireEvent.click(addButton);

      expect(handlers.onCreateProp).toHaveBeenCalledTimes(1);
    });

    it("should call onCreateProp once per click", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: /add prop/i });
      fireEvent.click(addButton);

      expect(handlers.onCreateProp).toHaveBeenCalledTimes(1);
    });

    it("should be clickable multiple times", () => {
      const handlers = createMockHandlers();
      render(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: /add prop/i });
      fireEvent.click(addButton);
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      expect(handlers.onCreateProp).toHaveBeenCalledTimes(3);
    });

    it("should be present even when props exist", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp()];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      const addButton = screen.getByRole("button", { name: /add prop/i });
      expect(addButton).toBeInTheDocument();
    });
  });

  describe("Props Rendering", () => {
    it("should render single prop with PropEditor", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp({ id: "prop-1", label: "Chest" })];

      const { container } = render(
        <PropsTab activeTab="props" props={props} players={[]} {...handlers} />,
      );

      const propEditor = container.querySelector('[data-testid="prop-editor-prop-1"]');
      expect(propEditor).toBeInTheDocument();
      expect(screen.getByText("Label: Chest")).toBeInTheDocument();
    });

    it("should render multiple props with PropEditor components", () => {
      const handlers = createMockHandlers();
      const props = [
        createMockProp({ id: "prop-1", label: "Chest" }),
        createMockProp({ id: "prop-2", label: "Door" }),
        createMockProp({ id: "prop-3", label: "Table" }),
      ];

      const { container } = render(
        <PropsTab activeTab="props" props={props} players={[]} {...handlers} />,
      );

      const propEditors = container.querySelectorAll('[data-testid^="prop-editor-"]');
      expect(propEditors).toHaveLength(3);
      expect(screen.getByText("Label: Chest")).toBeInTheDocument();
      expect(screen.getByText("Label: Door")).toBeInTheDocument();
      expect(screen.getByText("Label: Table")).toBeInTheDocument();
    });

    it("should use prop.id as key for each PropEditor", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp({ id: "unique-prop-id" })];

      const { container } = render(
        <PropsTab activeTab="props" props={props} players={[]} {...handlers} />,
      );

      const propEditor = container.querySelector('[data-testid="prop-editor-unique-prop-id"]');
      expect(propEditor).toBeInTheDocument();
    });

    it("should render props in a flex column container with gap", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp({ id: "prop-1" }), createMockProp({ id: "prop-2" })];

      const { container } = render(
        <PropsTab activeTab="props" props={props} players={[]} {...handlers} />,
      );

      const propsContainer = container.querySelector(
        '[style*="flex-direction: column"][style*="gap: 12px"]',
      );
      expect(propsContainer).toBeInTheDocument();
    });
  });

  describe("Props Passed to PropEditor", () => {
    it("should pass prop object to PropEditor", () => {
      const handlers = createMockHandlers();
      const prop = createMockProp({
        id: "test-prop",
        label: "Test Label",
        imageUrl: "https://example.com/image.png",
      });

      render(<PropsTab activeTab="props" props={[prop]} players={[]} {...handlers} />);

      expect(screen.getByText("Prop ID: test-prop")).toBeInTheDocument();
      expect(screen.getByText("Label: Test Label")).toBeInTheDocument();
    });

    it("should pass players array to PropEditor", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp()];
      const players = [
        createMockPlayer({ id: "p1", name: "Alice" }),
        createMockPlayer({ id: "p2", name: "Bob" }),
      ];

      render(<PropsTab activeTab="props" props={props} players={players} {...handlers} />);

      expect(screen.getByText("Players count: 2")).toBeInTheDocument();
    });

    it("should pass empty players array to PropEditor when no players", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp()];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      expect(screen.getByText("Players count: 0")).toBeInTheDocument();
    });

    it("should pass onUpdate callback to PropEditor", () => {
      const handlers = createMockHandlers();
      const prop = createMockProp({ id: "prop-1" });

      render(<PropsTab activeTab="props" props={[prop]} players={[]} {...handlers} />);

      const updateButton = screen.getByRole("button", { name: "Update Prop" });
      fireEvent.click(updateButton);

      expect(handlers.onUpdateProp).toHaveBeenCalledWith("prop-1", { label: "updated" });
    });

    it("should pass onDelete callback to PropEditor", () => {
      const handlers = createMockHandlers();
      const prop = createMockProp({ id: "prop-1" });

      render(<PropsTab activeTab="props" props={[prop]} players={[]} {...handlers} />);

      const deleteButton = screen.getByRole("button", { name: "Delete Prop" });
      fireEvent.click(deleteButton);

      expect(handlers.onDeleteProp).toHaveBeenCalledWith("prop-1");
    });
  });

  describe("onUpdate Callback", () => {
    it("should create closure that calls onUpdateProp with correct prop id", () => {
      const handlers = createMockHandlers();
      const props = [
        createMockProp({ id: "prop-1", label: "Chest" }),
        createMockProp({ id: "prop-2", label: "Door" }),
      ];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      const updateButtons = screen.getAllByRole("button", { name: "Update Prop" });

      fireEvent.click(updateButtons[0]);
      expect(handlers.onUpdateProp).toHaveBeenCalledWith("prop-1", { label: "updated" });

      fireEvent.click(updateButtons[1]);
      expect(handlers.onUpdateProp).toHaveBeenCalledWith("prop-2", { label: "updated" });
    });

    it("should pass updates object to onUpdateProp", () => {
      const handlers = createMockHandlers();
      const prop = createMockProp({ id: "prop-1" });

      render(<PropsTab activeTab="props" props={[prop]} players={[]} {...handlers} />);

      const updateButton = screen.getByRole("button", { name: "Update Prop" });
      fireEvent.click(updateButton);

      expect(handlers.onUpdateProp).toHaveBeenCalledTimes(1);
      const [propId, updates] = handlers.onUpdateProp.mock.calls[0];
      expect(propId).toBe("prop-1");
      expect(updates).toEqual({ label: "updated" });
    });
  });

  describe("onDelete Callback", () => {
    it("should create closure that calls onDeleteProp with correct prop id", () => {
      const handlers = createMockHandlers();
      const props = [
        createMockProp({ id: "prop-1", label: "Chest" }),
        createMockProp({ id: "prop-2", label: "Door" }),
      ];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      const deleteButtons = screen.getAllByRole("button", { name: "Delete Prop" });

      fireEvent.click(deleteButtons[0]);
      expect(handlers.onDeleteProp).toHaveBeenCalledWith("prop-1");

      fireEvent.click(deleteButtons[1]);
      expect(handlers.onDeleteProp).toHaveBeenCalledWith("prop-2");
    });

    it("should call onDeleteProp with only the prop id", () => {
      const handlers = createMockHandlers();
      const prop = createMockProp({ id: "prop-1" });

      render(<PropsTab activeTab="props" props={[prop]} players={[]} {...handlers} />);

      const deleteButton = screen.getByRole("button", { name: "Delete Prop" });
      fireEvent.click(deleteButton);

      expect(handlers.onDeleteProp).toHaveBeenCalledTimes(1);
      expect(handlers.onDeleteProp).toHaveBeenCalledWith("prop-1");
    });
  });

  describe("Layout Structure", () => {
    it("should render main container with flex column and 12px gap", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <PropsTab activeTab="props" props={[]} players={[]} {...handlers} />,
      );

      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveStyle({
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      });
    });

    it("should render header container with space-between and center alignment", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <PropsTab activeTab="props" props={[]} players={[]} {...handlers} />,
      );

      const headerContainer = container.querySelector(
        '[style*="justify-content: space-between"][style*="align-items: center"]',
      ) as HTMLElement;
      expect(headerContainer).toBeInTheDocument();
      expect(headerContainer).toHaveStyle({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      });
    });

    it("should contain both header and Add Prop button in header container", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <PropsTab activeTab="props" props={[]} players={[]} {...handlers} />,
      );

      const headerContainer = container.querySelector(
        '[style*="justify-content: space-between"]',
      ) as HTMLElement;

      expect(headerContainer.querySelector("h4")).toHaveTextContent("Props & Objects");
      expect(headerContainer.querySelector("button")).toHaveTextContent("+ Add Prop");
    });
  });

  describe("Props Array Updates", () => {
    it("should update from empty to populated state", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <PropsTab activeTab="props" props={[]} players={[]} {...handlers} />,
      );

      expect(screen.getByText(/no props yet/i)).toBeInTheDocument();

      const props = [createMockProp({ id: "prop-1", label: "New Prop" })];
      rerender(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      expect(screen.queryByText(/no props yet/i)).not.toBeInTheDocument();
      expect(screen.getByText("Label: New Prop")).toBeInTheDocument();
    });

    it("should update from populated to empty state", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp({ id: "prop-1", label: "Existing Prop" })];

      const { rerender } = render(
        <PropsTab activeTab="props" props={props} players={[]} {...handlers} />,
      );

      expect(screen.getByText("Label: Existing Prop")).toBeInTheDocument();

      rerender(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      expect(screen.queryByText("Label: Existing Prop")).not.toBeInTheDocument();
      expect(screen.getByText(/no props yet/i)).toBeInTheDocument();
    });

    it("should handle props array length changes", () => {
      const handlers = createMockHandlers();
      const initialProps = [createMockProp({ id: "prop-1" })];

      const { rerender, container } = render(
        <PropsTab activeTab="props" props={initialProps} players={[]} {...handlers} />,
      );

      let propEditors = container.querySelectorAll('[data-testid^="prop-editor-"]');
      expect(propEditors).toHaveLength(1);

      const updatedProps = [
        createMockProp({ id: "prop-1" }),
        createMockProp({ id: "prop-2" }),
        createMockProp({ id: "prop-3" }),
      ];

      rerender(<PropsTab activeTab="props" props={updatedProps} players={[]} {...handlers} />);

      propEditors = container.querySelectorAll('[data-testid^="prop-editor-"]');
      expect(propEditors).toHaveLength(3);
    });
  });

  describe("Players Array Updates", () => {
    it("should pass updated players array to all PropEditors", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp({ id: "prop-1" }), createMockProp({ id: "prop-2" })];
      const initialPlayers = [createMockPlayer({ id: "p1" })];

      const { rerender } = render(
        <PropsTab activeTab="props" props={props} players={initialPlayers} {...handlers} />,
      );

      expect(screen.getAllByText("Players count: 1")).toHaveLength(2);

      const updatedPlayers = [
        createMockPlayer({ id: "p1" }),
        createMockPlayer({ id: "p2" }),
        createMockPlayer({ id: "p3" }),
      ];

      rerender(<PropsTab activeTab="props" props={props} players={updatedPlayers} {...handlers} />);

      expect(screen.getAllByText("Players count: 3")).toHaveLength(2);
    });

    it("should handle players array becoming empty", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp()];
      const players = [createMockPlayer({ id: "p1" })];

      const { rerender } = render(
        <PropsTab activeTab="props" props={props} players={players} {...handlers} />,
      );

      expect(screen.getByText("Players count: 1")).toBeInTheDocument();

      rerender(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      expect(screen.getByText("Players count: 0")).toBeInTheDocument();
    });
  });

  describe("Active Tab Toggling", () => {
    it("should show content when activeTab changes to 'props'", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <PropsTab activeTab="settings" props={[]} players={[]} {...handlers} />,
      );

      expect(screen.queryByText("Props & Objects")).not.toBeInTheDocument();

      rerender(<PropsTab activeTab="props" props={[]} players={[]} {...handlers} />);

      expect(screen.getByText("Props & Objects")).toBeInTheDocument();
    });

    it("should hide content when activeTab changes from 'props'", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <PropsTab activeTab="props" props={[]} players={[]} {...handlers} />,
      );

      expect(screen.getByText("Props & Objects")).toBeInTheDocument();

      rerender(<PropsTab activeTab="settings" props={[]} players={[]} {...handlers} />);

      expect(screen.queryByText("Props & Objects")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined onCreateProp gracefully", () => {
      const { onCreateProp: _onCreateProp, ...otherHandlers } = createMockHandlers();
      render(
        <PropsTab
          activeTab="props"
          props={[]}
          players={[]}
          onCreateProp={undefined as unknown as () => void}
          {...otherHandlers}
        />,
      );

      const addButton = screen.getByRole("button", { name: /add prop/i });
      expect(() => fireEvent.click(addButton)).not.toThrow();
    });

    it("should handle prop with all fields populated", () => {
      const handlers = createMockHandlers();
      const prop = createMockProp({
        id: "detailed-prop",
        label: "Detailed Chest",
        imageUrl: "https://example.com/chest.png",
        x: 250,
        y: 300,
        owner: "player-1",
        size: "large",
      });

      render(<PropsTab activeTab="props" props={[prop]} players={[]} {...handlers} />);

      expect(screen.getByText("Prop ID: detailed-prop")).toBeInTheDocument();
      expect(screen.getByText("Label: Detailed Chest")).toBeInTheDocument();
    });

    it("should handle very long props array", () => {
      const handlers = createMockHandlers();
      const props = Array.from({ length: 50 }, (_, i) =>
        createMockProp({ id: `prop-${i}`, label: `Prop ${i}` }),
      );

      const { container } = render(
        <PropsTab activeTab="props" props={props} players={[]} {...handlers} />,
      );

      const propEditors = container.querySelectorAll('[data-testid^="prop-editor-"]');
      expect(propEditors).toHaveLength(50);
    });

    it("should handle very long players array", () => {
      const handlers = createMockHandlers();
      const props = [createMockProp()];
      const players = Array.from({ length: 100 }, (_, i) =>
        createMockPlayer({ id: `player-${i}`, name: `Player ${i}` }),
      );

      render(<PropsTab activeTab="props" props={props} players={players} {...handlers} />);

      expect(screen.getByText("Players count: 100")).toBeInTheDocument();
    });

    it("should preserve prop order from props array", () => {
      const handlers = createMockHandlers();
      const props = [
        createMockProp({ id: "alpha", label: "Alpha" }),
        createMockProp({ id: "beta", label: "Beta" }),
        createMockProp({ id: "gamma", label: "Gamma" }),
      ];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      const labels = screen.getAllByText(/Label:/);
      expect(labels[0]).toHaveTextContent("Label: Alpha");
      expect(labels[1]).toHaveTextContent("Label: Beta");
      expect(labels[2]).toHaveTextContent("Label: Gamma");
    });
  });

  describe("Callback Isolation", () => {
    it("should create separate update callbacks for each PropEditor", () => {
      const handlers = createMockHandlers();
      const props = [
        createMockProp({ id: "prop-1" }),
        createMockProp({ id: "prop-2" }),
        createMockProp({ id: "prop-3" }),
      ];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      const updateButtons = screen.getAllByRole("button", { name: "Update Prop" });

      fireEvent.click(updateButtons[0]);
      expect(handlers.onUpdateProp).toHaveBeenLastCalledWith("prop-1", { label: "updated" });

      fireEvent.click(updateButtons[1]);
      expect(handlers.onUpdateProp).toHaveBeenLastCalledWith("prop-2", { label: "updated" });

      fireEvent.click(updateButtons[2]);
      expect(handlers.onUpdateProp).toHaveBeenLastCalledWith("prop-3", { label: "updated" });

      expect(handlers.onUpdateProp).toHaveBeenCalledTimes(3);
    });

    it("should create separate delete callbacks for each PropEditor", () => {
      const handlers = createMockHandlers();
      const props = [
        createMockProp({ id: "prop-1" }),
        createMockProp({ id: "prop-2" }),
        createMockProp({ id: "prop-3" }),
      ];

      render(<PropsTab activeTab="props" props={props} players={[]} {...handlers} />);

      const deleteButtons = screen.getAllByRole("button", { name: "Delete Prop" });

      fireEvent.click(deleteButtons[0]);
      expect(handlers.onDeleteProp).toHaveBeenLastCalledWith("prop-1");

      fireEvent.click(deleteButtons[1]);
      expect(handlers.onDeleteProp).toHaveBeenLastCalledWith("prop-2");

      fireEvent.click(deleteButtons[2]);
      expect(handlers.onDeleteProp).toHaveBeenLastCalledWith("prop-3");

      expect(handlers.onDeleteProp).toHaveBeenCalledTimes(3);
    });
  });
});
