import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterService } from "../character/service.js";
import { createEmptyRoomState } from "../room/model.js";
import { TokenService } from "../token/service.js";

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue("character-1"),
  };
});

import { randomUUID } from "crypto";

describe("CharacterService", () => {
  const service = new CharacterService();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates characters and keeps them unclaimed by default", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Hero", 30, "portrait");

    expect(randomUUID).toHaveBeenCalled();
    expect(character.id).toBe("character-1");
    expect(character.hp).toBe(30);
    expect(character.ownedByPlayerUID).toBeNull();
    expect(state.characters).toHaveLength(1);
  });

  it("claims, updates, and links characters", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Hero", 30);

    expect(service.claimCharacter(state, character.id, "uid-1")).toBe(true);
    expect(service.claimCharacter(state, character.id, "uid-2")).toBe(false);
    expect(service.updateHP(state, character.id, 20, 35)).toBe(true);
    expect(service.linkToken(state, character.id, "token-1")).toBe(true);
    expect(service.unlinkToken(state, "token-1")).toBe(true);

    const stored = service.findCharacter(state, character.id);
    expect(stored?.ownedByPlayerUID).toBe("uid-1");
    expect(stored?.hp).toBe(20);
    expect(service.canControlCharacter(stored!, "uid-1")).toBe(true);
  });

  it("identifies unclaimed characters and ownership lookups", () => {
    const state = createEmptyRoomState();
    const charA = service.createCharacter(state, "A", 10);
    const charB = service.createCharacter(state, "B", 10);

    service.claimCharacter(state, charA.id, "uid-1");

    expect(service.findCharacterByOwner(state, "uid-1")?.id).toBe(charA.id);
    const unclaimed = service.getUnclaimedCharacters(state);
    expect(unclaimed).toHaveLength(1);
    expect(unclaimed[0]?.id).toBe(charB.id);
  });

  it("creates, updates, places, and deletes NPCs", () => {
    const state = createEmptyRoomState();
    const tokenService = new TokenService();

    const npc = service.createCharacter(state, "Goblin", 12, undefined, "npc", {
      hp: 8,
      tokenImage: "https://img",
    });

    expect(npc.type).toBe("npc");
    expect(npc.hp).toBe(8);
    expect(npc.tokenImage).toBe("https://img");

    // Update NPC details
    const updated = service.updateNPC(state, tokenService, npc.id, {
      name: "Goblin Chief",
      hp: 10,
      maxHp: 15,
      portrait: "portrait-url",
      tokenImage: "https://img/new",
    });
    expect(updated).toBe(true);
    const storedNPC = service.findCharacter(state, npc.id)!;
    expect(storedNPC.name).toBe("Goblin Chief");
    expect(storedNPC.hp).toBe(10);
    expect(storedNPC.maxHp).toBe(15);
    expect(storedNPC.portrait).toBe("portrait-url");
    expect(storedNPC.tokenImage).toBe("https://img/new");

    // Place token on map
    service.placeNPCToken(state, tokenService, npc.id, "dm-uid");
    expect(storedNPC.tokenId).toBeDefined();
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0]?.imageUrl).toBe("https://img/new");

    // Delete character and ensure token removed
    const removed = service.deleteCharacter(state, npc.id);
    expect(removed?.id).toBe(npc.id);
    if (removed?.tokenId) {
      tokenService.forceDeleteToken(state, removed.tokenId);
    }
    expect(state.characters.find((c) => c.id === npc.id)).toBeUndefined();
  });
});
