import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { DMMenu } from "./DMMenu";
import type { Character } from "@herobyte/shared";
import { encounterControls, npc } from "../../encounter/__tests__/encounterFixtures";
import { tableControls } from "../../table/tab/__tests__/tableFixtures";
import { __resetDMMenuRequestsForTests, requestDMMenuTab } from "../../table/menuRequest";

// No test inherits a request or a subscriber from the one before it.
afterEach(() => __resetDMMenuRequestsForTests());

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
  // U7: a window-presentation menu renders its launcher into the Party dock.
  launcherDock: document.body,
  isDM: true,
  gridSize: 50,
  gridSquareSize: 5,
  gridLocked: false,
  onGridLockToggle: vi.fn(),
  onGridSizeChange: vi.fn(),
  onGridSquareSizeChange: vi.fn(),
  onClearDrawings: vi.fn(),
  onSetMapBackground: vi.fn(),
  mapBackground: undefined as string | undefined,
  camera: { x: 0, y: 0, scale: 1 },
  characters: [] as Character[],
  atlasNodes: [],
  currentAtlasNodeId: undefined as string | undefined,
  onAtlasMessage: vi.fn(),
  props: [],
  players: [],
  onCreateProp: vi.fn(),
  onUpdateProp: vi.fn(),
  onDeleteProp: vi.fn(),
  onCreateNPC: vi.fn(),
  onDuplicateNPC: vi.fn(),
  onUpdateNPC: vi.fn(),
  onSetNPCSpeed: vi.fn(),
  onResetNPCBudget: vi.fn(),
  onDeleteNPC: vi.fn(),
  onPlaceNPCToken: vi.fn(),
  onSetNPCStatusEffects: vi.fn(),
  onFocusNPCToken: vi.fn(),
  mapTokenIds: new Set<string>(),
  mapLocked: false,
  onMapLockToggle: vi.fn(),
  mapTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  onMapTransformChange: vi.fn(),
  alignmentModeActive: false,
  alignmentPoints: [],
  alignmentSuggestion: null,
  alignmentError: null,
  onAlignmentStart: vi.fn(),
  onAlignmentReset: vi.fn(),
  onAlignmentCancel: vi.fn(),
  onAlignmentApply: vi.fn(),
  encounter: encounterControls(),
  table: tableControls(),
});

describe("DMMenu", () => {
  it("renders map setup controls and applies the background URL", async () => {
    // Mock Image to simulate successful image load
    const originalImage = global.Image;
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    } as unknown as typeof Image;

    const props = createProps();

    render(<DMMenu {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    // The desktop dress is the wrapper, not just the launcher: the review
    // found nothing asserted the window actually WRAPS in window mode (the
    // content renders identically bare, so the old tests passed either way).
    expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maps" })).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/map.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Background" }));

    // Wait for async URL normalization and image loading to complete
    await waitFor(() => {
      expect(props.onSetMapBackground).toHaveBeenCalledWith("https://example.com/map.png");
    });

    global.Image = originalImage;
  });

  // Both props ride OPTIONAL the whole way from DMMenuContainer through
  // DMMenu to MapTab, so deleting either forwarding line compiles, passes
  // every other suite, and silently removes the control from both layouts —
  // the M4b defect exactly. This is the guard for that chain.
  it("forwards the table sight default onto the Map tab", () => {
    const props = createProps();
    const onDefaultVisionRadiusChange = vi.fn();

    render(
      <DMMenu
        {...props}
        defaultVisionRadius={60}
        onDefaultVisionRadiusChange={onDefaultVisionRadiusChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    expect(screen.getByLabelText("Default sight radius in feet")).toHaveValue(60);

    fireEvent.click(screen.getByRole("button", { name: "Blind" }));
    expect(onDefaultVisionRadiusChange).toHaveBeenCalledWith(0);
  });

  it("omits the table sight default when no handler is supplied", () => {
    render(<DMMenu {...createProps()} />);

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    expect(screen.queryByLabelText("Default sight radius in feet")).not.toBeInTheDocument();
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

  it("carries combat to the NPC tab: a monster in the order shows its Reset only while combat is on", () => {
    const ogre = {
      id: "ogre",
      name: "Ogre",
      type: "npc",
      hp: 30,
      maxHp: 30,
      initiative: 9,
      movementUsed: 15,
    };
    const props = {
      ...createProps(),
      characters: [ogre],
      combatActive: true,
    } as unknown as ReturnType<typeof createProps>;
    const { unmount } = render(<DMMenu {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "NPCs & Monsters" }));
    // The JRPGButton mock above drops aria-label: the visible "Reset" is the name here.
    fireEvent.click(screen.getByRole("button", { name: /^Reset$/ }));
    expect(props.onResetNPCBudget).toHaveBeenCalledWith("ogre");
    unmount();
    render(
      <DMMenu
        {...({ ...createProps(), characters: [ogre], combatActive: false } as unknown as ReturnType<
          typeof createProps
        >)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "NPCs & Monsters" }));
    expect(screen.queryByRole("button", { name: /^Reset$/ })).toBeNull();
  });

  it("forwards the connected roster and the remove handler onto the Table tab — REMOVE renders and fires through the menu", () => {
    // Both are optional all the way down, so tsc cannot see a dropped forwarding
    // line; only rendering the tab through the menu can.
    const onRemovePlayer = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const props = {
      ...createProps(),
      table: tableControls({
        players: [{ uid: "ghost", name: "Ghost", isDM: false }],
        connectedUids: [] as string[],
        onRemovePlayer,
      }),
    };
    render(<DMMenu {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemovePlayer).toHaveBeenCalledWith("ghost");
    vi.restoreAllMocks();
  });

  it("mounts Encounter after World, and its Roll missing NPC initiative sends through the controls' ONE initiative instance", () => {
    const encounter = encounterControls({ characters: [npc("gob", "Goblin")] });
    render(<DMMenu {...createProps()} encounter={encounter} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));

    const tabs = ["Maps", "World", "Encounter", "NPCs & Monsters"];
    const found = tabs.map((name) => screen.getByRole("button", { name }));
    // In that order: Encounter sits after World (plan §2.1's DM tools order).
    for (let i = 1; i < found.length; i++) {
      expect(found[i - 1].compareDocumentPosition(found[i])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }

    fireEvent.click(screen.getByRole("button", { name: "Encounter" }));
    fireEvent.click(screen.getByRole("button", { name: /Roll missing NPC initiative/ }));
    expect(encounter.initiative.rollAllInitiative).toHaveBeenCalledTimes(1);
  });

  it("Table and NPCs carry no combat: NPCs forwards to Encounter, Table has no second home for it", () => {
    const props = { ...createProps(), characters: [npc("gob", "Goblin")] as Character[] };
    render(<DMMenu {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.queryByRole("button", { name: /Start Combat|End Combat/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Clear All Initiative/i })).toBeNull();
    expect(screen.queryByText("Monster HP Display")).toBeNull();
    expect(screen.queryByRole("button", { name: /Open Encounter/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "NPCs & Monsters" }));
    expect(screen.queryByRole("button", { name: /Roll Missing/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "⚔️ Encounter" }));
    expect(screen.getByRole("heading", { name: "Run encounter" })).toBeTruthy();
  });

  it("has Table where Players and Session were, and neither of the old tabs", () => {
    render(<DMMenu {...createProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));

    const chips = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "")
      .filter((label) =>
        ["Maps", "World", "Encounter", "NPCs & Monsters", "Props & Objects", "Table"].includes(
          label,
        ),
      );
    expect(chips).toEqual([
      "Maps",
      "World",
      "Encounter",
      "NPCs & Monsters",
      "Props & Objects",
      "Table",
    ]);
    expect(screen.queryByRole("button", { name: "Players" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Session" })).toBeNull();
  });

  it("has no EXIT DM MODE above the tabs: leaving DM mode is Table's (Your role)", () => {
    const props = createProps();
    render(<DMMenu {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    expect(screen.queryByRole("button", { name: /EXIT DM MODE/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave DM mode" }));
    expect(props.table.onToggleDM).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("mounts the Table tab's five sections through the menu (a dropped mount compiles clean)", () => {
    render(<DMMenu {...createProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Table" }));

    for (const name of ["Invite", "Players at this table", "Permissions", "Backups", "Security"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("Encounter's 'Change in Table' link opens the Table tab, where the permission it names lives", () => {
    render(<DMMenu {...createProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Encounter" }));
    fireEvent.click(screen.getByRole("button", { name: "Change in Table" }));
    expect(screen.getByRole("heading", { name: "Permissions" })).toBeInTheDocument();
    expect(screen.getByLabelText("Players can enter rolls by hand")).toBeInTheDocument();
  });

  describe("'Table settings…' (from the Table menu) asks this menu for its Table tab", () => {
    it("opens an already-mounted window on Table, even if it was closed on another tab", () => {
      render(<DMMenu {...createProps()} />);
      expect(screen.queryByTestId("draggable-window")).toBeNull();

      act(() => requestDMMenuTab("table"));

      expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Permissions" })).toBeInTheDocument();
    });

    it("is taken on mount by the phone's DM screen, which mounts after the tap", () => {
      requestDMMenuTab("table");
      render(<DMMenu {...createProps()} presentation="content" />);
      expect(screen.getByRole("heading", { name: "Permissions" })).toBeInTheDocument();
    });

    it("drops a request made while the viewer was no DM, so it cannot open the menu at the next elevation", () => {
      // A menu that renders nothing for a non-DM proves nothing about the request: what has to
      // hold is that it was TAKEN and not honoured, so it is gone when the viewer becomes a DM.
      const { rerender } = render(<DMMenu {...{ ...createProps(), isDM: false }} />);
      act(() => requestDMMenuTab("table"));

      rerender(<DMMenu {...createProps()} />);

      expect(screen.queryByTestId("draggable-window")).toBeNull();
    });
  });

  it("switches to the Atlas tab and actually MOUNTS the tree (a dropped mount compiles clean)", () => {
    // The M4b lesson, applied forward: the chip existing and the props being
    // wired both survive deleting the `activeTab === "atlas"` mount block —
    // only rendering the tab's content proves the wiring end to end.
    const props = createProps();
    render(<DMMenu {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "World" }));
    expect(screen.getByText(/Nothing lies within/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New location name"), {
      target: { value: "The Docks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Create location" }));
    expect(props.onAtlasMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "atlas-create-node" }),
    );
  });

  describe('presentation="content" (the mobile DM screen, M4b)', () => {
    it("renders the content bare: no launcher, no window, tabs immediately live", () => {
      const props = createProps();
      render(<DMMenu {...props} presentation="content" />);

      // The desktop dress is gone — the host surface provides both.
      expect(screen.queryByRole("button", { name: /DM MENU/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId("draggable-window")).not.toBeInTheDocument();

      // The content is there without any launcher click: the tabs, and the default
      // Map tab's controls.
      expect(screen.getByRole("button", { name: "Maps" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Table" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /EXIT DM MODE/i })).toBeNull();
      expect(screen.getByPlaceholderText("Paste image URL")).toBeInTheDocument();

      // And the tabs still switch.
      fireEvent.click(screen.getByRole("button", { name: "NPCs & Monsters" }));
      expect(screen.getByText(/No NPCs yet/i)).toBeInTheDocument();
    });

    it("Leave DM mode (Table → Your role) still demotes from the content presentation", () => {
      const props = createProps();
      render(<DMMenu {...props} presentation="content" />);

      fireEvent.click(screen.getByRole("button", { name: "Table" }));
      fireEvent.click(screen.getByRole("button", { name: "Leave DM mode" }));

      expect(props.table.onToggleDM).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("still renders nothing for a non-DM, whatever the presentation", () => {
      const props = createProps();
      props.isDM = false;
      const { container } = render(<DMMenu {...props} presentation="content" />);

      expect(container).toBeEmptyDOMElement();
    });
  });
});
