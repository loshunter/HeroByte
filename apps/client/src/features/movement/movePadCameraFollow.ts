// ============================================================================
// MOVE-PAD CAMERA FOLLOW — the pure half
// ============================================================================
// On a phone the selection sheet (with the d-pad in it) plus the dock is an
// opaque band over the bottom of the map — ~340px of an 812px screen — and
// the piece being moved is under the band. A player walking ↓ walked INTO
// it: every press charged in combat, nothing visible either way. The follow
// keeps the moved piece inside the UNCOVERED part of the map surface (above
// the sheet, and below the combat strip when there is room for that): when
// its screen box is no longer wholly inside, the camera brings it back — on
// the axis that left, only (a ↓ step never slides the map sideways).
//
// Everything here is arithmetic over rects and the camera so the rule is
// testable without a DOM; the hook measures the real rects and issues the
// command. Screen = camera.{x,y} + world * camera.scale (Konva's stage
// transform, the same one useCamera's toWorld inverts).

import type { RoomSnapshot, SceneObject } from "@herobyte/shared";
import type { Camera } from "../../hooks/useCamera";
import type { CameraCommand } from "../../ui/MapBoard.types";
import { PROP_SIZE_MULTIPLIERS, propRenderSize } from "../map/propSizing";
import type { MovableSelection } from "./keyboardMovement";

export interface FollowTarget {
  /**
   * The painted piece's box in world px, never smaller than its cell. A
   * token scales about its centre (TokensLayer offsets by half its size); a
   * prop scales about its top-left corner (PropsLayer sets no offset), so a
   * gizmo-enlarged prop grows right and down.
   */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /**
   * What hangs BELOW the box in SCREEN px regardless of zoom: a token's
   * nameplate (HP bar, name, budget readout) is counter-scaled, so its reach
   * is a constant — and the budget line is what the follow exists to show.
   */
  below: number;
}

/**
 * TokenNameplate below a token's edge: GAP 4 + BAR 4 + GAP 4 + name 11 + 2 +
 * budget 11 = 36 screen px, plus 4 of slack. Props carry no plate.
 */
export const FOLLOW_PLATE_BELOW_PX = 40;

/** A span [origin, origin + size × scale], either way round for a flipped scale. */
function span(origin: number, size: number, scale: number): [number, number] {
  const far = origin + size * scale;
  return [Math.min(origin, far), Math.max(origin, far)];
}

function box(
  cellX: number,
  cellY: number,
  gridSize: number,
  xs: [number, number],
  ys: [number, number],
  below: number,
): FollowTarget {
  const cx = (cellX + 0.5) * gridSize;
  const cy = (cellY + 0.5) * gridSize;
  return {
    left: Math.min(xs[0], cx - gridSize / 2),
    right: Math.max(xs[1], cx + gridSize / 2),
    top: Math.min(ys[0], cy - gridSize / 2),
    bottom: Math.max(ys[1], cy + gridSize / 2),
    below,
  };
}

/**
 * The object the camera follows: the first movable TOKEN, else the first
 * movable PROP. Both carry CELL coordinates (a token's x/y and a prop's
 * scene transform alike — both layers draw at `cell * gridSize + gridSize /
 * 2`). A multi-select follows its first piece — they move in formation. The
 * sprite is 0.75 of a cell times the size ladder (a gargantuan piece is
 * 2.25 cells) times the gizmo scale from the scene object.
 */
export function followTarget(
  snapshot: RoomSnapshot | null,
  movable: readonly MovableSelection[],
  gridSize: number,
): FollowTarget | null {
  if (!snapshot) return null;
  const sceneObject = (id: string): SceneObject | undefined =>
    snapshot.sceneObjects?.find((candidate) => candidate.id === id);
  const tokenSceneId = movable.find((id) => id.startsWith("token:"));
  if (tokenSceneId !== undefined) {
    const token = snapshot.tokens?.find((candidate) => candidate.id === tokenSceneId.slice(6));
    if (token) {
      const sprite = gridSize * 0.75 * (PROP_SIZE_MULTIPLIERS[token.size ?? "medium"] ?? 1);
      const transform = sceneObject(tokenSceneId)?.transform;
      const cx = (token.x + 0.5) * gridSize;
      const cy = (token.y + 0.5) * gridSize;
      const halfW = (sprite * Math.abs(transform?.scaleX ?? 1)) / 2;
      const halfH = (sprite * Math.abs(transform?.scaleY ?? 1)) / 2;
      return box(
        token.x,
        token.y,
        gridSize,
        [cx - halfW, cx + halfW],
        [cy - halfH, cy + halfH],
        FOLLOW_PLATE_BELOW_PX,
      );
    }
  }
  const propSceneId = movable.find((id) => id.startsWith("prop:"));
  if (propSceneId !== undefined) {
    const object = sceneObject(propSceneId);
    if (object && object.type === "prop") {
      const { transform } = object;
      const sprite = propRenderSize(gridSize, object.data.size);
      const originX = (transform.x + 0.5) * gridSize - sprite / 2;
      const originY = (transform.y + 0.5) * gridSize - sprite / 2;
      return box(
        transform.x,
        transform.y,
        gridSize,
        span(originX, sprite, transform.scaleX ?? 1),
        span(originY, sprite, transform.scaleY ?? 1),
        0,
      );
    }
  }
  return null;
}

export interface FollowDecisionInput {
  target: FollowTarget;
  camera: Camera;
  /** The map surface's size in stage px. */
  surface: { width: number; height: number };
  /**
   * The covers in stage px, both measured: `top` is the combat strip's bottom
   * (0 without one), `bottom` is the sheet's top.
   */
  visible: { top: number; bottom: number };
  /** Breathing room inside the band's edges, stage px. */
  pad?: number;
}

/**
 * Breathing room so a piece never sits flush against the sheet — the sheet's
 * glow (`box-shadow: 0 0 16px`) paints outside its border box, so the pad is
 * the glow's reach.
 */
export const FOLLOW_PAD_PX = 16;

interface Axis {
  lo: number;
  hi: number;
  /** The tail below the piece that the band has room for (0 when it has not). */
  tail: number;
}

/**
 * The vertical band the piece must sit in, chosen so it FITS: below the
 * strip and inside the pad when there is room; giving up the strip (its box
 * is transparent between its buttons — the sheet is not) when there is not;
 * giving up the pad last.
 * When nothing fits, the last candidate is used and the piece is top-aligned.
 */
function verticalBand(
  extent: number,
  below: number,
  visible: { top: number; bottom: number },
  surface: { height: number },
  pad: number,
): Axis {
  const sheet = Math.min(visible.bottom, surface.height);
  // The strip is modelled by its bottom edge only (it is 420px wide, centred;
  // the model errs conservatively). Its box is transparent between two opaque
  // buttons; the sheet is opaque throughout — hence the order.
  const candidates: Array<[number, number]> = [
    [Math.max(0, visible.top) + pad, sheet - pad],
    [pad, sheet - pad],
    [0, sheet],
  ];
  const chosen = candidates.find(([lo, hi]) => hi - lo >= extent) ?? candidates[2]!;
  const [lo, hi] = chosen;
  return { lo, hi, tail: hi - lo >= extent + below ? below : 0 };
}

/**
 * Where the piece's centre goes on an axis it left. Against the edge it
 * crossed, with a LEAD of half its extent: the next step in that direction
 * crosses again and the camera moves one step's worth — a scroll at the
 * edge, not a whip back to the middle (a 200px correction in 120 ms read as
 * a strobe; 50px reads as motion). When the band cannot hold extent, tail
 * and lead, the lead goes first, then the tail, then the piece is
 * leading-edge-aligned — there the predicate stays out and every trigger
 * re-issues the same command, which is safe only because a bare camera
 * change is never a trigger.
 */
function place(axis: Axis, from: number, to: number, out: boolean, stage: number): number {
  const extent = to - from;
  if (!out) return (from + to) / 2;
  if (extent > stage) return stage / 2; // bigger than the screen: best effort
  const room = axis.hi - axis.lo;
  const lead = extent / 2;
  if (room >= extent + axis.tail + 2 * lead) {
    return from < axis.lo ? axis.lo + lead + extent / 2 : axis.hi - axis.tail - lead - extent / 2;
  }
  // `tail` is already 0 when the band cannot hold extent + below, so this
  // one branch is both "centre with the plate" and "centre the piece alone".
  if (room >= extent + axis.tail) return (axis.lo + axis.hi - axis.tail) / 2;
  return axis.lo + extent / 2; // top- / left-aligned: the leading edge shows
}

/**
 * Null while the target's screen box (plus its plate, when the band has room
 * for it) sits wholly inside the uncovered band; otherwise the command that
 * brings it back. Per axis: the axis that left the band is recentred in it,
 * the other keeps the piece's current screen position; a band too short for
 * the piece aligns its leading edge instead of clipping both ends. Whenever
 * some band can hold the piece the predicate and the placement agree, so a
 * placed piece is inside until the next step moves it; a piece taller than
 * the whole open map (a gargantuan token against landscape's 88px) stays
 * out and is re-issued the same command on every trigger.
 */
export function followDecision({
  target,
  camera,
  surface,
  visible,
  pad = FOLLOW_PAD_PX,
}: FollowDecisionInput): CameraCommand | null {
  const s = camera.scale;
  const x0 = camera.x + target.left * s;
  const x1 = camera.x + target.right * s;
  const y0 = camera.y + target.top * s;
  const y1 = camera.y + target.bottom * s;
  const xAxis: Axis = { lo: pad, hi: surface.width - pad, tail: 0 };
  const yAxis = verticalBand(y1 - y0, target.below, visible, surface, pad);
  const outX = x0 < xAxis.lo || x1 > xAxis.hi;
  const outY = y0 < yAxis.lo || y1 + yAxis.tail > yAxis.hi;
  if (!outX && !outY) return null;
  return {
    type: "focus-point",
    x: (target.left + target.right) / 2,
    y: (target.top + target.bottom) / 2,
    at: {
      x: place(xAxis, x0, x1, outX, surface.width),
      y: place(yAxis, y0, y1, outY, surface.height),
    },
  };
}
