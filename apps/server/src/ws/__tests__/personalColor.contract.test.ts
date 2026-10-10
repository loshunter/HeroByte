/**
 * Personal colour (slice C1): no two players share a colour. Driven through the
 * real router and real services. A player's chosen colour inside another
 * player's zone is SNAPPED to the nearest free colour and only the sender is
 * told; the DM is exempt both ways; NPCs never count; a player's own characters
 * may share; existing colours are kept until they change; and every PC record
 * carries its colour on the wire even when fog drops the token.
 */

import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  colorToOkLab,
  contrastRatio,
  createSeededRng,
  deltaE,
  farthestColor,
  nearestAllowedColor,
  normalizeColor,
  parseColor,
  readableColor,
  ruleRadius,
  windowCells,
  windowColorAt,
  type CompiledScene,
  type SceneState,
} from "@herobyte/shared";
import { CharacterService } from "../../domains/character/service.js";
import { TokenService } from "../../domains/token/service.js";
import { RoomService } from "../../domains/room/service.js";
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
  // Seeded, so the colours a test seats are the same on every run.
  let tokens = new TokenService(createSeededRng(1));
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
    tokens = new TokenService(createSeededRng(1));
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

  it("snaps a choice inside another player's zone and tells only the sender", async () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    const annColor = ann.color;

    harness.route({ t: "set-token-color", tokenId: bo.id, color: annColor }, BO);
    await flush();

    expect(bo.color).not.toBe(annColor);
    expect(distance(bo.color, annColor)).toBeGreaterThanOrEqual(ruleRadius(2));
    // The NEAREST free colour: just outside the zone, not anywhere allowed.
    expect(bo.color).toBe(
      nearestAllowedColor(annColor, [{ lab: colorToOkLab(annColor)! }], ruleRadius(2)),
    );
    expect(ann.color).toBe(annColor);
    expect(notices(BO)).toEqual([
      { t: "color-adjusted", tokenId: bo.id, color: bo.color, near: "Annika", name: "Bors" },
    ]);
    expect(notices(ANN)).toEqual([]);
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

  it("lets a player's own characters share a colour (the rule runs, and lets it)", () => {
    seat(BO, "Bors");
    const first = seat(ANN, "Annika");
    const second = seat(ANN, "Annika's twin");
    // Not the colour it already has (that would skip the rule): a far colour first,
    // then a request right next to the sibling's, inside its zone.
    second.color = farthestColor([{ lab: colorToOkLab(first.color)! }]);
    const besideSibling = nearbyColor(first.color);
    expect(besideSibling).not.toBe(first.color);
    expect(distance(besideSibling, first.color)).toBeLessThan(ruleRadius(2));

    harness.route({ t: "set-token-color", tokenId: second.id, color: besideSibling }, ANN);

    expect(second.color).toBe(besideSibling);
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

  it("never counts NPC tokens, even one a player holds", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    // A claimed NPC: its token belongs to a player, so only the NPC rule keeps it out.
    const goblin = characters.createCharacter(state(), "Goblin", 7, undefined, "npc");
    goblin.ownedByPlayerUID = "cy";
    const npcToken = tokens.createToken(state(), "cy", 3, 3, undefined, "medium", "npc");
    characters.linkToken(state(), goblin.id, npcToken.id);
    // Free of Annika's zone, so only the goblin could stand in Bors's way.
    const npcColor = farthestColor([{ lab: colorToOkLab(ann.color)! }]);
    tokens.setColorForToken(state(), npcToken.id, npcColor);

    harness.route({ t: "set-token-color", tokenId: bo.id, color: npcColor }, BO);

    expect(bo.color).toBe(npcColor);
    expect(notices(BO)).toEqual([]);
  });

  it("gives an NPC token a readable random colour, not the spot the next player would get", () => {
    seat(ANN, "Annika");
    const goblin = characters.createCharacter(state(), "Goblin", 7, undefined, "npc");
    const expected = readableColor(createSeededRng(99));
    characters.placeNPCToken(state(), new TokenService(createSeededRng(99)), goblin.id, DM);
    expect(state().tokens.find((token) => token.id === goblin.tokenId)?.color).toBe(expected);
  });

  it("starts a player's second character in that player's colour", () => {
    const ann = seat(ANN, "Annika");
    harness.route({ t: "add-player-character", name: "Second" }, ANN);
    const second = state().characters.find((character) => character.name === "Second")!;
    expect(state().tokens.find((token) => token.id === second.tokenId)?.color).toBe(ann.color);
  });

  it("keeps a colour sent again unchanged, even one close to another player's", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    ann.color = "hsl(200, 70%, 50%)";
    bo.color = "hsl(206, 70%, 50%)";
    expect(distance(ann.color, bo.color)).toBeLessThan(ruleRadius(2));

    harness.route({ t: "set-token-color", tokenId: bo.id, color: "hsl(206, 70%, 50%)" }, BO);

    expect(bo.color).toBe("hsl(206, 70%, 50%)");
    expect(notices(BO)).toEqual([]);
  });

  it("neither names nor makes room for a PC hidden from players", () => {
    const bo = seat(BO, "Bors");
    const mole = seat("ghost", "Mole");
    state().characters.find((character) => character.name === "Mole")!.visibleToPlayers = false;

    harness.route({ t: "set-token-color", tokenId: bo.id, color: mole.color }, BO);

    expect(bo.color).toBe(normalizeColor(mole.color));
    expect(notices(BO)).toEqual([]);
  });

  it("does not let a PC with no owner hold a zone", () => {
    const bo = seat(BO, "Bors");
    const orphan = seat("lost", "Orphan");
    state().characters.find((character) => character.name === "Orphan")!.ownedByPlayerUID =
      undefined;

    harness.route({ t: "set-token-color", tokenId: bo.id, color: orphan.color }, BO);

    expect(bo.color).toBe(normalizeColor(orphan.color));
  });

  it("keeps the zone and the wire colour of a PC whose token waits with another map", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    state().tokens = state().tokens.filter((token) => token.id !== ann.id);
    state().sceneStates = {
      elsewhere: { mapDocumentId: "m2", suspendedAt: 1, tokens: [ann] } as unknown as SceneState,
    };

    harness.route({ t: "set-token-color", tokenId: bo.id, color: ann.color }, BO);

    expect(distance(bo.color, ann.color)).toBeGreaterThanOrEqual(ruleRadius(2));
    expect(notices(BO)[0]).toMatchObject({ near: "Annika" });
    const annika = toSnapshot(state(), false, BO).characters.find((c) => c.name === "Annika");
    expect(annika?.color).toBe(ann.color);
  });

  it("lets one player make a burst of 10 colour writes, then tells them to wait", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const bo = seat(BO, "Bors");
      let changes = 0;
      for (let press = 0; press < 15; press += 1) {
        const before = bo.color;
        harness.route({ t: "recolor", id: bo.id }, BO);
        if (bo.color !== before) changes += 1;
      }
      expect(changes).toBe(10);
      // Picks share the same budget, and a dropped one is told, not silently acked.
      const pick = windowColorAt({ u: 0.37, v: 0.42 }).hex;
      const toldBefore = notices(BO).length;
      harness.route({ t: "set-token-color", tokenId: bo.id, color: pick }, BO);
      expect(bo.color).not.toBe(pick);
      expect(notices(BO)).toHaveLength(toldBefore + 1);
      expect(notices(BO).at(-1)).toEqual({ t: "color-adjusted", tokenId: bo.id, throttled: true });
      vi.setSystemTime(Date.now() + 1000);
      harness.route({ t: "set-token-color", tokenId: bo.id, color: pick }, BO);
      expect(bo.color).toBe(pick);
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers a throttled write only for the sender's own token, so it reveals no other", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const ann = seat(ANN, "Annika");
      const bo = seat(BO, "Bors");
      // A hidden NPC the DM placed: whether it exists, and its colour, are the DM's.
      const lurker = characters.createCharacter(state(), "Lurker", 30, undefined, "npc");
      lurker.visibleToPlayers = false;
      const lurkerToken = tokens.createToken(state(), DM, 9, 9, undefined, "medium", "npc");
      characters.linkToken(state(), lurker.id, lurkerToken.id);
      for (let press = 0; press < 10; press += 1) harness.route({ t: "recolor", id: bo.id }, BO);
      const toldBefore = notices(BO).length;

      const pick = windowColorAt({ u: 0.37, v: 0.42 }).hex;
      for (const tokenId of [lurkerToken.id, ann.id, "no-such-token"]) {
        harness.route({ t: "set-token-color", tokenId, color: pick }, BO);
        harness.route({ t: "recolor", id: tokenId }, BO);
      }
      expect(notices(BO)).toHaveLength(toldBefore);

      // Still over budget: the sender's own token is answered, with the colour it keeps.
      harness.route({ t: "set-token-color", tokenId: bo.id, color: pick }, BO);
      expect(notices(BO).slice(toldBefore)).toEqual([
        { t: "color-adjusted", tokenId: bo.id, throttled: true },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a player's token out of other zones when the DM recolours it", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let press = 0; press < 30; press += 1) {
        if (press % 10 === 0) vi.setSystemTime(Date.now() + 5000);
        harness.route({ t: "recolor", id: bo.id }, DM);
        expect(distance(bo.color, ann.color)).toBeGreaterThanOrEqual(ruleRadius(2));
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a PC's colour out of other zones when the DM holds its token (a DM's link or a restored file)", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    bo.owner = DM;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let press = 0; press < 30; press += 1) {
        if (press % 10 === 0) vi.setSystemTime(Date.now() + 5000);
        harness.route({ t: "recolor", id: bo.id }, DM);
        expect(distance(bo.color, ann.color)).toBeGreaterThanOrEqual(ruleRadius(2));
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers the DM's over-budget write for any token, and with no colour in it", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const ann = seat(ANN, "Annika");
      for (let press = 0; press < 10; press += 1) harness.route({ t: "recolor", id: ann.id }, DM);
      const toldBefore = notices(DM).length;
      harness.route({ t: "recolor", id: ann.id }, DM);
      expect(notices(DM).slice(toldBefore)).toEqual([
        { t: "color-adjusted", tokenId: ann.id, throttled: true },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("judges a token by its PC's player, so a token held by another player never blocks itself", () => {
    const bors = seat(BO, "Bors");
    seat(ANN, "Annika");
    // Bo's token, linked to Annika's PC (a DM's link): the colour is Annika's. It starts
    // in Bo's colour (his further characters inherit it), so it is moved far away first.
    const held = tokens.createToken(state(), BO, 5, 5);
    held.color = farthestColor([{ lab: colorToOkLab(bors.color)! }]);
    const annika = state().characters.find((character) => character.name === "Annika")!;
    characters.linkToken(state(), annika.id, held.id);
    const beside = nearbyColor(held.color);
    expect(distance(beside, held.color)).toBeLessThan(ruleRadius(2));

    harness.route({ t: "set-token-color", tokenId: held.id, color: beside }, BO);

    expect(held.color).toBe(beside);
    expect(notices(BO)).toEqual([]);
  });

  it("gives NPCs, and the DM's own recolours, colours that read on a dark map", () => {
    const floor = parseColor("#2a2622")!;
    const readable = (color: string) => contrastRatio(parseColor(color)!, floor) >= 3;
    for (let seed = 1; seed <= 40; seed += 1) {
      const npc = new TokenService(createSeededRng(seed)).createToken(
        state(),
        DM,
        1,
        1,
        undefined,
        "medium",
        "npc",
      );
      expect(readable(npc.color)).toBe(true);
    }
    const king = tokens.createToken(state(), DM, 2, 2, undefined, "medium", "npc");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let press = 0; press < 30; press += 1) {
        if (press % 10 === 0) vi.setSystemTime(Date.now() + 5000);
        const before = king.color;
        harness.route({ t: "recolor", id: king.id }, DM);
        expect(king.color).not.toBe(before);
        expect(readable(king.color)).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("never names the sender's own PC in a notice when that PC is hidden", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    state().characters.find((character) => character.name === "Bors")!.visibleToPlayers = false;

    harness.route({ t: "set-token-color", tokenId: bo.id, color: ann.color }, BO);

    expect(notices(BO)).toHaveLength(1);
    expect(notices(BO)[0]).toMatchObject({ near: "Annika" });
    expect(notices(BO)[0]).not.toHaveProperty("name");
  });

  it("never names a hidden NPC in a notice, even to the player whose token it is", () => {
    const ann = seat(ANN, "Annika");
    // An ex-DM: the NPC token they placed while DM is still theirs.
    const king = characters.createCharacter(state(), "Goblin King", 30, undefined, "npc");
    king.visibleToPlayers = false;
    const kingToken = tokens.createToken(state(), BO, 4, 4, undefined, "medium", "npc");
    characters.linkToken(state(), king.id, kingToken.id);

    harness.route({ t: "set-token-color", tokenId: kingToken.id, color: ann.color }, BO);

    expect(notices(BO)).toHaveLength(1);
    expect(notices(BO)[0]).toMatchObject({ near: "Annika" });
    expect(notices(BO)[0]).not.toHaveProperty("name");
  });

  it("never lets a non-string colour on a PC's token break a join or a recolour", () => {
    const ann = seat(ANN, "Annika");
    (ann as unknown as { color: unknown }).color = 7;
    const bo = seat(BO, "Bors");
    expect(bo.color).toMatch(/^#[0-9a-f]{6}$/);
    harness.route({ t: "recolor", id: bo.id }, BO);
    expect(bo.color).toMatch(/^#[0-9a-f]{6}$/);
    const annika = toSnapshot(state(), false, BO).characters.find((c) => c.name === "Annika");
    expect(annika).not.toHaveProperty("color");
  });

  it("keeps a chosen colour across a server restart", async () => {
    const bo = seat(BO, "Bors");
    const pick = windowColorAt({ u: 0.37, v: 0.42 }).hex;
    harness.route({ t: "set-token-color", tokenId: bo.id, color: pick }, BO);
    await flush();
    await harness.roomService.awaitPendingWrites();

    const restarted = new RoomService({
      stateFile: path.join(process.cwd(), ".tmp", "personalColor-state.json"),
    });
    restarted.loadState();

    expect(restarted.getState().tokens.find((token) => token.id === bo.id)?.color).toBe(pick);
  });

  it("restores a table backup's colours as saved, without the rule", () => {
    const shared = "#3fa7d6";
    harness.roomService.loadSnapshot(
      toSnapshotWith(state(), [
        { id: "pa", owner: "pa-owner", color: shared },
        { id: "pb", owner: "pb-owner", color: shared },
      ]),
    );
    const restored = harness.roomService.getState().tokens.filter((t) => t.color === shared);
    expect(restored.map((token) => token.id).sort()).toEqual(["pa", "pb"]);
  });

  it("recolours to an allowed colour away from the current one", () => {
    const ann = seat(ANN, "Annika");
    const bo = seat(BO, "Bors");
    for (let press = 0; press < 10; press += 1) {
      const before = bo.color;
      harness.route({ t: "recolor", id: bo.id }, BO);
      expect(bo.color).not.toBe(before);
      expect(distance(bo.color, ann.color)).toBeGreaterThanOrEqual(ruleRadius(2));
    }
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

/** A table backup holding just these PCs and their tokens (two players' colours may clash). */
function toSnapshotWith(
  state: ReturnType<RouterHarness["roomService"]["getState"]>,
  pcs: { id: string; owner: string; color: string }[],
) {
  const snapshot = toSnapshot(state, true);
  return {
    ...snapshot,
    tokens: pcs.map((pc) => ({ id: pc.id, owner: pc.owner, x: 0, y: 0, color: pc.color })),
    characters: pcs.map((pc) => ({
      id: `c-${pc.id}`,
      name: pc.id,
      type: "pc" as const,
      hp: 5,
      maxHp: 5,
      ownedByPlayerUID: pc.owner,
      tokenId: pc.id,
    })),
  };
}

/** A window colour right next to `color` (two cells over), inside its zone. */
function nearbyColor(color: string): string {
  const cells = windowCells();
  const here = cells.reduce((best, cell) =>
    deltaE(cell.lab, colorToOkLab(color)!) < deltaE(best.lab, colorToOkLab(color)!) ? cell : best,
  );
  const next = cells.find(
    (cell) => cell.row === here.row && cell.column === (here.column + 2) % 180,
  )!;
  return next.hex;
}
