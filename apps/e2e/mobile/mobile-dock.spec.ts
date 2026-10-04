/**
 * Slot five is contextual (M4a, redesign §1a): the dock is a hardcoded
 * 5-column grid and a sixth child overlaps rather than wraps — a settled
 * decision — so the DM entry takes the slot `View` spent on the single
 * reset-camera action, and reset-camera moves into the tool sheet as
 * Reset view so a DM still has it.
 */
import { expect, test } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

test.describe("mobile dock — slot five", () => {
  test("Reset for a player, DM for a DM — never a sixth button", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);

    const dock = page.getByRole("navigation", { name: /Mobile actions/i });
    // The word on the button says what it does (a phone has no hover): Reset, named "Reset view".
    const reset = dock.getByRole("button", { name: "Reset view", exact: true });
    await expect(reset).toBeVisible();
    await expect(reset).toHaveText(/Reset/);
    await expect(dock.getByRole("button", { name: /^DM$/i })).toHaveCount(0);
    await expect(dock.getByRole("button")).toHaveCount(5);

    await elevateToDM(page);

    const dmButton = dock.getByRole("button", { name: /^DM$/i });
    await expect(dmButton).toBeVisible();
    await expect(dock.getByRole("button", { name: /Reset view/i })).toHaveCount(0);
    await expect(dock.getByRole("button")).toHaveCount(5);

    // The slot opens a real surface in the machine, not a dead end — a
    // placeholder screen until M4b, with the standard >=44px exit.
    await dmButton.click();
    const dmScreen = page.getByRole("dialog", { name: "DM Menu" });
    await expect(dmScreen).toBeVisible();
    const close = page.getByRole("button", { name: "Close DM Menu" });
    const box = (await close.boundingBox())!;
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(dmScreen).toBeHidden();
  });

  test("Reset view in the tool sheet really resets the camera", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);

    // Plant a camera nobody would reset to, through the app's real setter —
    // mutating the cam object in place re-renders nothing and proves nothing.
    await page.evaluate(() => window.__HERO_BYTE_E2E__!.setCam!({ x: 137, y: -60, scale: 2 }));
    await page.waitForFunction(() => window.__HERO_BYTE_E2E__?.cam?.scale === 2);

    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: /Tools/i })
      .click();
    // The sheet's own tile: the dock's button carries the same name, so scope to the sheet.
    const recenter = page
      .locator(".mobile-tool-sheet")
      .getByRole("button", { name: /Reset view/i });
    const box = (await recenter.boundingBox())!;
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    await recenter.click();

    // The sheet closes — you reset the view to SEE the map — and the camera has
    // demonstrably left the planted state.
    await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
    await page.waitForFunction(() => {
      const cam = window.__HERO_BYTE_E2E__?.cam;
      return Boolean(cam) && !(cam!.x === 137 && cam!.y === -60 && cam!.scale === 2);
    });
  });
});
