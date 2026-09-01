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
});
