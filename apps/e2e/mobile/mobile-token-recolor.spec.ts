/**
 * Recolor on a phone: a double-TAP on your own token is the touch twin of the
 * desktop double-click. A phone never fires dblclick on the canvas — Konva
 * cancels a touchstart that lands on a shape, so the browser synthesises no
 * mouse events — and before the token wired Konva's `dbltap` the gesture did
 * nothing at all.
 *
 * The same spec guards the gestures around it: one tap only selects (no
 * recolor), the token's double-tap drops no ping, and a double-tap on empty
 * map still pings — which also proves the "no ping" assertion can fail.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { boardBox, joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDoubleTap, touchTap, type Pt } from "./touch.helpers";

/** Park the camera so the player's own token sits at the centre of the board. */
async function centreOwnToken(page: Page): Promise<{ id: string; at: Pt }> {
  const box = await boardBox(page);
  const id = await page.evaluate(
    ({ width, height }) => {
      const data = window.__HERO_BYTE_E2E__!;
      const own = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
      const grid = data.gridSize!;
      const scale = data.cam!.scale;
      data.setCam!({
        x: width / 2 - (own.x * grid + grid / 2) * scale,
        y: height / 2 - (own.y * grid + grid / 2) * scale,
        scale,
      });
      return own.id;
    },
    { width: box.width, height: box.height },
  );
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // The token is a Konva shape, so the hit must be the canvas, not a DOM overlay.
  await expect
    .poll(() => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, at))
    .toBe("CANVAS");
  return { id, at };
}

const tokenColor = (page: Page, id: string) =>
  page.evaluate(
    (tokenId) => window.__HERO_BYTE_E2E__!.snapshot!.tokens.find((t) => t.id === tokenId)!.color,
    id,
  );

const pingCount = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.pointers.length);

test.describe("mobile — token recolor", () => {
  test("a double-tap recolors your own token; one tap does not, and neither pings", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await joinMobileTable(page);
    const { id, at } = await centreOwnToken(page);
    const cdp = await openTouch(page);

    const original = await tokenColor(page, id);
    const pingsBefore = await pingCount(page);

    // One tap selects; it must not recolor. Wait out Konva's 400ms window.
    await touchTap(cdp, at);
    await page.waitForTimeout(800);
    expect(await tokenColor(page, id)).toBe(original);

    await touchDoubleTap(cdp, at);
    await expect.poll(() => tokenColor(page, id), { timeout: 5_000 }).not.toBe(original);
    expect(await pingCount(page)).toBe(pingsBefore);

    // Empty map off the token: the stage's own double-tap still pings. Paced
    // taps, because useDoubleTap ignores a second tap under 50ms.
    await page.waitForTimeout(500);
    const empty = { x: at.x + 120, y: at.y + 120 };
    await touchTap(cdp, empty);
    await page.waitForTimeout(120);
    await touchTap(cdp, empty);
    await expect.poll(() => pingCount(page), { timeout: 5_000 }).toBeGreaterThan(pingsBefore);
  });
});
