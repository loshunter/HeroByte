/**
 * Keyboard movement's phone surface: the d-pad in the selection sheet. A
 * phone has no WASD, so the sheet that already appears with a selection
 * carries a 3x3 pad — each tap is the same one-cell move, on the 44px floor.
 */
import { expect, test } from "../fixtures";
import { HOLD_START_DELAY_MS } from "../../client/src/layouts/MobileMovePad";
import { HOLD_STEP_INTERVAL_MS } from "../../client/src/features/movement/useKeyboardMovement";
import { joinMobileTable, selectMobileTool, undersizedControls } from "./mobile.helpers";
import { openTouch, touchHold } from "./touch.helpers";

test.describe("mobile — move pad", () => {
  for (const viewport of [
    { width: 375, height: 812, name: "portrait" },
    { width: 812, height: 375, name: "landscape" },
  ]) {
    test(`${viewport.name}: the pad appears with a movable selection, on the floor and on screen, and each TAP is one cell`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await joinMobileTable(page);
      await selectMobileTool(page, /^Select$/i);

      const token = await page.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const own = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
        data.sendMessage!({ t: "select-object", uid: data.uid!, objectId: `token:${own.id}` });
        return { id: own.id, x: own.x, y: own.y };
      });

      const pad = page.getByRole("group", { name: "Move selection" });
      await expect(pad).toBeVisible({ timeout: 5_000 });
      expect(await undersizedControls(page, ".mobile-move-pad")).toEqual([]);

      // Every visible pad button, the sheet's Clear chip and the dock all on
      // screen at once, without scrolling — in landscape the pad folds to ONE
      // row of eight (orthogonals, then diagonals) so this holds there too.
      const layout = await page.evaluate(() => {
        const onScreen = (r: DOMRect) =>
          r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
        const sheet = document.querySelector(".mobile-selection-sheet")!;
        const buttons = [...document.querySelectorAll(".mobile-move-pad button")].filter(
          (b) => (b as HTMLElement).offsetParent !== null,
        );
        const clear = [...sheet.querySelectorAll("button")].find((b) =>
          /clear/i.test(b.textContent ?? ""),
        )!;
        const pad = document.querySelector(".mobile-move-pad")!.getBoundingClientRect();
        const rects = buttons.map((b) => ({
          label: b.getAttribute("aria-label"),
          r: b.getBoundingClientRect(),
        }));
        const style = getComputedStyle(buttons[0]!);
        return {
          // The cascade: a later `.mobile-chip` rule shrank the arrows to 11px
          // on every portrait phone, and a surface rule could re-enable panning.
          fontPx: parseFloat(style.fontSize),
          touchAction: style.touchAction,
          visibleButtons: buttons.map((b) => b.getAttribute("aria-label")),
          allOnScreen: buttons.every((b) => onScreen(b.getBoundingClientRect())),
          clearOnScreen: onScreen(clear.getBoundingClientRect()),
          sheetScrolls: sheet.scrollHeight > sheet.clientHeight,
          padWidth: Math.round(pad.width),
          padHeight: Math.round(pad.height),
          rows: new Set(rects.map((e) => Math.round(e.r.top))).size,
          readingOrder: [...rects]
            .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)
            .map((e) => e.label),
        };
      });
      expect(layout.allOnScreen).toBe(true);
      expect(layout.clearOnScreen).toBe(true);
      expect(layout.sheetScrolls).toBe(false);
      expect(layout.visibleButtons).toHaveLength(8);
      expect(layout.fontPx).toBeGreaterThanOrEqual(14);
      expect(layout.touchAction).toBe("none");
      if (viewport.name === "portrait") {
        // Three rows of 69px chips: the pad takes the 220px it asks for, not
        // the 3×44 fit-content a `margin: 0 auto` grid item collapses to.
        expect(layout.rows).toBe(3);
        expect(layout.padWidth).toBeGreaterThanOrEqual(200);
      } else {
        // ONE row of eight, orthogonals first, ALL eight — never the one-row
        // fold that dropped the diagonals and made a landscape phone pay
        // double. A 44px pad (not 94) is what leaves the map room for a token
        // and the plate under it above the sheet (the move-pad follow's band).
        expect(layout.rows).toBe(1);
        expect(layout.padHeight).toBeLessThanOrEqual(50);
        expect(layout.readingOrder).toEqual([
          "Move left",
          "Move up",
          "Move down",
          "Move right",
          "Move up-left",
          "Move up-right",
          "Move down-left",
          "Move down-right",
        ]);
      }

      const origin = { x: Math.round(token.x), y: Math.round(token.y) };
      const readCell = () =>
        page.evaluate((id) => {
          const own = window.__HERO_BYTE_E2E__!.snapshot!.tokens.find((t) => t.id === id)!;
          return { x: own.x, y: own.y };
        }, token.id);

      // A real finger (tap, not click): down, up, out, leave, click — ONE step.
      await pad.getByRole("button", { name: "Move right", exact: true }).tap();
      await expect.poll(readCell, { timeout: 5_000 }).toEqual({ x: origin.x + 1, y: origin.y });
      await page.waitForTimeout(400);
      expect(await readCell()).toEqual({ x: origin.x + 1, y: origin.y });

      await pad.getByRole("button", { name: "Move down", exact: true }).tap();
      await expect.poll(readCell, { timeout: 5_000 }).toEqual({ x: origin.x + 1, y: origin.y + 1 });
      await page.waitForTimeout(400);
      expect(await readCell()).toEqual({ x: origin.x + 1, y: origin.y + 1 });
    });
  }

  test("a real HOLD walks and stops on release — a finger over CDP, and a mouse released off the chip", async ({
    page,
  }) => {
    // Neither jsdom (no setPointerCapture) nor `.tap()` (a touch pointer with
    // implicit capture, too short to walk) can see the walk or the capture.
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await selectMobileTool(page, /^Select$/i);
    const token = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      const own = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
      data.sendMessage!({ t: "select-object", uid: data.uid!, objectId: `token:${own.id}` });
      return { id: own.id, x: own.x, y: own.y };
    });
    const pad = page.getByRole("group", { name: "Move selection" });
    await expect(pad).toBeVisible({ timeout: 5_000 });
    const readX = () =>
      page.evaluate(
        (id) => window.__HERO_BYTE_E2E__!.snapshot!.tokens.find((t) => t.id === id)!.x,
        token.id,
      );
    // "Stopped" = the same cell across a window longer than a walk's start
    // delay — sampled only AFTER the last step sent before the release has
    // landed (a step is a round trip; reading at once saw it arrive).
    const settled = async () => {
      await page.waitForTimeout(HOLD_STEP_INTERVAL_MS * 3);
      const x = await readX();
      await page.waitForTimeout(HOLD_START_DELAY_MS + HOLD_STEP_INTERVAL_MS * 2);
      expect(await readX()).toBe(x);
      return x;
    };
    const left = pad.getByRole("button", { name: "Move left", exact: true });
    const leftBox = (await left.boundingBox())!;
    const centre = { x: leftBox.x + leftBox.width / 2, y: leftBox.y + leftBox.height / 2 };

    // A finger held for the delay plus two steps: the press, then the walk.
    const start = Math.round(token.x);
    const cdp = await openTouch(page);
    await touchHold(cdp, centre, HOLD_START_DELAY_MS + HOLD_STEP_INTERVAL_MS * 2 + 60);
    await expect.poll(readX, { timeout: 5_000 }).toBeLessThanOrEqual(start - 3);
    const afterFinger = await settled();

    // A mouse pressed on the chip and released far OFF it: capture brings the
    // release home, the walk ends, and the pad is not left dead.
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.waitForTimeout(HOLD_START_DELAY_MS + HOLD_STEP_INTERVAL_MS + 60);
    await page.mouse.move(centre.x + 150, centre.y - 300, { steps: 5 });
    await page.mouse.up();
    await expect.poll(readX, { timeout: 5_000 }).toBeLessThanOrEqual(afterFinger - 2);
    const afterMouse = await settled();
    await pad.getByRole("button", { name: "Move right", exact: true }).tap();
    await expect.poll(readX, { timeout: 5_000 }).toBe(afterMouse + 1);
  });

  test("no pad when the selection is someone else's token", async ({ page, browser }) => {
    // A second player in its own context guarantees a token that is not ours.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await joinMobileTable(otherPage);
      await otherPage.waitForFunction(() => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot?.tokens?.some((t) => t.owner === data.uid));
      });
      const otherId = await otherPage.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        return data.snapshot!.tokens.find((t) => t.owner === data.uid)!.id;
      });

      await page.setViewportSize({ width: 375, height: 812 });
      await joinMobileTable(page);
      await selectMobileTool(page, /^Select$/i);
      await page.waitForFunction(
        (id) => window.__HERO_BYTE_E2E__?.snapshot?.tokens?.some((t) => t.id === id),
        otherId,
      );
      await page.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__!;
        data.sendMessage!({ t: "select-object", uid: data.uid!, objectId: `token:${id}` });
      }, otherId);

      await expect(page.getByRole("region", { name: "Selected object actions" })).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByRole("group", { name: "Move selection" })).toHaveCount(0);
    } finally {
      await otherContext.close();
    }
  });
});
