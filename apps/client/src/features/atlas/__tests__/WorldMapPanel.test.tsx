// The player's world map: renders EXACTLY what the projection sent, marks
// "you are here", and explains itself when nothing is discovered yet.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AtlasNodeSnapshot, RoomSnapshot } from "@herobyte/shared";
import { WorldMapPanel } from "../WorldMapPanel";

function node(id: string, overrides: Partial<AtlasNodeSnapshot> = {}): AtlasNodeSnapshot {
  return { id, kind: "dungeon", name: `name-${id}`, discovered: true, ...overrides };
}

function snapshotWith(nodes: AtlasNodeSnapshot[], currentAtlasNodeId?: string): RoomSnapshot {
  return { atlasNodes: nodes, currentAtlasNodeId } as unknown as RoomSnapshot;
}

describe("WorldMapPanel", () => {
  it("shows the friendly empty state before anything is discovered — atlas keys may be absent entirely", () => {
    render(<WorldMapPanel snapshot={{} as RoomSnapshot} presentation="content" />);
    expect(screen.getByText(/The map is blank/)).toBeInTheDocument();
  });

  it("renders the discovered tree with depth and marks where the party stands", () => {
    render(
      <WorldMapPanel
        snapshot={snapshotWith([node("root"), node("child", { parentId: "root" })], "child")}
        presentation="content"
      />,
    );
    expect(screen.getByLabelText("name-root")).toBeInTheDocument();
    expect(screen.getByLabelText("you are here: name-child")).toBeInTheDocument();
    expect(screen.getByText(/◀ you are here/)).toBeInTheDocument();
  });

  it("desktop presentation: the 🗺 WORLD launcher opens the window, and it is read-only", () => {
    render(<WorldMapPanel snapshot={snapshotWith([node("n1")], "n1")} />);
    expect(screen.queryByLabelText("Discovered world")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "🗺 WORLD" }));
    expect(screen.getByLabelText("Discovered world")).toBeInTheDocument();
    // Read-only: no rename/delete/travel controls exist on the player panel.
    expect(screen.queryByRole("button", { name: /TRAVEL|Rename|Delete/ })).toBeNull();
  });
});
