/**
 * Token frames (slice C5a): the server is the authority for what a frame may
 * be. Driven through the real validator and the real router: the owner or the
 * DM sets a token's frame and everyone receives the clean, clamped copy; a
 * crafted frame the catalog does not allow is refused before it reaches the
 * room; every token created from now on wears a plain ring in its own colour,
 * and a token from before frames keeps drawing as it did.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  bandSeed,
  defaultTokenFrame,
  frameSeed,
  pinFrameSeeds,
  presetFrame,
  withFrameWeight,
  type RoomSnapshot,
  type TokenFrame,
} from "@herobyte/shared";
import { TokenService } from "../../domains/token/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { validateMessage } from "../../middleware/validation.js";
import { createRouterHarness, flush, latestSnapshot, type RouterHarness } from "./routerHarness.js";

const DM = "dm-1";
const ANN = "ann";
const BO = "bo";

describe("token frames — the server is the authority", () => {
  let harness: RouterHarness;
  const tokens = new TokenService(() => 0.5);
  const state = () => harness.roomService.getState();
  const tokenIn = (snapshot: RoomSnapshot | undefined, id: string) =>
    snapshot?.tokens.find((token) => token.id === id);

  beforeEach(() => {
    harness = createRouterHarness("tokenFrame-state.json", [
      { uid: DM, isDM: true },
      { uid: ANN, isDM: false },
      { uid: BO, isDM: false },
    ]);
  });

  it("broadcasts the owner's frame to everyone, on the token and its scene object", async () => {
    const ann = tokens.createToken(state(), ANN, 0, 0);
    const slab = { ...withFrameWeight(presetFrame("metal.welded")!, 0.24), growth: "out" as const };
    harness.route({ t: "set-token-frame", tokenId: ann.id, frame: slab }, ANN);
    await flush();
    const seen = tokenIn(latestSnapshot(harness.sockets[BO]!), ann.id);
    expect(seen?.frame).toEqual(slab);
    const scene = latestSnapshot(harness.sockets[BO]!)?.sceneObjects?.find(
      (object) => object.id === `token:${ann.id}`,
    );
    // Sent once, on the token: the client puts it back on the scene object.
    expect(scene?.type === "token" && "frame" in scene.data).toBe(false);
  });

  it("refuses a frame on someone else's token, and lets the DM frame any", async () => {
    const ann = tokens.createToken(state(), ANN, 0, 0);
    const castle = presetFrame("stone.castle")!;
    harness.route({ t: "set-token-frame", tokenId: ann.id, frame: castle }, BO);
    await flush();
    expect(state().tokens.find((token) => token.id === ann.id)?.frame).toEqual(defaultTokenFrame());
    harness.route({ t: "set-token-frame", tokenId: ann.id, frame: castle }, DM);
    await flush();
    expect(state().tokens.find((token) => token.id === ann.id)?.frame).toEqual(castle);
  });

  it("clears a frame with null: the token draws as before frames", async () => {
    const ann = tokens.createToken(state(), ANN, 0, 0);
    harness.route({ t: "set-token-frame", tokenId: ann.id, frame: null }, ANN);
    await flush();
    expect(state().tokens.find((token) => token.id === ann.id)).not.toHaveProperty("frame");
    expect(tokenIn(latestSnapshot(harness.sockets[ANN]!), ann.id)).not.toHaveProperty("frame");
  });

  it("stores the clamped copy, never the client's object", async () => {
    const ann = tokens.createToken(state(), ANN, 0, 0);
    const sent = {
      ...presetFrame("stone.castle")!,
      extra: "ignored",
      bands: [{ ...presetFrame("stone.castle")!.bands[0]!, depth: 9, params: { gap: 5 } }],
    } as unknown as TokenFrame;
    expect(validateMessage({ t: "set-token-frame", tokenId: ann.id, frame: sent }).valid).toBe(
      true,
    );
    harness.route({ t: "set-token-frame", tokenId: ann.id, frame: sent }, ANN);
    await flush();
    const stored = state().tokens.find((token) => token.id === ann.id)!.frame!;
    expect(stored).not.toHaveProperty("extra");
    expect(stored.bands[0]!.depth).toBe(1);
    expect(stored.bands[0]!.params!.gap).toBe(0.2);
  });

  it("refuses crafted frames at the door, with the reason", () => {
    const band = presetFrame("plain.ring")!.bands[0]!;
    const refused = (frame: unknown) =>
      validateMessage({ t: "set-token-frame", tokenId: "t", frame });
    expect(refused({ ...presetFrame("plain.ring"), shape: "triangle" })).toEqual({
      valid: false,
      error:
        "set-token-frame: frame shape must be one of circle, squircle, square, hexagon, octagon, shield",
    });
    expect(refused({ ...presetFrame("plain.ring"), shape: "hexagon" }).valid).toBe(true);
    expect(
      refused({ bands: Array.from({ length: 7 }, () => ({ ...band, weight: 0.02 })) }).error,
    ).toBe("set-token-frame: frame has more than 6 bands");
    expect(refused({ bands: [{ ...band, weight: 0.5 }] }).error).toBe(
      "set-token-frame: frame weight must be 0.04–0.34",
    );
    expect(refused({ bands: [{ ...band, palette: "metal.mithril" }] }).error).toBe(
      "set-token-frame: frame band palette is unknown",
    );
    expect(refused({ ...presetFrame("plain.ring"), finish: "rainbow" }).error).toBe(
      "set-token-frame: frame finishes are not available",
    );
    expect(validateMessage({ t: "set-token-frame", frame: null }).error).toBe(
      "set-token-frame: tokenId required",
    );
    expect(validateMessage({ t: "set-token-frame", tokenId: "t", frame: null }).valid).toBe(true);
    expect(refused({ bands: [{ ...band, palette: "constructor" }] }).error).toBe(
      "set-token-frame: frame band palette is unknown",
    );
    expect(refused({ bands: [{ ...band, weight: 1e-4 }, band] }).error).toBe(
      "set-token-frame: frame band weight must be at least 0.005",
    );
  });
});

describe("frame writes are budgeted", () => {
  it("drops a seventh rapid write from one player, each costing every client a bake", async () => {
    const harness = createRouterHarness("tokenFrame-budget-state.json", [
      { uid: ANN, isDM: false },
    ]);
    const ann = new TokenService(() => 0.5).createToken(harness.roomService.getState(), ANN, 0, 0);
    for (let write = 0; write < 7; write += 1) {
      const frame = {
        ...presetFrame("stone.castle")!,
        bands: [{ ...presetFrame("stone.castle")!.bands[0]!, seed: write }],
      };
      harness.route({ t: "set-token-frame", tokenId: ann.id, frame }, ANN);
    }
    await flush();
    const stored = harness.roomService.getState().tokens.find((token) => token.id === ann.id)!;
    expect(stored.frame!.bands[0]!.seed).toBe(5);
  });
});

describe("new tokens wear the default ring", () => {
  let harness: RouterHarness;
  const state = () => harness.roomService.getState();

  beforeEach(() => {
    harness = createRouterHarness("tokenFrame-new-state.json", [
      { uid: DM, isDM: true },
      { uid: ANN, isDM: false },
    ]);
  });

  it("from createToken, which every creation road goes through", () => {
    const token = new TokenService(() => 0.5).createToken(state(), ANN, 1, 1);
    expect(token.frame).toEqual(defaultTokenFrame());
    expect(token.frame?.accent).toBe("personal");
  });

  it("from add-player-character and from placing an NPC", async () => {
    harness.route({ t: "add-player-character", name: "Second" }, ANN);
    await flush();
    const second = state().characters.find((character) => character.name === "Second")!;
    expect(state().tokens.find((token) => token.id === second.tokenId)?.frame).toEqual(
      defaultTokenFrame(),
    );
    const npc = new CharacterService().createCharacter(state(), "Goblin", 7, undefined, "npc");
    harness.route({ t: "place-npc-token", id: npc.id }, DM);
    await flush();
    const placed = state().characters.find((character) => character.id === npc.id)!;
    expect(state().tokens.find((token) => token.id === placed.tokenId)?.frame).toEqual(
      defaultTokenFrame(),
    );
  });

  it("keeps an NPC's frame when its old token is parked on another map, and no frame stays none", async () => {
    const npc = new CharacterService().createCharacter(state(), "Wraith", 9, undefined, "npc");
    harness.route({ t: "place-npc-token", id: npc.id }, DM);
    await flush();
    const first = state().characters.find((character) => character.id === npc.id)!.tokenId!;
    const castle = presetFrame("stone.castle")!;
    // its token sleeps on another map, wearing a castle ring
    const old = state().tokens.find((token) => token.id === first)!;
    state().tokens = state().tokens.filter((token) => token.id !== first);
    state().sceneStates = { "doc-x": { tokens: [{ ...old, frame: castle }] } } as never;
    harness.route({ t: "place-npc-token", id: npc.id }, DM);
    await flush();
    const second = state().characters.find((character) => character.id === npc.id)!.tokenId!;
    expect(state().tokens.find((token) => token.id === second)?.frame).toEqual(
      pinFrameSeeds(castle, first),
    );
    // the DM takes the frame off; placed again, it stays off (not the default ring)
    harness.route({ t: "set-token-frame", tokenId: second, frame: null }, DM);
    harness.route({ t: "place-npc-token", id: npc.id }, DM);
    await flush();
    const third = state().characters.find((character) => character.id === npc.id)!.tokenId!;
    expect(third).not.toBe(second);
    expect(state().tokens.find((token) => token.id === third)).not.toHaveProperty("frame");
  });

  it("keeps the frame the DM gave an NPC when it is placed again", async () => {
    const npc = new CharacterService().createCharacter(state(), "Ogre", 30, undefined, "npc");
    harness.route({ t: "place-npc-token", id: npc.id }, DM);
    await flush();
    const first = state().characters.find((character) => character.id === npc.id)!.tokenId!;
    const castle = presetFrame("stone.castle")!;
    harness.route({ t: "set-token-frame", tokenId: first, frame: castle }, DM);
    harness.route({ t: "place-npc-token", id: npc.id }, DM);
    await flush();
    const second = state().characters.find((character) => character.id === npc.id)!.tokenId!;
    expect(second).not.toBe(first);
    // the same frame, its stones pinned from the old token so they do not re-roll
    expect(state().tokens.find((token) => token.id === second)?.frame).toEqual(
      pinFrameSeeds(castle, first),
    );
    expect(state().tokens.find((token) => token.id === second)!.frame!.bands[0]!.seed).toBe(
      bandSeed(castle, 0, frameSeed(first)),
    );
  });
});
