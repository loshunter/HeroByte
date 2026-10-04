/**
 * U6: World is campaign locations and their linked maps. Every action says
 * where it lands before it commits: Travel here moves the table (confirmed),
 * generating a location's map does NOT move anyone, and Kick in a Door's
 * commit is Generate & enter — it creates a location and moves the table.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AtlasNodeSnapshot, ClientMessage } from "@herobyte/shared";
import type { MapStudioController } from "../../map-studio";
import { GeneratePanel } from "../../map-edit/GeneratePanel";
import { LOST_SCENE_WARNING } from "../../map-studio/tableMapIdentity";
import { AtlasTab } from "../AtlasTab";
import type { KickControls } from "../useKickedInDoor";
import { ControlledKickPanel as KickPanel } from "./controlledKickPanel.fixtures";

const node = (id: string, overrides: Partial<AtlasNodeSnapshot> = {}): AtlasNodeSnapshot => ({
  id,
  kind: "dungeon",
  name: `name-${id}`,
  discovered: false,
  ...overrides,
});

const studio = (
  documents: Array<{ id: string; name: string }> = [],
  missingDocumentId: string | null = null,
  listed = true,
) => ({ documents, missingDocumentId, listed, refresh: vi.fn() }) as unknown as MapStudioController;

function renderWorld(props: Partial<Parameters<typeof AtlasTab>[0]> = {}) {
  const onAtlasMessage = vi.fn<(message: ClientMessage) => void>();
  render(
    <AtlasTab atlasNodes={[]} onAtlasMessage={onAtlasMessage} mapStudio={studio()} {...props} />,
  );
  return onAtlasMessage;
}

afterEach(() => vi.restoreAllMocks());

describe("World tab (U6)", () => {
  it("says what World is and where the party is", () => {
    renderWorld({
      atlasNodes: [node("keep", { mapDocumentId: "doc-keep", discovered: true })],
      currentAtlasNodeId: "keep",
    });
    expect(screen.getByText(/Campaign locations and their linked maps/)).toBeInTheDocument();
    expect(screen.getByText(/^Party is at:/)).toHaveTextContent("Party is at: name-keep");
  });

  it("says so when the party is not at any location", () => {
    renderWorld();
    expect(screen.getByText(/^Party is at:/)).toHaveTextContent("Party is at: no location yet");
  });

  it("does not claim World is empty when the table's map is just not one of its locations", () => {
    renderWorld({ atlasNodes: [node("keep")], hasCompiledScene: true });
    expect(screen.getByText(/^Party is at:/)).toHaveTextContent(
      "Party is at: a map that is not a World location",
    );
  });

  it("does not claim a map when the table has none (locations prepped ahead)", () => {
    renderWorld({ atlasNodes: [node("keep")], hasCompiledScene: false });
    expect(screen.getByText(/^Party is at:/)).toHaveTextContent(
      "Party is at: no map on the table yet",
    );
  });

  it("names a background-image table as such, the way the Maps tab does", () => {
    renderWorld({ atlasNodes: [node("keep")], hasCompiledScene: false, hasBackground: true });
    expect(screen.getByText(/^Party is at:/)).toHaveTextContent(
      "Party is at: a background image (not a World location)",
    );
  });

  it("creates a location, not a node", () => {
    const onAtlasMessage = renderWorld();
    fireEvent.change(screen.getByLabelText("New location name"), {
      target: { value: "Waystone" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Create location" }));
    expect(onAtlasMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "atlas-create-node",
        node: expect.objectContaining({ name: "Waystone" }),
      }),
    );
  });

  it("Travel here keeps its confirm, which says the whole table moves", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onAtlasMessage = renderWorld({
      atlasNodes: [
        node("here", { mapDocumentId: "doc-here", discovered: true }),
        node("there", { mapDocumentId: "doc-there", discovered: true }),
      ],
      currentAtlasNodeId: "here",
    });
    fireEvent.click(screen.getByRole("button", { name: "🚩 Travel here" }));
    expect(confirm.mock.calls[0]?.[0]).toContain('Travel the whole table to "name-there"?');
    expect(onAtlasMessage).toHaveBeenCalledWith({ t: "atlas-travel", nodeId: "there" });
  });

  describe("Travel here says what becomes of the scene it leaves", () => {
    const nodes = [
      node("here", { mapDocumentId: "doc-here", discovered: true }),
      node("there", { mapDocumentId: "doc-there", discovered: true }),
    ];
    const travelConfirm = (props: Partial<Parameters<typeof AtlasTab>[0]>) => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      const onAtlasMessage = renderWorld({
        atlasNodes: nodes,
        currentAtlasNodeId: "here",
        ...props,
      });
      fireEvent.click(screen.getByRole("button", { name: "🚩 Travel here" }));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(onAtlasMessage).not.toHaveBeenCalled();
      return String(confirm.mock.calls[0]?.[0]);
    };

    it("suspended, when the scene's map is still in the library", () => {
      const prompt = travelConfirm({
        liveSceneDocumentId: "doc-here",
        hasCompiledScene: true,
        mapStudio: studio([{ id: "doc-here", name: "Keep" }]),
      });
      expect(prompt).toContain("The current scene is suspended exactly as it stands.");
      expect(prompt).not.toContain(LOST_SCENE_WARNING);
    });

    it("lost, when the scene's map was deleted — never 'suspended'", () => {
      const prompt = travelConfirm({
        liveSceneDocumentId: "doc-gone",
        hasCompiledScene: true,
        mapStudio: studio([{ id: "doc-here", name: "Keep" }]),
      });
      expect(prompt).toContain(LOST_SCENE_WARNING);
      expect(prompt).not.toContain("suspended exactly");
    });

    it("possibly lost, before the library has answered", () => {
      const prompt = travelConfirm({
        liveSceneDocumentId: "doc-here",
        hasCompiledScene: true,
        mapStudio: studio([], null, false),
      });
      expect(prompt).toContain("has not loaded yet");
      expect(prompt).not.toContain("suspended exactly");
    });

    it("nothing suspended on an empty table, and no background is claimed", () => {
      const prompt = travelConfirm({});
      expect(prompt).toContain("nothing is suspended");
      expect(prompt).toContain("its NPCs, props and drawings stay");
      expect(prompt).not.toContain("background image");
    });

    it("nothing suspended, when the table has no saved map (a background only)", () => {
      const prompt = travelConfirm({ hasBackground: true });
      expect(prompt).toContain("The table has no saved map, so nothing is suspended.");
      expect(prompt).toContain("its background image, NPCs, props and drawings stay");
      expect(prompt).not.toContain("suspended exactly");
    });
  });

  it("generating a location's map says the party stays put", () => {
    const onAtlasMessage = renderWorld({ atlasNodes: [node("vault")] });
    fireEvent.click(screen.getByRole("button", { name: "🎲 Generate map for location…" }));
    expect(screen.getByText(/The party stays where it is/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "🎲 Generate map for name-vault" }));
    expect(onAtlasMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "atlas-generate-node", nodeId: "vault" }),
    );
    // Exactly that one message: generating never travels.
    expect(onAtlasMessage).toHaveBeenCalledTimes(1);
  });

  it("deleting a promise says what goes with it, and claims no map", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWorld({ atlasNodes: [node("vault")] });
    fireEvent.click(screen.getByRole("button", { name: "✕ Delete" }));
    expect(confirm.mock.calls[0]?.[0]).toBe(
      'Delete location "name-vault"? Any door links to or from it are removed, and any ' +
        "locations inside it move up a level.",
    );
  });

  it("deleting a mapped location says its map (and saved scene) stays in the library", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWorld({ atlasNodes: [node("vault", { mapDocumentId: "doc-vault" })] });
    fireEvent.click(screen.getByRole("button", { name: "✕ Delete" }));
    expect(confirm.mock.calls[0]?.[0]).toBe(
      'Delete location "name-vault"? Its map stays in the Map library, with any scene saved on ' +
        "it. Any door links to or from it are removed, and any locations inside it move up a level.",
    );
  });

  it("the link picker tells same-named maps apart", () => {
    renderWorld({
      atlasNodes: [node("vault")],
      mapStudio: studio([
        { id: "doc-1a2b", name: "Live Map" },
        { id: "doc-9f8e", name: "Live Map" },
      ]),
    });
    const picker = screen.getByLabelText("Map for name-vault");
    expect(picker).toHaveTextContent("Live Map #1a2b");
    expect(picker).toHaveTextContent("Live Map #9f8e");
  });
});

describe("Kick in a Door commits as Generate & enter (U6)", () => {
  const controls = (overrides: Partial<KickControls> = {}): KickControls => ({
    open: true,
    draft: null,
    updateDraft: vi.fn(),
    openKick: vi.fn(),
    closeKick: vi.fn(),
    kick: vi.fn(),
    pending: null,
    settings: {
      recipe: { recipeId: "dungeon", theme: "wood", density: "high", size: "large" },
      linkType: "stair",
    },
    canKick: true,
    ...overrides,
  });

  it("names its destination before committing, and keeps reroll separate", () => {
    const kick = controls();
    render(<KickPanel kick={kick} atlasNodes={[]} />);
    expect(
      screen.getByText("Creates a connected location and moves the whole table there."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "⟳ Reroll" })).toHaveAttribute("type", "button");
    fireEvent.click(screen.getByRole("button", { name: "⟳ Reroll" }));
    expect(kick.kick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "🚪 Generate & enter" }));
    expect(kick.kick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /ROLL$/ })).toBeNull();
  });
});

describe("Build's Generate names its destination (U6)", () => {
  it("is Generate in this area", () => {
    const onGenerate = vi.fn();
    render(
      <GeneratePanel
        params={{ theme: "stone", density: "medium", seed: 1 }}
        onChange={vi.fn()}
        onRerollSeed={vi.fn()}
        onGenerate={onGenerate}
        canGenerate
        busy={false}
        region={{ cols: 24, rows: 18 }}
        hint={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "🎲 Generate in this area" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
