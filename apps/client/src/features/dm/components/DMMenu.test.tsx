import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { DMMenu } from "./DMMenu";
import type { Character } from "@shared";

vi.mock("../../../components/ui/JRPGPanel", () => {
  const JRPGPanel = ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
    variant?: string;
    style?: React.CSSProperties;
  }) => (
    <div data-testid={title ? `panel-${title}` : "jrpg-panel"}>
      {title ? <h5>{title}</h5> : null}
      {children}
    </div>
  );

  const JRPGButton = ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    style?: React.CSSProperties;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );

  return {
    JRPGPanel,
    JRPGButton,
  };
});

vi.mock("../../../components/dice/DraggableWindow", () => ({
  DraggableWindow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="draggable-window">{children}</div>
  ),
}));

const createProps = () => ({
  isDM: true,
  onToggleDM: vi.fn(),
  gridSize: 50,
  gridSquareSize: 5,
  gridLocked: false,
  onGridLockToggle: vi.fn(),
  onGridSizeChange: vi.fn(),
  onGridSquareSizeChange: vi.fn(),
  onClearDrawings: vi.fn(),
  onSetMapBackground: vi.fn(),
  mapBackground: undefined as string | undefined,
  playerCount: 2,
  characters: [] as Character[],
  onRequestSaveSession: undefined as ((name: string) => void) | undefined,
  onRequestLoadSession: vi.fn(),
  onCreateNPC: vi.fn(),
  onUpdateNPC: vi.fn(),
  onDeleteNPC: vi.fn(),
  onPlaceNPCToken: vi.fn(),
  mapLocked: false,
  onMapLockToggle: vi.fn(),
  mapTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  onMapTransformChange: vi.fn(),
});

describe("DMMenu", () => {
  it("renders map setup controls and applies the background URL", () => {
    const props = createProps();

    render(<DMMenu {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    expect(screen.getByRole("button", { name: "Map Setup" })).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/map.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Background" }));

    expect(props.onSetMapBackground).toHaveBeenCalledWith("https://example.com/map.png");
  });

  it("switches to the NPC tab and triggers NPC creation", () => {
    const props = createProps();

    render(<DMMenu {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "NPCs & Monsters" }));
    expect(screen.getByText(/No NPCs yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add NPC" }));
    expect(props.onCreateNPC).toHaveBeenCalledTimes(1);
  });
});
