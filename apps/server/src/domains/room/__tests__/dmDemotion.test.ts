import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Player } from "@herobyte/shared";
import { DM_ROLE_OWNER, demoteDM, rehomeNpcTokens } from "../dmDemotion.js";

type Table = Parameters<typeof demoteDM>[0];

function table(over: Partial<Table> = {}): Table {
  return {
    players: [
      { uid: "dave", name: "Dave", isDM: true } as Player,
      { uid: "sam", name: "Sam", isDM: false } as Player,
    ],
    users: ["dave", "sam"],
    characters: [
      { id: "pc-dave", type: "pc", ownedByPlayerUID: "dave", tokenId: "t-dave" },
      { id: "goblin", type: "npc", tokenId: "t-goblin" },
      { id: "bat", type: "npc", tokenId: null },
    ] as Table["characters"],
    tokens: [
      { id: "t-dave", owner: "dave" },
      { id: "t-goblin", owner: "dave" },
      { id: "t-loose", owner: "dave" },
      { id: "t-sam", owner: "sam" },
    ] as Table["tokens"],
    sceneStates: {
      cave: { tokens: [{ id: "t-bat", owner: "dave" }], characterLinks: { "t-bat": "bat" } },
    } as unknown as Table["sceneStates"],
    ...over,
  };
}

const owners = (state: Table) => Object.fromEntries(state.tokens.map((t) => [t.id, t.owner]));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("demoteDM", () => {
  it("hands every piece but the uid's own PC tokens to the DM role, parked maps included", () => {
    const state = table();
    demoteDM(state, state.players[0]!);
    expect(state.players[0]!.isDM).toBe(false);
    expect(owners(state)).toEqual({
      "t-dave": "dave",
      "t-goblin": DM_ROLE_OWNER,
      "t-loose": DM_ROLE_OWNER,
      "t-sam": "sam",
    });
    expect(state.sceneStates.cave!.tokens[0]!.owner).toBe(DM_ROLE_OWNER);
  });

  it("hands them to another DM seated at the table instead", () => {
    const state = table();
    state.players.push({ uid: "codm", name: "Co", isDM: true } as Player);
    state.users.push("codm");
    demoteDM(state, state.players[0]!);
    expect(owners(state)["t-goblin"]).toBe("codm");
    expect(state.sceneStates.cave!.tokens[0]!.owner).toBe("codm");
  });

  it("does not hand them to a DM who is not at the table now", () => {
    const state = table();
    state.players.push({ uid: "away", name: "Away", isDM: true } as Player);
    demoteDM(state, state.players[0]!);
    expect(owners(state)["t-goblin"]).toBe(DM_ROLE_OWNER);
  });
});

describe("rehomeNpcTokens", () => {
  it("takes NPC tokens from a uid that is a player now, live and parked, and leaves the rest", () => {
    const state = table();
    state.players[0]!.isDM = false; // a table saved after dave stopped being DM
    state.users = [];
    rehomeNpcTokens(state);
    expect(owners(state)).toEqual({
      "t-dave": "dave",
      "t-goblin": DM_ROLE_OWNER,
      "t-loose": "dave",
      "t-sam": "sam",
    });
    expect(state.sceneStates.cave!.tokens[0]!.owner).toBe(DM_ROLE_OWNER);
  });

  it("leaves a DM's own monsters with the DM", () => {
    const state = table();
    rehomeNpcTokens(state);
    expect(owners(state)["t-goblin"]).toBe("dave");
    expect(state.sceneStates.cave!.tokens[0]!.owner).toBe("dave");
  });

  it("at boot (no one connected), leaves the monsters of a uid saved as DM with that DM", () => {
    const state = table({ users: [] });
    rehomeNpcTokens(state);
    expect(owners(state)["t-goblin"]).toBe("dave");
    expect(state.sceneStates.cave!.tokens[0]!.owner).toBe("dave");
  });
});
