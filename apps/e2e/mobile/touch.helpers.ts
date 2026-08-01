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
