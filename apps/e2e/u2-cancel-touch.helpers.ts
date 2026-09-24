import type { CDPSession } from "@playwright/test";
import type { Pt } from "./mobile/touch.helpers";

// Same trusted Chromium CDP channel as the existing mobile/touch.helpers.ts.
// Explicit IDs keep the first touch alive while the second lands/lifts off-stage.
async function send(
  cdp: CDPSession,
  type: "touchStart" | "touchEnd" | "touchMove" | "touchCancel",
  points: Pt[],
) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, id) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
      id,
    })),
  });
}

export async function beginHeldStroke(cdp: CDPSession, [from, to]: [Pt, Pt]) {
  await send(cdp, "touchStart", [from]);
  for (let i = 1; i <= 12; i += 1) {
    const t = i / 12;
    await send(cdp, "touchMove", [{ x: from.x + (to.x - from.x) * t, y: from.y }]);
  }
}

export async function tapSecondFingerOffStage(cdp: CDPSession, held: Pt, button: Pt) {
  // No first-finger movement while there are two touches. A stage two-finger
  // cancellation must not rescue a broken Cancel button in this control path.
  await send(cdp, "touchStart", [held, button]);
  await send(cdp, "touchEnd", [held]);
}

export async function moveHeldFinger(cdp: CDPSession, point: Pt) {
  // Caller uses this only AFTER second finger lifted and Cancel was observed.
  await send(cdp, "touchMove", [point]);
}

export async function releaseHeldFinger(cdp: CDPSession) {
  await send(cdp, "touchEnd", []);
}
