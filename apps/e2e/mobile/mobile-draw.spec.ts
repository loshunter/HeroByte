/**
 * Mobile touch: drawing on the table with a finger.
 *
 * This spec exists because the desktop-only harness structurally could not see
 * the bug it characterises. The single `chromium` project runs with
 * `hasTouch: false`, and `mobile-layout.spec.ts` is entirely mouse-driven, so
 * "drawing is dead to touch" shipped and stayed shipped without a red test.
 *
 * Tests annotated `test.fail()` document behaviour that is BROKEN today. They
 * pass by failing. Removing the annotation is the acceptance criterion for the
 * fix, not a cleanup step.
 */
import { expect, test } from "../fixtures";
import {
  boardBox,
  joinMobileTable,
  readCam,
  readDrawings,
  selectMobileTool,
} from "./mobile.helpers";
import { openTouch, touchDrag, touchDragThenSecondFinger } from "./touch.helpers";

test.describe("mobile touch — camera", () => {
  test("one finger pans the map when no tool owns the pointer", async ({ page }) => {
    await joinMobileTable(page);

    const before = await readCam(page);
    expect(before).not.toBeNull();

    const box = await boardBox(page);
    const cdp = await openTouch(page);
    const from = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };

    await touchDrag(cdp, from, [{ x: from.x + 90, y: from.y + 60 }]);

    await expect
      .poll(async () => {
        const cam = await readCam(page);
        return cam ? Math.abs(cam.x - before!.x) + Math.abs(cam.y - before!.y) : 0;
      })
      .toBeGreaterThan(20);
  });
});

test.describe("mobile touch — drawing", () => {
  test("one finger draws a freehand stroke", async ({ page }) => {
    await joinMobileTable(page);
    await selectMobileTool(page, /^Draw$/i);

    // The drawing toolbar replaces the tool sheet once Draw is armed.
    await expect(page.getByRole("toolbar", { name: /Drawing tools/i })).toBeVisible();

    const before = await readDrawings(page);
    const box = await boardBox(page);
    const cdp = await openTouch(page);
    const from = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 };

    await touchDrag(cdp, from, [
      { x: from.x + 70, y: from.y + 20 },
      { x: from.x + 110, y: from.y - 25 },
    ]);

    await expect.poll(async () => (await readDrawings(page)).count).toBeGreaterThan(before.count);

    const after = await readDrawings(page);
    expect(after.lastType).toBe("freehand");
    expect(after.lastOwner).toBe(after.uid);
    expect(after.lastPointCount).toBeGreaterThan(2);
  });

  test("a second finger zooms instead of committing the stroke", async ({ page }) => {
    await joinMobileTable(page);
    await selectMobileTool(page, /^Draw$/i);
    await expect(page.getByRole("toolbar", { name: /Drawing tools/i })).toBeVisible();

    const before = await readDrawings(page);
    const camBefore = await readCam(page);
    const box = await boardBox(page);
    const cdp = await openTouch(page);
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.5;

    // Start drawing with one finger, then reach for a second and spread.
    await touchDragThenSecondFinger(
      cdp,
      { x: cx - 40, y: cy },
      { x: cx - 10, y: cy + 20 },
      { x: cx + 60, y: cy + 20 },
      [
        { x: cx - 70, y: cy + 20 },
        { x: cx + 120, y: cy + 20 },
      ],
    );

    await expect.poll(async () => (await readCam(page))?.scale).not.toBe(camBefore?.scale);

    // The stroke is discarded, not committed — no stray mark from zooming.
    const after = await readDrawings(page);
    expect(after.count).toBe(before.count);
  });
});

/**
 * Measures whether Chromium's emulated touch synthesises compatibility mouse
 * events (mousedown/mouseup/click) after a touch gesture.
 *
 * This is load-bearing, not curiosity. The mouse path at
 * useStageEventRouter.ts:252-301 ALREADY routes to the drawing tool, so if
 * compat events fire, wiring the touch path would double-fire and every other
 * assertion here would be measuring the wrong mechanism.
 */
test.describe("mobile touch — event model", () => {
  test("a one-finger drag does not synthesise compatibility mouse events", async ({ page }) => {
    await joinMobileTable(page);

    await page.evaluate(() => {
      const counts = { mousedown: 0, mousemove: 0, mouseup: 0, click: 0 };
      (window as unknown as { __COMPAT__: typeof counts }).__COMPAT__ = counts;
      for (const type of Object.keys(counts) as (keyof typeof counts)[]) {
        window.addEventListener(type, () => {
          counts[type] += 1;
        });
      }
    });

    const box = await boardBox(page);
    const cdp = await openTouch(page);
    const from = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };

    await touchDrag(cdp, from, [{ x: from.x + 80, y: from.y + 40 }]);
    await page.waitForTimeout(250);

    const counts = await page.evaluate(
      () => (window as unknown as { __COMPAT__: Record<string, number> }).__COMPAT__,
    );

    expect(counts.mousedown, `compat mouse events observed: ${JSON.stringify(counts)}`).toBe(0);
    expect(counts.mouseup).toBe(0);
  });
});
