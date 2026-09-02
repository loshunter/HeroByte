import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { handleForkTable, type ForkTableDeps } from "../tableFork.js";
import { RoomService } from "../../../domains/room/service.js";
import { MapStudioService } from "../../../domains/mapStudio/service.js";
import { InMemoryMapDocumentStore } from "../../../domains/mapStudio/store.js";

// Scratch state file: a bare `new RoomService({ stateFile: TEST_STATE_FILE })` writes the REAL
// apps/server/herobyte-state.json, which parallel workers and the dev
// server then fight over (observed: a torn file, quarantined as .corrupt).
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "tableFork-state.json");

/**
 * Forking is the answer to "the test table's password is fixed and it gets
 * wiped" — so what it must guarantee is that the copy is COMPLETE and durable,
 * and that the source is left alone.
 */
function setup(overrides: Partial<ForkTableDeps> = {}) {
  const sent: Array<Record<string, unknown>> = [];
  const ws = {
    send: vi.fn((payload: string) => sent.push(JSON.parse(payload))),
  } as unknown as Parameters<typeof handleForkTable>[0];

  const source = new RoomService({ stateFile: TEST_STATE_FILE });
  source.getState().tokens.push({ id: "tok-1", owner: "p1", x: 2, y: 3, color: "red" });
  source.getState().characters.push({
    id: "npc-1",
    name: "Hidden Ambusher",
    type: "npc",
    visibleToPlayers: false,
    hp: 8,
    maxHp: 8,
  } as never);
  source.setState({});

  const rooms = new Map<string, RoomService>();
  const mapStudioService = new MapStudioService(new InMemoryMapDocumentStore());

  const deps: ForkTableDeps = {
    authService: { createRoom: vi.fn() } as unknown as ForkTableDeps["authService"],
    mapStudioService,
    sourceRoomId: "default",
    sourceRoomService: source,
    getRoomServiceForRoom: (id: string) => {
      let room = rooms.get(id);
      if (!room) {
        room = new RoomService({ stateFile: TEST_STATE_FILE });
        rooms.set(id, room);
      }
      return room;
    },
    isDM: true,
    ...overrides,
  };

  return { ws, sent, source, rooms, mapStudioService, deps };
}

describe("handleForkTable", () => {
  it("copies the table's contents into the new private table", async () => {
    const { ws, sent, rooms, deps } = setup();

    await handleForkTable(
      ws,
      {
        roomId: "table-keeper",
        name: "Sunday Game",
        roomPassword: "a-good-password",
      },
      deps,
    );

    expect(sent[0]).toMatchObject({
      t: "table-forked",
      roomId: "table-keeper",
      name: "Sunday Game",
    });
    const copy = rooms.get("table-keeper")!;
    expect(copy.getState().tokens).toHaveLength(1);
    expect(copy.getState().tableName).toBe("Sunday Game");
    // A private table is never labelled public and never swept.
    expect(copy.getState().isPublicTable).toBe(false);
  });

  it("carries the atlas graph AND its suspended scenes — the one flow that exists to keep work", async () => {
    const { ws, source, rooms, deps } = setup();
    source.setState({
      atlasNodes: [
        {
          id: "n1",
          kind: "dungeon",
          name: "Kept Vault",
          discovered: false,
          mapDocumentId: "doc-x",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      atlasLinks: [
        {
          id: "l1",
          fromNodeId: "n1",
          toNodeId: "n1",
          anchor: { x: 40, y: 50 },
          linkType: "door",
          visibleToPlayers: false,
        },
      ],
      sceneStates: {
        "doc-x": {
          mapDocumentId: "doc-x",
          suspendedAt: 1,
          tokens: [{ id: "goblin-token", owner: "dm", x: 1, y: 1, color: "#0f0" } as never],
          props: [],
          drawings: [],
          sceneObjects: [],
          characterLinks: {},
          doorStates: { d1: { state: "open", authored: "closed" } },
          combatActive: true,
          initiatives: {},
          fogEnabled: true,
          defaultVisionRadius: null,
        },
      },
    });

    await handleForkTable(
      ws,
      { roomId: "table-keeper", name: "Sunday Game", roomPassword: "a-good-password" },
      deps,
    );

    const copy = rooms.get("table-keeper")!.getState();
    // The whole atlas trio is copied out of band with structuredClone —
    // suspended scenes because they CANNOT ride a snapshot, nodes and links
    // because the fork is the one IN-PROCESS snapshot copy (no JSON crossing
    // to sever references) and the DM projection hands over LIVE objects.
    expect(copy.atlasNodes.map((node) => node.id)).toEqual(["n1"]);
    expect(copy.sceneStates["doc-x"]?.doorStates.d1?.state).toBe("open");
    // ...and never by reference: the source mutating later must not reach in.
    source.getState().sceneStates["doc-x"]!.combatActive = false;
    expect(copy.sceneStates["doc-x"]?.combatActive).toBe(true);
    // The A1 review's probe: an in-place discover/rename in the SOURCE bled
    // into the fork (and vice versa) because both rooms held the same node
    // object. `discovered` is privacy-bearing — this cross-tenant bleed is
    // the finding, and this assertion is its regression pin.
    source.getState().atlasNodes[0]!.discovered = true;
    source.getState().atlasNodes[0]!.name = "SourceEditedName";
    expect(copy.atlasNodes[0]?.discovered).toBe(false);
    expect(copy.atlasNodes[0]?.name).toBe("Kept Vault");
    // Links are the third clone, and were the third the regression test never
    // seeded — an in-place visibility flip in the source must not reach the fork.
    expect(copy.atlasLinks.map((entry) => entry.id)).toEqual(["l1"]);
    source.getState().atlasLinks[0]!.visibleToPlayers = true;
    source.getState().atlasLinks[0]!.anchor.x = 999;
    expect(copy.atlasLinks[0]?.visibleToPlayers).toBe(false);
    expect(copy.atlasLinks[0]?.anchor.x).toBe(40);
  });

  it("carries hidden NPCs across — the copy is the DM's view, not a player's", async () => {
    const { ws, rooms, deps } = setup();

    await handleForkTable(
      ws,
      {
        roomId: "table-keeper",
        name: "Sunday Game",
        roomPassword: "a-good-password",
      },
      deps,
    );

    const copied = rooms.get("table-keeper")!.getState().characters;
    expect(copied.some((c) => c.name === "Hidden Ambusher")).toBe(true);
  });

  it("copies the map documents — the live map is the thing worth keeping", async () => {
    const { ws, mapStudioService, deps } = setup();
    mapStudioService.create("default", {
      id: "doc-live-1",
      name: "Live Map",
      width: 1000,
      height: 1000,
    });

    await handleForkTable(
      ws,
      {
        roomId: "table-keeper",
        name: "Sunday Game",
        roomPassword: "a-good-password",
      },
      deps,
    );

    expect(mapStudioService.list("table-keeper")).toHaveLength(1);
    expect(mapStudioService.list("table-keeper")[0].name).toBe("Live Map");
    // ...and the source keeps its own copy.
    expect(mapStudioService.list("default")).toHaveLength(1);
  });

  it("co-claims the uploads so clearing the source cannot delete them", async () => {
    // Without this the copy references images it does not own, and the next
    // hourly sweep of the test table drops the last claim and deletes them.
    const copyClaims = vi.fn().mockResolvedValue(3);
    const { ws, deps } = setup({
      assetService: { copyClaims } as unknown as ForkTableDeps["assetService"],
    });

    await handleForkTable(
      ws,
      {
        roomId: "table-keeper",
        name: "Sunday Game",
        roomPassword: "a-good-password",
      },
      deps,
    );

    expect(copyClaims).toHaveBeenCalledWith("default", "table-keeper");
  });

  it("leaves the source table untouched", async () => {
    const { ws, source, deps } = setup();

    await handleForkTable(
      ws,
      {
        roomId: "table-keeper",
        name: "Sunday Game",
        roomPassword: "a-good-password",
      },
      deps,
    );

    expect(source.getState().tokens).toHaveLength(1);
    expect(source.getState().tableName).toBeUndefined();
  });

  describe("refusals", () => {
    it("refuses a non-DM", async () => {
      const { ws, sent, deps } = setup({ isDM: false });

      await handleForkTable(
        ws,
        {
          roomId: "table-keeper",
          name: "Sunday Game",
          roomPassword: "a-good-password",
        },
        deps,
      );

      expect(sent[0]).toMatchObject({ t: "table-fork-failed" });
      expect(sent[0].reason).toMatch(/only the dm/i);
    });

    it("refuses a blank name — the table has to be findable again", async () => {
      const { ws, sent, deps } = setup();

      await handleForkTable(
        ws,
        {
          roomId: "table-keeper",
          name: "   ",
          roomPassword: "a-good-password",
        },
        deps,
      );

      expect(sent[0].reason).toMatch(/name/i);
    });

    it("refuses forking a table onto itself", async () => {
      const { ws, sent, deps } = setup();

      await handleForkTable(
        ws,
        {
          roomId: "default",
          name: "Sunday Game",
          roomPassword: "a-good-password",
        },
        deps,
      );

      expect(sent[0]).toMatchObject({ t: "table-fork-failed" });
    });

    it("reports the auth service's own rejection (bad password, table limit)", async () => {
      const { ws, sent, deps } = setup({
        authService: {
          createRoom: vi.fn(() => {
            throw new Error("Table password must be at least 6 characters.");
          }),
        } as unknown as ForkTableDeps["authService"],
      });

      await handleForkTable(
        ws,
        { roomId: "table-keeper", name: "Sunday Game", roomPassword: "no" },
        deps,
      );

      expect(sent[0]).toMatchObject({
        t: "table-fork-failed",
        reason: "Table password must be at least 6 characters.",
      });
    });

    it("copies nothing when the table could not be minted", async () => {
      const { ws, rooms, deps } = setup({
        authService: {
          createRoom: vi.fn(() => {
            throw new Error("That table code is already taken. Try another.");
          }),
        } as unknown as ForkTableDeps["authService"],
      });

      await handleForkTable(
        ws,
        {
          roomId: "table-keeper",
          name: "Sunday Game",
          roomPassword: "a-good-password",
        },
        deps,
      );

      expect(rooms.has("table-keeper")).toBe(false);
    });
  });
});
