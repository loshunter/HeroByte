import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterService } from "../character/service.ts";
import { createEmptyRoomState } from "../room/model.ts";

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
});
