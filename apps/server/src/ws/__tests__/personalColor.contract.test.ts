/**
 * Personal colour (slice C1): no two players share a colour. Driven through the
 * real router and real services. A player's chosen colour inside another
 * player's zone is SNAPPED to the nearest free colour and only the sender is
 * told; the DM is exempt both ways; NPCs never count; a player's own characters
 * may share; existing colours are kept until they change; and every PC record
 * carries its colour on the wire even when fog drops the token.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  colorToOkLab,
  deltaE,
  ruleRadius,
  windowColorAt,
  type CompiledScene,
} from "@herobyte/shared";
import { CharacterService } from "../../domains/character/service.js";
import { TokenService } from "../../domains/token/service.js";
import { toSnapshot } from "../../domains/room/model.js";
import { createRouterHarness, flush, messagesOf, type RouterHarness } from "./routerHarness.js";

const DM = "dm-1";
const ANN = "ann";
const BO = "bo";

const distance = (first: string, second: string) =>
  deltaE(colorToOkLab(first)!, colorToOkLab(second)!);

describe("personal colours — the server is the authority", () => {
  let harness: RouterHarness;
  const characters = new CharacterService();
  const tokens = new TokenService();
  const state = () => harness.roomService.getState();

  /** A PC for `uid`, linked to a fresh token, as a join provisions one. */
  const seat = (uid: string, name: string) => {
    const character = characters.createCharacter(state(), name, 10, undefined, "pc");
    characters.claimCharacter(state(), character.id, uid);
    const token = tokens.createToken(state(), uid, 0, 0);
    characters.linkToken(state(), character.id, token.id);
    return token;
  };
  const notices = (uid: string) => messagesOf(harness.sockets[uid]!, "color-adjusted");

  beforeEach(() => {
    harness = createRouterHarness("personalColor-state.json", [
      { uid: DM, isDM: true },
      { uid: ANN, isDM: false },
      { uid: BO, isDM: false },
    ]);
    state().characters = [];
  });

  it("gives each new player's token a colour well away from everyone else's", () => {
    const placed = ["p1", "p2", "p3", "p4"].map((uid) => seat(uid, uid).color);
    for (const color of placed) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(distance(placed[i]!, placed[j]!)).toBeGreaterThanOrEqual(ruleRadius(4));
      }
    }
  });

  it("snaps a choice inside another player's zone, saves it, and tells only the sender", async () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    const annColor = ann.color;
    const save = vi.spyOn(harness.roomService, "saveState");

    harness.route({ t: "set-token-color", tokenId: bo.id, color: annColor }, BO);
    await flush();

    expect(bo.color).not.toBe(annColor);
    expect(distance(bo.color, annColor)).toBeGreaterThanOrEqual(ruleRadius(2));
    expect(ann.color).toBe(annColor);
    expect(notices(BO)).toEqual([
      { t: "color-adjusted", tokenId: bo.id, color: bo.color, near: "Annika" },
    ]);
    expect(notices(ANN)).toEqual([]);
    expect(save).toHaveBeenCalled();
  });

  it("keeps an allowed choice exactly, normalised, with no notice", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    const far = windowColorAt({ u: 0, v: 0.5 }).hex;
    const free =
      distance(far, ann.color) >= ruleRadius(2) ? far : windowColorAt({ u: 0.5, v: 0.5 }).hex;

    harness.route({ t: "set-token-color", tokenId: bo.id, color: free.toUpperCase() }, BO);

    expect(bo.color).toBe(free);
    expect(notices(BO)).toEqual([]);
  });

  it("lets a player's own characters share a colour", () => {
    seat(BO, "Bors");
    const first = seat(ANN, "Annika");
    const second = seat(ANN, "Annika's twin");

    harness.route({ t: "set-token-color", tokenId: second.id, color: first.color }, ANN);

    expect(second.color).toBe(first.color);
    expect(notices(ANN)).toEqual([]);
  });

  it("exempts the DM both ways: never checked, and blocks no one", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    const dmToken = seat(DM, "The DM's hero");

    harness.route({ t: "set-token-color", tokenId: dmToken.id, color: ann.color }, DM);
    expect(dmToken.color).toBe(ann.color);

    harness.route({ t: "set-token-color", tokenId: bo.id, color: ann.color }, DM);
    expect(bo.color).toBe(ann.color);

    const dmOnly = windowColorAt({ u: 0.25, v: 0.3 }).hex;
    harness.route({ t: "set-token-color", tokenId: dmToken.id, color: dmOnly }, DM);
    const choice =
      distance(dmOnly, ann.color) >= ruleRadius(2)
        ? dmOnly
        : windowColorAt({ u: 0.75, v: 0.3 }).hex;
    harness.route({ t: "set-token-color", tokenId: dmToken.id, color: choice }, DM);
    harness.route({ t: "set-token-color", tokenId: bo.id, color: choice }, BO);
    expect(bo.color).toBe(choice);
    expect(notices(DM)).toEqual([]);
    expect(notices(BO)).toEqual([]);
  });

  it("never counts NPC tokens", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    const goblin = characters.createCharacter(state(), "Goblin", 7, undefined, "npc");
    const npcToken = tokens.createToken(state(), DM, 3, 3);
    characters.linkToken(state(), goblin.id, npcToken.id);
    const npcColor =
      distance(windowColorAt({ u: 0.4, v: 0.6 }).hex, ann.color) >= ruleRadius(2)
        ? windowColorAt({ u: 0.4, v: 0.6 }).hex
        : windowColorAt({ u: 0.9, v: 0.6 }).hex;
    tokens.setColorForToken(state(), npcToken.id, npcColor);

    harness.route({ t: "set-token-color", tokenId: bo.id, color: npcColor }, BO);

    expect(bo.color).toBe(npcColor);
  });

  it("recolours to an allowed colour away from the current one, and saves it", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    const save = vi.spyOn(harness.roomService, "saveState");
    for (let press = 0; press < 10; press += 1) {
      const before = bo.color;
      harness.route({ t: "recolor", id: bo.id }, BO);
      expect(bo.color).not.toBe(before);
      expect(distance(bo.color, ann.color)).toBeGreaterThanOrEqual(ruleRadius(2));
    }
    expect(save).toHaveBeenCalled();
  });

  it("reads a character file's legacy hsl colour, snapping it out of another's zone", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    ann.color = "hsl(200, 70%, 50%)";

    harness.route({ t: "set-token-color", tokenId: bo.id, color: "hsl(201, 70%, 50%)" }, BO);

    expect(bo.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(distance(bo.color, ann.color)).toBeGreaterThanOrEqual(ruleRadius(2));
    expect(notices(BO)[0]).toMatchObject({ near: "Annika" });
  });

  it("reassigns a player's unreadable colour, and ignores the DM's", () => {
    const bo = seat(BO, "Bors");
    const dmToken = seat(DM, "The DM's hero");
    const dmBefore = dmToken.color;

    harness.route({ t: "set-token-color", tokenId: bo.id, color: "chartreuse-ish" }, BO);
    harness.route({ t: "set-token-color", tokenId: dmToken.id, color: "chartreuse-ish" }, DM);

    expect(bo.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(notices(BO)).toHaveLength(1);
    expect(notices(BO)[0]).not.toHaveProperty("near");
    expect(dmToken.color).toBe(dmBefore);
  });

  it("never moves a placed colour when someone joins", () => {
    const ann = seat(ANN, "Annika");
    ann.color = "hsl(120, 70%, 50%)";
    seat(BO, "Bors");
    seat("cy", "Cyra");
    expect(ann.color).toBe("hsl(120, 70%, 50%)");
  });

  it("refuses a colour change on someone else's token", () => {
    const ann = seat(ANN, "Annika");
    const before = ann.color;
    harness.route({ t: "set-token-color", tokenId: ann.id, color: "#00ff00" }, BO);
    expect(ann.color).toBe(before);
  });

  it("puts every PC's colour on its record, even when fog drops the token", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    ann.x = 1;
    ann.y = 1;
    bo.x = 20;
    bo.y = 1;
    state().fogEnabled = true;
    state().compiledScene = sceneSplitByWallAt(500);

    const annView = toSnapshot(state(), false, ANN);

    expect(annView.tokens.map((token) => token.id)).not.toContain(bo.id);
    const bors = annView.characters.find((character) => character.name === "Bors");
    expect(bors?.color).toBe(bo.color);
  });
});

function sceneSplitByWallAt(x: number): CompiledScene {
  return {
    schemaVersion: 1,
    sourceDocumentId: "map",
    sourceRevision: 1,
    compiledAt: 1,
    width: 2048,
    height: 2048,
    walls: [
      { id: "wall#0", x1: x, y1: 0, x2: x, y2: 2048, blocksMovement: true, blocksVision: true },
    ],
    doors: [],
    lights: [],
  };
}
