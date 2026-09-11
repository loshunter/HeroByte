// The pure rule: which piece is followed and how big it is judged, and when
// its screen box leaves the uncovered band. Numbers are a STYLISED 375×812
// phone with the sheet's top rounded to 472 (the measured player sheet is at
// 469 — see the plan's F1 numbers; no combat strip unless stated), a 50px
// grid at scale 1, and the 16px pad — so the band is y ∈ [16, 456], x ∈ [16, 359].
// A medium token's box is its cell; its plate adds 40 screen px below.
//
// Note for the next reader: a centring expectation `(lo + hi − tail) / 2`
// cancels the pad algebraically (lo + hi = the limit whatever the pad); the
// pad is pinned to exactly 16 by the 391/392 literal pair below, and the
// lead placements (`hi − tail − extent`) carry it too.

import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import {
  FOLLOW_PAD_PX,
  FOLLOW_PLATE_BELOW_PX,
  followDecision,
  followTarget,
  type FollowTarget,
} from "../movePadCameraFollow";

const sceneObject = (id: string, type: string, transform: Partial<Record<string, number>>) => ({
  id,
  type,
  owner: "*",
  locked: false,
  zIndex: 5,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, ...transform },
  data: { size: "medium" },
});

const snapshot = {
  tokens: [
    { id: "mine", owner: "me", x: 3, y: 4, color: "hsl(0 0% 0%)" },
    { id: "dragon", owner: "me", x: 9, y: 9, size: "gargantuan", color: "hsl(0 0% 0%)" },
    { id: "tall", owner: "me", x: 5, y: 5, color: "hsl(0 0% 0%)" },
    { id: "flipped", owner: "me", x: 5, y: 5, color: "hsl(0 0% 0%)" },
  ],
  props: [{ id: "crate", owner: "*" }],
  sceneObjects: [
    // A token's gizmo scale lives on its scene object (TokensLayer reads it).
    sceneObject("token:tall", "token", { x: 5, y: 5, scaleY: 3 }),
    sceneObject("token:flipped", "token", { x: 5, y: 5, scaleY: -3 }),
    // CELLS, like a token — PropsLayer draws at transform.x * gridSize + gridSize / 2.
    sceneObject("prop:crate", "prop", { x: 12, y: 14 }),
    sceneObject("prop:statue", "prop", { x: 20, y: 20, scaleX: 3 }),
    sceneObject("prop:mirrored", "prop", { x: 20, y: 20, scaleX: -3 }),
  ],
} as unknown as RoomSnapshot;

const surface = { width: 375, height: 812 };
const visible = { top: 0, bottom: 472 };
/** A medium token's box (one cell) around a world centre, with its plate. */
const token = (x: number, y: number): FollowTarget => ({
  left: x - 25,
  right: x + 25,
  top: y - 25,
  bottom: y + 25,
  below: FOLLOW_PLATE_BELOW_PX,
});
const prop = (x: number, y: number): FollowTarget => ({ ...token(x, y), below: 0 });
const cam = (x: number, y: number, scale = 1) => ({ x, y, scale });
const decide = (target: FollowTarget, camera = cam(0, 0), band = visible, area = surface) =>
  followDecision({ target, camera, surface: area, visible: band });

describe("followTarget", () => {
  it("follows the first movable TOKEN: its cell as the box, the plate below", () => {
    expect(followTarget(snapshot, ["prop:crate", "token:mine", "token:dragon"], 50)).toEqual({
      left: 150,
      right: 200,
      top: 200,
      bottom: 250,
      below: FOLLOW_PLATE_BELOW_PX,
    });
  });

  it("a gargantuan token's box is its sprite (3 × 0.75 cells), centred on the cell", () => {
    // Centre (475, 475), half 56.25.
    expect(followTarget(snapshot, ["token:dragon"], 50)).toEqual({
      left: 418.75,
      right: 531.25,
      top: 418.75,
      bottom: 531.25,
      below: FOLLOW_PLATE_BELOW_PX,
    });
  });

  it("a token's gizmo scale (on its scene object) grows its box about its CENTRE — TokensLayer offsets by half", () => {
    // Medium sprite 37.5 × 3 = 112.5 tall (half 56.25 around 275); the x
    // stays one cell because 37.5 < 50.
    expect(followTarget(snapshot, ["token:tall"], 50)).toEqual({
      left: 250,
      right: 300,
      top: 218.75,
      bottom: 331.25,
      below: FOLLOW_PLATE_BELOW_PX,
    });
  });

  it("a flipped token (negative gizmo scale) is judged by the same box — the sprite is as big either way", () => {
    expect(followTarget(snapshot, ["token:flipped"], 50)).toEqual(
      followTarget(snapshot, ["token:tall"], 50),
    );
  });

  it("a mirrored prop (negative gizmo scale) grows from its corner the OTHER way", () => {
    // Origin 1006.25, × −3 reaches back to 893.75; the right edge is the cell's.
    expect(followTarget(snapshot, ["prop:mirrored"], 50)).toEqual({
      left: 893.75,
      right: 1050,
      top: 1000,
      bottom: 1050,
      below: 0,
    });
  });

  it("falls back to the first movable PROP — its transform is CELLS, converted like a token's, no plate", () => {
    expect(followTarget(snapshot, ["prop:crate"], 50)).toEqual({
      left: 600,
      right: 650,
      top: 700,
      bottom: 750,
      below: 0,
    });
  });

  it("a prop's gizmo scale grows its box from its TOP-LEFT corner — PropsLayer sets no offset", () => {
    // Sprite origin 1025 − 18.75 = 1006.25; × 3 wide reaches 1118.75. The
    // left edge is the cell's (1000), the right is the sprite's.
    expect(followTarget(snapshot, ["prop:statue"], 50)).toEqual({
      left: 1000,
      right: 1118.75,
      top: 1000,
      bottom: 1050,
      below: 0,
    });
  });

  it("is null with no snapshot, nothing movable, or ids the snapshot no longer has", () => {
    expect(followTarget(null, ["token:mine"], 50)).toBeNull();
    expect(followTarget(snapshot, [], 50)).toBeNull();
    expect(followTarget(snapshot, ["token:gone", "prop:gone"], 50)).toBeNull();
  });
});

describe("followDecision", () => {
  it("is null while the piece and its plate sit wholly inside the band", () => {
    // Box x 150..200, y 200..250, plate to 290 — clear.
    expect(decide(token(175, 225))).toBeNull();
  });

  it("fires the moment the PLATE would touch the sheet, and places the piece a LEAD inside that edge, on that axis only", () => {
    // LITERALS, so the pad is pinned to exactly 16: 391 + 25 + 40 = 456 is the
    // last inside position (472 − 16); one px lower fires. The piece goes back
    // a lead of half its height: centre 456 − 40 − 25 − 25 = 366, so the next
    // step crosses again and the camera scrolls one step's worth; x is
    // untouched (100, not the band's middle) because it did not leave.
    expect(decide(token(100, 391))).toBeNull();
    expect(decide(token(100, 392))).toEqual({
      type: "focus-point",
      x: 100,
      y: 392,
      at: { x: 100, y: 366 },
    });
    expect(FOLLOW_PAD_PX).toBe(16);
    expect(FOLLOW_PLATE_BELOW_PX).toBe(40);
  });

  it("a piece walking UP out of the band is placed a lead inside the top edge", () => {
    // Box 0..50 against a band starting at 16: centre 16 + 25 + 25 = 66.
    expect(decide(token(175, 25))).toEqual({
      type: "focus-point",
      x: 175,
      y: 25,
      at: { x: 175, y: 66 },
    });
  });

  it("a prop has no plate, so it may sit 40px closer to the sheet than a token", () => {
    expect(decide(prop(175, 420))).toBeNull();
    expect(decide(token(175, 420))).not.toBeNull();
  });

  it("scales the box by the camera and keeps the untouched axis at its SCREEN position", () => {
    // World box 125..175 × 165..215 at scale 2 is screen 250..350 × 330..430;
    // 430 + 40 > 456 fires; the kept x is the screen centre 300, not 150; the
    // lead is half the SCREEN extent (50): centre 456 − 40 − 50 − 50 = 316.
    expect(decide(token(150, 190), cam(0, 0, 2))).toEqual({
      type: "focus-point",
      x: 150,
      y: 190,
      at: { x: 300, y: 316 },
    });
    expect(decide(token(150, 150), cam(0, 0, 2))).toBeNull();
  });

  it("a piece off the LEFT or RIGHT edge is placed a lead inside that edge with its y kept", () => {
    // x band [16, 359]: left → 16 + 25 + 25 = 66; right → 359 − 25 − 25 = 309.
    expect(decide(token(30, 225))).toEqual({
      type: "focus-point",
      x: 30,
      y: 225,
      at: { x: 66, y: 225 },
    });
    expect(decide(token(350, 225))).toEqual({
      type: "focus-point",
      x: 350,
      y: 225,
      at: { x: 309, y: 225 },
    });
  });

  it("the combat strip's bottom is the band's top when there is room below it", () => {
    const withStrip = { top: 80, bottom: 472 };
    expect(decide(token(175, 100))).toBeNull();
    // Under the strip's edge: placed a lead below it, 96 + 25 + 25.
    expect(decide(token(175, 100), cam(0, 0), withStrip)).toEqual({
      type: "focus-point",
      x: 175,
      y: 100,
      at: { x: 175, y: 146 },
    });
  });

  it("landscape: a band too short for piece-plus-plate (or a lead) centres the PIECE and lets the plate go", () => {
    // 16..72 holds a 50px box (56 ≥ 50) but not the 90 with its plate nor a
    // lead: the sprite is centred at 44, wholly above the sheet at 88.
    const landscape = { width: 812, height: 375 };
    expect(decide(token(400, 300), cam(0, 0), { top: 0, bottom: 88 }, landscape)).toEqual({
      type: "focus-point",
      x: 400,
      y: 300,
      at: { x: 400, y: 44 },
    });
    // And a piece sitting there is INSIDE — the predicate agrees with the placement.
    expect(decide(token(400, 44), cam(0, 0), { top: 0, bottom: 88 }, landscape)).toBeNull();
  });

  it("landscape with a combat strip: the strip leaves no room, so the strip is given up, never the sheet", () => {
    // Below the strip (80) and above the sheet (88) is inverted; the sprite
    // still lands at 44, over the translucent strip, not behind the sheet.
    const landscape = { width: 812, height: 375 };
    expect(decide(token(400, 300), cam(0, 0), { top: 80, bottom: 88 }, landscape)).toEqual({
      type: "focus-point",
      x: 400,
      y: 300,
      at: { x: 400, y: 44 },
    });
  });

  it("when nothing fits, the piece is top-aligned to the surface rather than clipped at both ends", () => {
    // A sheet whose top is at 40: not even [0, 40] holds 50px → top at 0.
    expect(decide(token(175, 300), cam(0, 0), { top: 0, bottom: 40 })).toEqual({
      type: "focus-point",
      x: 175,
      y: 300,
      at: { x: 175, y: 25 },
    });
  });

  it("a piece bigger than the screen is aimed at the screen's middle — best effort", () => {
    const huge: FollowTarget = { left: 0, right: 1000, top: 0, bottom: 1000, below: 0 };
    expect(decide(huge, cam(-200, -200))).toEqual({
      type: "focus-point",
      x: 500,
      y: 500,
      at: { x: 187.5, y: 406 },
    });
  });

  it("never places below the surface when the sheet reports a top past it", () => {
    // The band's bottom is the surface's (812 − 16 = 796): 796 − 40 − 25 − 25.
    expect(decide(token(175, 900), cam(0, 0), { top: 0, bottom: 2000 })).toEqual({
      type: "focus-point",
      x: 175,
      y: 900,
      at: { x: 175, y: 706 },
    });
  });
});
