/**
 * Mobile touch: selecting with a finger.
 *
 * useMarqueeSelection refused every finger — it required `evt.button === 0`
 * and a TouchEvent has no `button` at all — so Select was offered in the tool
 * sheet and did nothing, exactly as drawing had been.
 */
import { expect, test } from "../fixtures";
import {
  boardBox,
  joinMobileTable,
  marqueeBoxAroundFirstToken,
  selectMobileTool,
} from "./mobile.helpers";
import { openTouch, touchDrag, touchDragThenSecondFinger } from "./touch.helpers";

test.describe("mobile touch — marquee select", () => {
  /**
   * useMarqueeSelection rejected `evt.button !== 0`, and a TouchEvent has no
   * `button` at all, so every finger was refused. Select was offered in the
   * tool sheet and did nothing.
   */
  test("one finger drags a marquee and selects what it covers", async ({ page }) => {
    await joinMobileTable(page);
    await selectMobileTool(page, /^Select$/i);

    const box = await marqueeBoxAroundFirstToken(page);
    expect(box, "no token on the board to marquee").not.toBeNull();

    const cdp = await openTouch(page);
    await touchDrag(cdp, box!.from, [box!.to]);

    // The marquee itself is transient; what proves touch reached the tool is
    // that a selection sheet appeared, which only renders with a selection.
    await expect(page.getByRole("region", { name: /Selected object actions/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("a second finger abandons the marquee instead of selecting", async ({ page }) => {
    await joinMobileTable(page);
    await selectMobileTool(page, /^Select$/i);

    const box = await boardBox(page);
    const cdp = await openTouch(page);
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.35;

    await touchDragThenSecondFinger(
      cdp,
      { x: cx - 150, y: cy - 100 },
      { x: cx - 40, y: cy },
      { x: cx + 80, y: cy },
      [
        { x: cx - 180, y: cy },
        { x: cx + 180, y: cy },
      ],
    );

    // Pinching out of a marquee must not commit a selection.
    await expect(page.getByRole("region", { name: /Selected object actions/i })).toBeHidden();
  });
});

test.describe("mobile touch — selection sheet reach", () => {
  for (const viewport of [
    { width: 375, height: 812, label: "portrait" },
    { width: 812, height: 375, label: "landscape" },
  ]) {
    test(`every selection control is on screen and >=44px (${viewport.label})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await joinMobileTable(page);
      await selectMobileTool(page, /^Select$/i);

      const box = await marqueeBoxAroundFirstToken(page);
      expect(box).not.toBeNull();
      const cdp = await openTouch(page);
      await touchDrag(cdp, box!.from, [box!.to]);

      const sheet = page.getByRole("region", { name: /Selected object actions/i });
      await expect(sheet).toBeVisible({ timeout: 5_000 });

      const report = await page.evaluate(() => {
        const el = document.querySelector(".mobile-selection-sheet");
        if (!el) return null;
        const controls = [...el.querySelectorAll("button")].map((b) => {
          const r = b.getBoundingClientRect();
          return {
            label: (b.textContent || "").trim(),
            height: Math.round(r.height),
            onScreen:
              r.top >= 0 &&
              r.bottom <= window.innerHeight &&
              r.left >= 0 &&
              r.right <= window.innerWidth,
          };
        });
        return {
          offScreen: controls.filter((c) => !c.onScreen).map((c) => c.label),
          under44: controls.filter((c) => c.height < 44).map((c) => `${c.label}:${c.height}`),
          hasClear: controls.some((c) => /clear/i.test(c.label)),
        };
      });

      expect(report).not.toBeNull();
      // Clear is the only dismissal, so losing it strands the sheet.
      expect(report!.hasClear).toBe(true);
      expect(report!.offScreen).toEqual([]);
      expect(report!.under44).toEqual([]);
    });
  }
});
