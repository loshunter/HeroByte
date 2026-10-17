// A character file carries its token's frame (C5a): saved as it is, read back
// through the files' door (an unknown generator or palette becomes plain grey
// stone in that band, never an error), null for a frameless token.

import { describe, expect, it, vi } from "vitest";
import {
  defaultTokenFrame,
  pinFrameSeeds,
  presetFrame,
  type Player,
  type Token,
} from "@herobyte/shared";
import { loadPlayerState, savePlayerState } from "../playerPersistence";

const player = { uid: "uid-1", name: "Aria", hp: 30, maxHp: 40 } as Player;
const token = (frame?: Token["frame"]): Token => ({
  id: "t1",
  owner: "uid-1",
  x: 2,
  y: 3,
  color: "#390076",
  ...(frame ? { frame } : {}),
});

/** The JSON savePlayerState would have downloaded. */
function saved(forToken: Token): string {
  let captured = "";
  const blob = vi.spyOn(globalThis, "Blob").mockImplementation(((parts: BlobPart[]) => {
    captured = String(parts[0]);
    return {} as Blob;
  }) as never);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  URL.createObjectURL = (() => "blob:stub") as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
  try {
    savePlayerState({ player, token: forToken });
  } finally {
    blob.mockRestore();
    click.mockRestore();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  }
  return captured;
}
const load = (json: string) => loadPlayerState({ text: async () => json } as unknown as File);

describe("a character file's frame", () => {
  it("round-trips, its stones' seeds pinned from the token it was saved from", async () => {
    const frame = { ...presetFrame("metal.welded", 0.24)!, growth: "out" as const };
    const loaded = await load(saved(token(frame)));
    expect(loaded.token?.frame).toEqual(pinFrameSeeds(frame, "t1"));
    // the welded plate band is seeded; its plain rims draw nothing from a seed
    expect(loaded.token!.frame!.bands.map((band) => band.seed === undefined)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("saves a frameless token as null, which loads as null (the ring comes off)", async () => {
    const json = saved(token());
    expect(JSON.parse(json).token.frame).toBeNull();
    expect((await load(json)).token?.frame).toBeNull();
  });

  it("loads a newer build's frame with plain grey stone where it cannot draw, no error", async () => {
    const file = JSON.parse(saved(token(defaultTokenFrame())));
    file.token.frame = {
      preset: "nature.ivy",
      bands: [{ generator: "foliage", palette: "leaf.green", weight: 0.1, depth: 0.8 }],
    };
    const loaded = await load(JSON.stringify(file));
    expect(loaded.token?.frame?.bands[0]).toMatchObject({
      generator: "plain",
      palette: "stone.grey",
    });
    expect(loaded.token?.frame).not.toHaveProperty("preset");
  });

  it("leaves the frame alone for a file from before frames, or with junk in its place", async () => {
    const file = JSON.parse(saved(token(defaultTokenFrame())));
    delete file.token.frame;
    expect((await load(JSON.stringify(file))).token).not.toHaveProperty("frame");
    file.token.frame = "gold";
    expect((await load(JSON.stringify(file))).token).not.toHaveProperty("frame");
  });
});
