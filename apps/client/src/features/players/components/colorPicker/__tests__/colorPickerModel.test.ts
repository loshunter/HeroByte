import { describe, expect, it, vi } from "vitest";
import {
  COLOR_WINDOW,
  colorToOkLab,
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
  cellOf,
  colorAdjustedMessage,
  colorPickerForRows,
  pickerField,
  pickerFieldKey,
  placeHandle,
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
    expect(cellOf(BLUE)!.hex).toBeDefined();
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

describe("colorAdjustedMessage", () => {
  it("names whose zone it was, or says it could not be used", () => {
    expect(colorAdjustedMessage("Bors")).toBe(
      "Moved to the nearest free colour: too close to Bors's.",
    );
    expect(colorAdjustedMessage()).toMatch(/could not be used/);
  });
});
