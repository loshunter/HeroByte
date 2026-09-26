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
import { openTouch, touchDrag, touchDragThenSecondFinger, touchTap } from "./touch.helpers";

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
    // Upper third: the drawing sheet occupies the lower half of the canvas
    // once it is open, and a gesture there would land on the sheet, not the map.
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.25;

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

test.describe("mobile touch — taps are not drawings", () => {
  /**
   * onMouseDown seeds line/rect/circle with [world, world], so a tap that
   * never moved already clears the ">= 2 points" send gate. On a desktop that
   * needs a deliberate click; on a phone every stray tap reaches it, and
   * double-tap-to-ping fires two.
   */
  for (const tool of ["line", "rect", "circle"] as const) {
    test(`a tap with the ${tool} tool commits nothing`, async ({ page }) => {
      await joinMobileTable(page);
      await selectMobileTool(page, /^Draw$/i);
      await page
        .getByRole("button", { name: new RegExp(`^${tool === "rect" ? "Rectangle" : tool}$`, "i") })
        .click();

      const before = await readDrawings(page);
      const box = await boardBox(page);
      const cdp = await openTouch(page);

      // Two taps, as double-tap-to-ping would produce.
      await touchTap(cdp, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.2 });
      await touchTap(cdp, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.2 });
      await page.waitForTimeout(400);

      expect((await readDrawings(page)).count).toBe(before.count);
    });
  }
});

test.describe("mobile touch — drawing toolbar reach", () => {
  /**
   * Measured before the grid rewrite at 375x812: 873px of content in a 345px
   * box, with the eraser, size, colour, Undo, Redo and Done all off the right
   * edge — and unreachable by finger, because touch-action:none on an ancestor
   * disables descendant scrollers.
   */
  for (const viewport of [
    { width: 375, height: 812, label: "portrait" },
    { width: 812, height: 375, label: "landscape" },
  ]) {
    test(`every control is on screen and >=44px (${viewport.label})`, async ({ page }, info) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await joinMobileTable(page);
      await selectMobileTool(page, /^Draw$/i);
      await expect(page.getByRole("toolbar", { name: /Drawing tools/i })).toBeVisible();

      const report = await page.evaluate(() => {
        const sheet = document.querySelector(".mobile-drawing-sheet");
        if (!sheet) return null;
        const clips = (overflow: string) => /^(auto|scroll|hidden|clip|overlay)$/.test(overflow);
        const controls = [...sheet.querySelectorAll("button,input")].map((el) => {
          const r = el.getBoundingClientRect();
          const visible = {
            left: Math.max(0, r.left),
            top: Math.max(0, r.top),
            right: Math.min(window.innerWidth, r.right),
            bottom: Math.min(window.innerHeight, r.bottom),
          };
          const clippingAncestors = [];
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const clipX = clips(style.overflowX);
            const clipY = clips(style.overflowY);
            if (!clipX && !clipY) continue;
            const box = parent.getBoundingClientRect();
            // Overflow clips to the client box, excluding borders and scrollbars.
            const left = box.left + parent.clientLeft;
            const top = box.top + parent.clientTop;
            const right = left + parent.clientWidth;
            const bottom = top + parent.clientHeight;
            if (clipX) {
              visible.left = Math.max(visible.left, left);
              visible.right = Math.min(visible.right, right);
            }
            if (clipY) {
              visible.top = Math.max(visible.top, top);
              visible.bottom = Math.min(visible.bottom, bottom);
            }
            clippingAncestors.push({
              element: parent.id || parent.className || parent.tagName,
              clipX,
              clipY,
              left,
              top,
              right,
              bottom,
            });
          }
          const exposedWidth = Math.max(0, visible.right - visible.left);
          const exposedHeight = Math.max(0, visible.bottom - visible.top);
          return {
            label: (
              el.getAttribute("aria-label") ||
              el.textContent ||
              (el as HTMLInputElement).type ||
              ""
            ).trim(),
            height: r.height,
            width: r.width,
            exposedWidth,
            exposedHeight,
            clippingAncestors,
            fullyExposed: exposedWidth + 0.01 >= r.width && exposedHeight + 0.01 >= r.height,
            reachable: el.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            ),
            onScreen:
              r.top >= 0 &&
              r.bottom <= window.innerHeight &&
              r.left >= 0 &&
              r.right <= window.innerWidth,
          };
        });
        return {
          count: controls.length,
          offScreen: controls.filter((c) => !c.onScreen).map((c) => c.label),
          under44: controls.filter((c) => c.height < 44 || c.width < 44),
          exposedUnder44: controls.filter((c) => c.exposedHeight < 44 || c.exposedWidth < 44),
          clipped: controls.filter((c) => !c.fullyExposed).map((c) => c.label),
          covered: controls.filter((c) => !c.reachable).map((c) => c.label),
          controls,
        };
      });

      await info.attach(`drawing-reach-${viewport.label}.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
      await info.attach(`drawing-reach-${viewport.label}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      expect(report).not.toBeNull();
      // 17 = five drawing tools + four area templates + color + width + opacity
      // + Hide controls + Undo + Redo + Cancel + Done. Pinned deliberately: this tests
      // that ADDING a control cannot quietly push another one off screen, so a
      // new count must be seen and re-measured, not auto-accepted.
      expect(report!.count).toBe(17);
      expect(report!.offScreen).toEqual([]);
      expect(report!.under44).toEqual([]);
      expect(report!.exposedUnder44).toEqual([]);
      expect(report!.clipped).toEqual([]);
      expect(report!.covered).toEqual([]);
    });
  }
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

  /**
   * A tap is the case that CAN synthesise compat mouse events — a drag cannot,
   * because movement past the slop threshold cancels the tap gesture. So the
   * drag measurement above does not generalise, and this records the tap
   * result separately rather than assuming it.
   *
   * Either answer is safe for drawing: without compat events the touch path
   * commits nothing (degenerate strokes are rejected), and with them the mouse
   * path commits nothing for the same reason. The number is recorded so a
   * future change to that gate knows which mechanism it is dealing with.
   *
   * This taps with NOTHING armed, which is why it still sees the compat pair
   * after M6. useTouchGestureRouter cancels the touchstart only when a tool
   * takes ownership of it, so an idle tap keeps the browser's default and the
   * numbers below are unchanged. The armed case is pinned elsewhere: by the
   * hook's own unit tests, and on the wire by mobile-map-edit-paint.spec.ts.
   */
  test("records whether a bare tap synthesises compatibility mouse events", async ({ page }) => {
    await joinMobileTable(page);

    await page.evaluate(() => {
      const counts = { mousedown: 0, mouseup: 0, click: 0 };
      (window as unknown as { __TAP__: typeof counts }).__TAP__ = counts;
      for (const type of Object.keys(counts) as (keyof typeof counts)[]) {
        window.addEventListener(type, () => {
          counts[type] += 1;
        });
      }
    });

    const box = await boardBox(page);
    const cdp = await openTouch(page);
    await touchTap(cdp, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.3 });
    await page.waitForTimeout(400);

    const counts = await page.evaluate(
      () => (window as unknown as { __TAP__: Record<string, number> }).__TAP__,
    );

    // Whatever the count, a tap must never produce a drawing — asserted in the
    // "taps are not drawings" block above. Here we only pin that a single tap
    // does not fan out into repeated synthetic presses.
    expect(counts.mousedown).toBeLessThanOrEqual(1);
    expect(counts.mouseup).toBeLessThanOrEqual(1);
  });
});
