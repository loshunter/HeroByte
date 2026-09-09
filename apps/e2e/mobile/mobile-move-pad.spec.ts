/**
 * Keyboard movement's phone surface: the d-pad in the selection sheet. A
 * phone has no WASD, so the sheet that already appears with a selection
 * carries a 3x3 pad — each tap is the same one-cell move, on the 44px floor.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable, selectMobileTool, undersizedControls } from "./mobile.helpers";

test.describe("mobile — move pad", () => {
  test("the pad appears with a movable selection, sits on the 44px floor, and each tap is one cell", async ({
    page,
  }) => {
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
    expect(await undersizedControls(page, ".mobile-move-pad")).toEqual([]);

    // The sheet, pad included, must fit above the dock inside the viewport.
    const sheet = await page.getByRole("region", { name: "Selected object actions" }).boundingBox();
    const dock = await page.getByRole("navigation", { name: "Mobile actions" }).boundingBox();
    expect(sheet!.y).toBeGreaterThanOrEqual(0);
    expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(dock!.y);

    const origin = { x: Math.round(token.x), y: Math.round(token.y) };
    const readCell = () =>
      page.evaluate((id) => {
        const own = window.__HERO_BYTE_E2E__!.snapshot!.tokens.find((t) => t.id === id)!;
        return { x: own.x, y: own.y };
      }, token.id);

    await pad.getByRole("button", { name: "Move right" }).click();
    await expect.poll(readCell, { timeout: 5_000 }).toEqual({ x: origin.x + 1, y: origin.y });

    await pad.getByRole("button", { name: "Move down-left" }).click();
    await expect.poll(readCell, { timeout: 5_000 }).toEqual({ x: origin.x, y: origin.y + 1 });
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
