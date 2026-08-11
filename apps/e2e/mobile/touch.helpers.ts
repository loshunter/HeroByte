/**
 * Trusted multi-touch gestures for the mobile E2E project.
 *
 * WHY CDP AND NOT page.touchscreen: Playwright's public Touchscreen API is
 * tap-only — `tap()` dispatches touchStart + touchEnd with NO touchMove, and
 * carries a single touch point. That can never satisfy the drawing tool's
 * ">1 point" send gate (useDrawingTool.ts:192-195) and can never express a
 * second finger, so it cannot exercise either half of the touch path.
 *
 * `Input.dispatchTouchEvent` is the same CDP channel Playwright's own tap()
 * uses, so these events arrive with isTrusted === true. Anything synthesised
 * with `page.evaluate(() => el.dispatchEvent(new TouchEvent(...)))` would be
 * untrusted and would prove nothing about real device behaviour.
 *
 * Chromium-only. The mobile project is chromium anyway (the iPhone device
 * descriptors are webkit-backed and webkit is not installed here or in CI).
 *
 * Coordinates are CSS pixels relative to the viewport — the same space
 * `locator.boundingBox()` returns.
 */
import type { CDPSession, Page } from "@playwright/test";

export interface Pt {
  x: number;
  y: number;
}

/** Open a CDP session for dispatching touch events on this page. */
export async function openTouch(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page);
}

async function send(cdp: CDPSession, type: string, points: Pt[]): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, id) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
      id,
    })),
  });
}

/** Straight-line interpolation, excluding the start point. */
function lerpPoints(from: Pt, to: Pt, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return out;
}

/**
 * One finger: press at `from`, drag through each waypoint, lift.
 *
 * `steps` interpolated moves are sent per leg. The drawing tool appends one
 * point per touchmove, so a freehand stroke needs at least two moves total to
 * clear its send gate.
 */
export async function touchDrag(
  cdp: CDPSession,
  from: Pt,
  waypoints: Pt[],
  options: { steps?: number } = {},
): Promise<void> {
  const steps = options.steps ?? 6;

  await send(cdp, "touchStart", [from]);

  let cursor = from;
  for (const waypoint of waypoints) {
    for (const point of lerpPoints(cursor, waypoint, steps)) {
      await send(cdp, "touchMove", [point]);
    }
    cursor = waypoint;
  }

  await send(cdp, "touchEnd", []);
}

/** One finger down and straight back up, with no movement between. */
export async function touchTap(cdp: CDPSession, at: Pt): Promise<void> {
  await send(cdp, "touchStart", [at]);
  await send(cdp, "touchEnd", []);
}

/**
 * Two fingers moving from `start` to `end` positions simultaneously.
 *
 * Drives both the scale change (the distance between the fingers) and the
 * centre travel (their midpoint), which is exactly the combination the pinch
 * anchor has to survive.
 */
export async function touchPinch(
  cdp: CDPSession,
  start: [Pt, Pt],
  end: [Pt, Pt],
  options: { steps?: number } = {},
): Promise<void> {
  const steps = options.steps ?? 10;

  await send(cdp, "touchStart", start);

  const legA = lerpPoints(start[0], end[0], steps);
  const legB = lerpPoints(start[1], end[1], steps);
  for (let i = 0; i < steps; i += 1) {
    await send(cdp, "touchMove", [legA[i], legB[i]]);
  }

  await send(cdp, "touchEnd", []);
}

/**
 * Start a one-finger drag, then plant a SECOND finger without lifting the
 * first, then pinch with both.
 *
 * This is the gesture that must cancel an in-progress stroke rather than
 * commit it: a user who starts drawing and then decides to zoom.
 */
export async function touchDragThenSecondFinger(
  cdp: CDPSession,
  from: Pt,
  dragTo: Pt,
  secondFinger: Pt,
  spreadTo: [Pt, Pt],
  options: { steps?: number } = {},
): Promise<void> {
  const steps = options.steps ?? 6;

  await send(cdp, "touchStart", [from]);
  for (const point of lerpPoints(from, dragTo, steps)) {
    await send(cdp, "touchMove", [point]);
  }

  // Second finger lands. touches.length becomes 2 on this touchstart.
  await send(cdp, "touchStart", [dragTo, secondFinger]);

  const legA = lerpPoints(dragTo, spreadTo[0], steps);
  const legB = lerpPoints(secondFinger, spreadTo[1], steps);
  for (let i = 0; i < steps; i += 1) {
    await send(cdp, "touchMove", [legA[i], legB[i]]);
  }

  await send(cdp, "touchEnd", []);
}

/**
 * Drag with one finger, hold STILL, tap a second finger somewhere off the
 * canvas, then lift the first.
 *
 * This is the gesture that isolates the dock's abort button from the
 * two-finger rule, and the distinction is not academic. The gesture router
 * cancels when it SEES more than one touch — at the stage's own touchstart, or
 * at the next touchmove. A second finger landing on the dock produces neither:
 * the touchstart targets the button, not the stage, and if the first finger
 * never moves again there is no touchmove to notice. So the drag survives to
 * the lift, and the lift COMMITS. Only the button's own signal can stop it.
 *
 * The lifts are separate events on purpose — the second finger comes up first,
 * which is what generates the button's compat click.
 */
export async function touchDragThenTapElsewhere(
  cdp: CDPSession,
  from: Pt,
  dragTo: Pt,
  tapAt: Pt,
  options: { steps?: number } = {},
): Promise<void> {
  const steps = options.steps ?? 6;

  await send(cdp, "touchStart", [from]);
  for (const point of lerpPoints(from, dragTo, steps)) {
    await send(cdp, "touchMove", [point]);
  }

  // Second finger lands off-canvas. NO touchmove after this point.
  await send(cdp, "touchStart", [dragTo, tapAt]);
  // Second finger lifts (the first is still down) -> the button's click.
  await send(cdp, "touchEnd", [dragTo]);
  // First finger lifts. Without an abort this is where the drag commits.
  await send(cdp, "touchEnd", []);
}
