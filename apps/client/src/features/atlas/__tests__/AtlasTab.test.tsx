import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AtlasNodeSnapshot, ClientMessage } from "@herobyte/shared";
import type { MapStudioController } from "../../map-studio";
import { AtlasTab } from "../AtlasTab";

function node(id: string, overrides: Partial<AtlasNodeSnapshot> = {}): AtlasNodeSnapshot {
  return { id, kind: "dungeon", name: `name-${id}`, discovered: false, ...overrides };
}

function controller(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    documents: [],
    refresh: vi.fn(),
    ...overrides,
  } as unknown as MapStudioController;
}

function renderTab(props: Partial<Parameters<typeof AtlasTab>[0]> = {}) {
  const onAtlasMessage = vi.fn<(message: ClientMessage) => void>();
  const utils = render(
    <AtlasTab
      atlasNodes={[]}
      onAtlasMessage={onAtlasMessage}
      mapStudio={controller()}
      {...props}
    />,
  );
  return { onAtlasMessage, ...utils };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AtlasTab", () => {
  it("shows the empty state on a fresh campaign", () => {
    renderTab();
    expect(screen.getByText(/Nothing lies within/)).toBeInTheDocument();
  });

  it("fetches the document list on mount — LINK EXISTING MAP must not depend on Map Setup having been visited", () => {
    const mapStudio = controller();
    renderTab({ mapStudio });
    expect(mapStudio.refresh).toHaveBeenCalled();
  });

  it("creates a node with a minted id and clears the input", () => {
    const { onAtlasMessage } = renderTab();
    fireEvent.change(screen.getByLabelText("New node name"), {
      target: { value: "Port Meridian" },
    });
    fireEvent.change(screen.getByLabelText("New node kind"), { target: { value: "settlement" } });
    fireEvent.click(screen.getByRole("button", { name: "+ CREATE NODE" }));

    expect(onAtlasMessage).toHaveBeenCalledWith({
      t: "atlas-create-node",
      node: {
        id: expect.any(String),
        kind: "settlement",
        name: "Port Meridian",
        parentId: undefined,
      },
    });
    expect(screen.getByLabelText("New node name")).toHaveValue("");
  });

  it("marks the current node and toggles discovery", () => {
    const { onAtlasMessage } = renderTab({
      atlasNodes: [node("here", { discovered: true }), node("hidden")],
      currentAtlasNodeId: "here",
    });
    expect(screen.getByLabelText("you are here: name-here")).toBeInTheDocument();
    expect(screen.getByLabelText("promise: name-hidden")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "🚫 Hidden" })[0]!);
    expect(onAtlasMessage).toHaveBeenCalledWith({
      t: "atlas-update-node",
      nodeId: "hidden",
      patch: { discovered: true },
    });
  });

  it("renames inline on Enter", () => {
    const { onAtlasMessage } = renderTab({ atlasNodes: [node("n1")] });
    fireEvent.click(screen.getByRole("button", { name: "✏️ Rename" }));
    const input = screen.getByLabelText("Rename name-n1");
    fireEvent.change(input, { target: { value: "The Sunken Vault" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAtlasMessage).toHaveBeenCalledWith({
      t: "atlas-update-node",
      nodeId: "n1",
      patch: { name: "The Sunken Vault" },
    });
  });

  it("deletes only through the confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onAtlasMessage } = renderTab({ atlasNodes: [node("n1")] });
    fireEvent.click(screen.getByRole("button", { name: "✕ Delete" }));
    expect(onAtlasMessage).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "✕ Delete" }));
    expect(onAtlasMessage).toHaveBeenCalledWith({ t: "atlas-delete-node", nodeId: "n1" });
  });

  it("links a promise to an existing document from the controller's list", () => {
    const mapStudio = controller({
      documents: [
        {
          id: "doc-a",
          name: "Warehouse",
          width: 1,
          height: 1,
          revision: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    });
    const { onAtlasMessage } = renderTab({ atlasNodes: [node("n1")], mapStudio });

    fireEvent.change(screen.getByLabelText("Map for name-n1"), { target: { value: "doc-a" } });
    fireEvent.click(screen.getByRole("button", { name: "🔗 Link existing map" }));
    expect(onAtlasMessage).toHaveBeenCalledWith({
      t: "atlas-link-map",
      nodeId: "n1",
      documentId: "doc-a",
    });
  });

  it("offers no link picker on a mapped node", () => {
    renderTab({ atlasNodes: [node("n1", { mapDocumentId: "doc-a" })] });
    expect(screen.queryByRole("button", { name: "🔗 Link existing map" })).toBeNull();
    expect(screen.getByLabelText("mapped: name-n1")).toBeInTheDocument();
  });

  it("TRAVEL is confirm-gated, sends atlas-travel, and never shows on the current node", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onAtlasMessage } = renderTab({
      atlasNodes: [
        node("here", { mapDocumentId: "doc-here", discovered: true }),
        node("there", { mapDocumentId: "doc-there", discovered: true }),
      ],
      currentAtlasNodeId: "here",
    });
    // Exactly ONE travel button: the current node offers none.
    const buttons = screen.getAllByRole("button", { name: "🚩 TRAVEL" });
    expect(buttons).toHaveLength(1);

    confirmSpy.mockReturnValue(false);
    fireEvent.click(buttons[0]!);
    expect(onAtlasMessage).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(buttons[0]!);
    expect(onAtlasMessage).toHaveBeenCalledWith({ t: "atlas-travel", nodeId: "there" });
  });

  it("the link placer arms the aim FROM the current node with the chosen target, type and visibility", () => {
    const onArmLinkAim = vi.fn();
    renderTab({
      atlasNodes: [
        node("here", { mapDocumentId: "doc-here", discovered: true }),
        node("there", { discovered: true }),
      ],
      currentAtlasNodeId: "here",
      linkAimActive: false,
      onArmLinkAim,
    });
    fireEvent.change(screen.getByLabelText("Link target from name-here"), {
      target: { value: "there" },
    });
    fireEvent.change(screen.getByLabelText("Link type"), { target: { value: "stair" } });
    fireEvent.click(screen.getByLabelText("players see it"));
    fireEvent.click(screen.getByRole("button", { name: "⚓ AIM ON MAP" }));
    expect(onArmLinkAim).toHaveBeenCalledWith({
      fromNodeId: "here",
      toNodeId: "there",
      linkType: "stair",
      visibleToPlayers: false,
    });
  });

  it("lists the links ON the current map and removes one — a misplaced sprite is no longer permanent", () => {
    const { onAtlasMessage } = renderTab({
      atlasNodes: [
        node("here", { mapDocumentId: "doc-here", discovered: true }),
        node("there", { discovered: true }),
      ],
      atlasLinks: [
        {
          id: "l-here",
          fromNodeId: "here",
          toNodeId: "there",
          anchor: { x: 1, y: 1 },
          linkType: "stair",
        },
        {
          id: "l-elsewhere",
          fromNodeId: "there",
          toNodeId: "here",
          anchor: { x: 2, y: 2 },
          linkType: "door",
        },
      ],
      currentAtlasNodeId: "here",
      onArmLinkAim: vi.fn(),
    });
    const list = screen.getByLabelText("Links on name-here");
    expect(list).toHaveTextContent("stair → name-there");
    expect(list).not.toHaveTextContent("door");

    fireEvent.click(screen.getByRole("button", { name: "Remove stair to name-there" }));
    expect(onAtlasMessage).toHaveBeenCalledWith({ t: "atlas-delete-link", linkId: "l-here" });
  });

  it("no placer without a mapped current node, and the aiming state replaces the form", () => {
    const onArmLinkAim = vi.fn();
    // The current node exists but is a PROMISE — nothing to click an anchor on.
    renderTab({
      atlasNodes: [node("here"), node("other")],
      currentAtlasNodeId: "here",
      onArmLinkAim,
    });
    expect(screen.queryByRole("button", { name: "⚓ AIM ON MAP" })).toBeNull();

    renderTab({
      atlasNodes: [node("here", { mapDocumentId: "doc-here" }), node("there")],
      currentAtlasNodeId: "here",
      linkAimActive: true,
      onArmLinkAim,
    });
    expect(screen.getByText(/Aiming — click the spot/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "⚓ AIM ON MAP" })).toBeNull();
  });

  it("opens the generate panel on a promise node and sends the message with a minted commandId", () => {
    const { onAtlasMessage } = renderTab({ atlasNodes: [node("n1")] });
    fireEvent.click(screen.getByRole("button", { name: "🎲 Generate…" }));
    fireEvent.click(screen.getByRole("button", { name: "🎲 GENERATE" }));

    expect(onAtlasMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "atlas-generate-node",
        nodeId: "n1",
        commandId: expect.any(String),
        seed: expect.any(Number),
        params: { theme: "stone", density: "medium", size: "medium" },
      }),
    );
  });
});
