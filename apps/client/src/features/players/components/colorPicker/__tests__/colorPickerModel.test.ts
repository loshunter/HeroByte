import { describe, expect, it, vi } from "vitest";
import {
  COLOR_WINDOW,
  colorToOkLab,
  farthestColor,
  deltaE,
  ruleRadius,
  windowCells,
  windowColorAt,
  windowPointOf,
  type Player,
  type SnapshotCharacter,
  type Token,
} from "@herobyte/shared";
import {
  buildColorPickerControl,
  colorAdjustedMessage,
  colorPickerForRows,
} from "../colorPickerControl";
import {
  cellOf,
  pickerField,
  pickerFieldKey,
  placeHandle,
  zoneOwnerAt,
  pointAt,
  sameColor,
  stepPoint,
} from "../colorPickerModel";

const RED = windowColorAt({ u: 0.08, v: 0.5 }).hex;
const BLUE = windowColorAt({ u: 0.7, v: 0.5 }).hex;
const pc = (id: string, owner: string, color?: string): SnapshotCharacter =>
  ({
    id,
    name: id,
    type: "pc",
    ownedByPlayerUID: owner,
    tokenId: `t-${id}`,
    color,
  }) as SnapshotCharacter;
const players: Player[] = [
  { uid: "dm", name: "DM", isDM: true },
  { uid: "me", name: "Me" },
  { uid: "sam", name: "Sam" },
];
const myToken: Token = { id: "t-mine", owner: "me", x: 0, y: 0, color: BLUE };
const characters = [
  pc("mine", "me", BLUE),
  pc("twin", "me", BLUE),
  pc("bors", "sam", RED),
  pc("dmhero", "dm", RED),
];

const control = (viewerIsDM = false, send = vi.fn()) =>
  buildColorPickerControl({
    characters,
    players,
    token: myToken,
    characterId: "mine",
    ownerUid: "me",
    name: "Mine",
    viewerIsDM,
    onTokenColorChange: send,
  })!;

describe("buildColorPickerControl", () => {
  it("collects every PC colour and who is DM, and sends to the token", () => {
    const send = vi.fn();
    const built = control(false, send);
    expect(built.holders.map((holder) => holder.characterId)).toEqual([
      "mine",
      "twin",
      "bors",
      "dmhero",
    ]);
    expect(built.dmUids).toEqual(["dm"]);
    built.onCommit("#123456");
    expect(send).toHaveBeenCalledWith("t-mine", "#123456");
  });

  it("offers nothing without a token or without a way to send", () => {
    const base = {
      characters,
      players,
      characterId: "mine",
      ownerUid: "me",
      name: "Mine",
      viewerIsDM: false,
    };
    expect(
      buildColorPickerControl({ ...base, token: undefined, onTokenColorChange: vi.fn() }),
    ).toBeUndefined();
    expect(buildColorPickerControl({ ...base, token: myToken })).toBeUndefined();
  });

  it("skips NPCs and PCs whose colour did not arrive", () => {
    const npc = { ...pc("gob", "dm", RED), type: "npc" } as SnapshotCharacter;
    const built = buildColorPickerControl({
      characters: [npc, pc("blank", "sam")],
      players,
      token: myToken,
      characterId: "mine",
      ownerUid: "me",
      name: "Mine",
      viewerIsDM: false,
      onTokenColorChange: vi.fn(),
    })!;
    expect(built.holders).toEqual([]);
  });
});

describe("pickerField", () => {
  it("gives a player other players' zones, their own characters as dots, and three spots", () => {
    const field = pickerField(control());
    expect(field.others.map((other) => other.name)).toEqual(["bors"]);
    expect(field.ownDots.map((dot) => dot.characterId)).toEqual(["twin"]);
    expect(field.suggestions).toHaveLength(3);
    expect(field.zones.some((zone) => zone === 0)).toBe(true);
  });

  it("never suggests the spot the character already has (an automatic colour is the most open one)", () => {
    const others = pickerField(control()).others;
    const automatic = farthestColor(others);
    const field = pickerField({ ...control(), color: automatic });
    for (const spot of field.suggestions) {
      expect(deltaE(spot.lab, colorToOkLab(automatic)!)).toBeGreaterThan(ruleRadius(2));
    }
  });

  it("gives the DM no zones, no dots and no spots", () => {
    const field = pickerField(control(true));
    expect(field.others).toEqual([]);
    expect(field.ownDots).toEqual([]);
    expect(field.suggestions).toEqual([]);
    expect(field.zones.every((zone) => zone === -1)).toBe(true);
  });

  it("keys on what changes the field, not on array identity", () => {
    expect(pickerFieldKey(control())).toBe(pickerFieldKey(control()));
    const moved = {
      ...control(),
      holders: [{ ownerUid: "sam", characterId: "bors", color: BLUE }],
    };
    expect(pickerFieldKey(moved)).not.toBe(pickerFieldKey(control()));
    // A rename must reach an open picker's labels.
    const renamed = {
      ...control(),
      holders: control().holders.map((holder) => ({ ...holder, name: `${holder.name}!` })),
    };
    expect(pickerFieldKey(renamed)).not.toBe(pickerFieldKey(control()));
  });
});

describe("placeHandle", () => {
  const field = pickerField(control());

  it("bumps a point inside another player's zone to its edge, naming them", () => {
    const placed = placeHandle(windowPointOf(RED)!, field, false);
    expect(placed.blockedBy).toBe("bors");
    const room = deltaE(placed.cell.lab, colorToOkLab(RED)!);
    expect(room).toBeGreaterThanOrEqual(ruleRadius(2));
  });

  it("leaves a free point where it is, and never bumps the DM", () => {
    const free = windowPointOf(BLUE)!;
    expect(placeHandle(free, field, false).blockedBy).toBeUndefined();
    const dm = placeHandle(windowPointOf(RED)!, field, true);
    expect(dm.blockedBy).toBeUndefined();
    expect(dm.cell).toBe(cellOf(RED));
  });
});

describe("geometry helpers", () => {
  it("maps a pointer to the window, clamped", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(pointAt(rect, 110, 70)).toEqual({ u: 0.5, v: 0.5 });
    expect(pointAt(rect, -50, 500)).toEqual({ u: 0, v: 0.9999 });
    expect(pointAt({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ u: 0, v: 0 });
  });

  it("steps by cells: hue wraps, lightness stops at the edges", () => {
    const first = windowCells()[0]!;
    expect(stepPoint(first, -1, 0).u).toBeCloseTo(
      (COLOR_WINDOW.columns - 0.5) / COLOR_WINDOW.columns,
    );
    expect(stepPoint(first, 0, -1).v).toBeCloseTo(0.5 / COLOR_WINDOW.rows);
  });

  it("keeps a colour picked from the window in its own cell, whatever the rounding", () => {
    // Every cell: the ones rounding pushes over the line are scattered, not sampled.
    for (const cell of windowCells()) {
      // Near white, neighbouring cells can round to one hex: any of them is "its" cell.
      expect(cellOf(cell.hex)!.hex).toBe(cell.hex);
    }
  });

  it("finds a stored colour's cell, and compares colours as stored", () => {
    expect(cellOf("junk")).toBeNull();
    // BLUE is not a cell centre: its cell is the one a hair away.
    expect(deltaE(cellOf(BLUE)!.lab, colorToOkLab(BLUE)!)).toBeLessThan(0.01);
    expect(sameColor(BLUE.toUpperCase(), BLUE)).toBe(true);
    expect(sameColor("junk", "junk")).toBe(true);
    expect(sameColor(RED, BLUE)).toBe(false);
  });
});

describe("colorPickerForRows (the phone list)", () => {
  const forRows = (uid: string, isDM: boolean) =>
    colorPickerForRows({ characters, players, uid, isDM, onTokenColorChange: vi.fn() });

  it("gives a player a picker on their own rows only", () => {
    const rows = forRows("me", false);
    expect(rows({ uid: "me", characterId: "mine", name: "Mine" }, myToken)).toBeDefined();
    expect(rows({ uid: "sam", characterId: "bors", name: "bors" }, myToken)).toBeUndefined();
  });

  it("gives the DM a picker on every row, and nobody one on a characterless seat", () => {
    const rows = forRows("dm", true);
    expect(rows({ uid: "sam", characterId: "bors", name: "bors" }, myToken)?.exempt).toBe(true);
    expect(
      rows({ uid: "sam", characterId: "", name: "", hasCharacter: false }, myToken),
    ).toBeUndefined();
  });
});

describe("zoneOwnerAt", () => {
  it("names the character whose zone covers a point, and nobody on free ground", () => {
    const field = pickerField(control());
    expect(zoneOwnerAt(windowPointOf(RED)!, field)).toBe("bors");
    expect(zoneOwnerAt(windowPointOf(BLUE)!, field)).toBeNull();
  });
});

describe("colorAdjustedMessage", () => {
  it("says which character moved, whose zone it was in, or that it could not be read", () => {
    expect(colorAdjustedMessage("Bors", "Annika")).toBe(
      "Annika's colour was too close to Bors's, so it moved to the nearest free one.",
    );
    expect(colorAdjustedMessage("Bors")).toBe(
      "Your colour was too close to Bors's, so it moved to the nearest free one.",
    );
    expect(colorAdjustedMessage(undefined, "Annika")).toBe(
      "Annika's colour could not be read, so it was given a free one.",
    );
  });
});
