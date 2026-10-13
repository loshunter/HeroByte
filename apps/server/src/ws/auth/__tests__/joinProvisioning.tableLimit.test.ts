// A new uid's join made a character without asking the table's 500: scripted joins on
// the public table could pass it, and the DM's backup would fail its own load check.

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../../../container.js";
import { PlayerService } from "../../../domains/player/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { RoomService } from "../../../domains/room/service.js";
import { provisionJoin } from "../joinProvisioning.js";

function setup() {
  const services = {
    playerService: new PlayerService(),
    characterService: new CharacterService(),
    tokenService: new TokenService(),
  };
  const room = new RoomService({
    stateFile: path.join(process.cwd(), ".tmp", "joinProvisioning-tableLimit-state.json"),
  });
  const state = room.getState();
  const join = (uid: string) => provisionJoin(services as Container, room, state, uid);
  const fill = (to: number) => {
    for (let n = state.characters.length; n < to; n += 1) {
      services.characterService.createCharacter(state, `Filler ${n}`, 1, "", "npc");
    }
  };
  return { ...services, state, join, fill };
}

describe("join provisioning and the table's character limit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("seats a new uid at a full table without a character, and makes one once there is room", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state, join, fill } = setup();
    fill(500);

    join("late");
    expect(state.players.some((player) => player.uid === "late")).toBe(true);
    expect(state.characters).toHaveLength(500);
    expect(state.tokens.some((token) => token.owner === "late")).toBe(false);

    state.characters.pop();
    join("late");
    expect(state.characters).toHaveLength(500);
    const pc = state.characters.find((c) => c.ownedByPlayerUID === "late");
    expect(pc?.type).toBe("pc");
    expect(state.tokens.find((token) => token.id === pc?.tokenId)?.owner).toBe("late");
  });

  it("still makes the 500th", () => {
    const { state, join, fill } = setup();
    fill(499);
    join("last-in");
    expect(state.characters).toHaveLength(500);
    expect(state.characters.at(-1)?.ownedByPlayerUID).toBe("last-in");
  });
});
