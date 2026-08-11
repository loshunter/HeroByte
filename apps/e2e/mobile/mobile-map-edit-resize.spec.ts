/**
 * THE RESIZE-CROSSING RULE (redesign §2 M4c), decided and encoded here.
 *
 * `mapEditMode` is App state derived from one `activeTool` value, so it has
 * never known which layout is on screen — it simply survived a crossing. Before
 * M4c that was a defect: the mobile shell had no palette, so a tablet DM who
 * rotated or resized landed in an armed mode with no controls, no one-finger
 * pan (shouldPan excludes it) and no token interaction, while
 * useMapEditHotkeys stayed armed so a keyboard Ctrl+Z still edited the live
 * map.
 *
 * The decision is to KEEP it and make it true rather than to reset the tool on
 * a crossing. The mode is now layout-independent in fact as well as in state:
 * each layout offers a palette, the same controller drives both, and Ctrl+Z on
 * a keyboard-equipped tablet is now consistent with a visible Undo button
 * rather than a hidden one. Resetting would also mean a rotation silently
 * throwing away a DM's armed tool, which is worse than either alternative.
 *
 * No `?mobile` parameter here on purpose: this spec is about the media-query
 * path App.tsx actually listens on, and pinning the layout would defeat it.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

const DESKTOP = { width: 1200, height: 800 };
const PHONE = { width: 375, height: 812 };

async function joinUnpinned(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");

  const passwordInput = page.getByPlaceholder("Table password");
  await expect(passwordInput).toBeEnabled({ timeout: 15_000 });
  await passwordInput.fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Table/i }).click();

  await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForFunction(() => {
    const data = window.__HERO_BYTE_E2E__;
    return Boolean(data?.snapshot && data.uid && data.cam);
  });
}

test.describe("map-edit across the layout boundary", () => {
  test("survives desktop -> mobile into the palette, and back again", async ({ page }) => {
    test.setTimeout(90_000);
    await joinUnpinned(page);
    await elevateToDM(page);

    // Desktop: the header's entry and the floating MAP TOOLS window.
    await page.getByTitle("Author the live map on the table").click();
    await expect(page.getByRole("button", { name: /START LIVE MAP/i })).toBeVisible();
    // The mobile shell is genuinely absent here, so its later presence is a
    // crossing rather than something that was on screen all along.
    await expect(page.getByRole("navigation", { name: /Map edit actions/i })).toHaveCount(0);

    // ---- cross to the phone ----
    await page.setViewportSize(PHONE);

    const palette = page.getByRole("navigation", { name: /Map edit actions/i });
    await expect(palette).toBeVisible({ timeout: 10_000 });
    // Still the MODE, not the ordinary dock: the crossing kept the tool.
    await expect(page.getByRole("navigation", { name: /Mobile actions/i })).toHaveCount(0);
    await expect(palette.getByRole("button", { name: /Exit/ })).toBeVisible();

    // ---- and back ----
    await page.setViewportSize(DESKTOP);
    await expect(page.getByRole("button", { name: /START LIVE MAP/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("navigation", { name: /Map edit actions/i })).toHaveCount(0);
  });

  test("Exit on the phone really leaves the mode, and the desktop agrees", async ({ page }) => {
    test.setTimeout(90_000);
    await joinUnpinned(page);
    await elevateToDM(page);
    await page.getByTitle("Author the live map on the table").click();

    await page.setViewportSize(PHONE);
    const palette = page.getByRole("navigation", { name: /Map edit actions/i });
    await expect(palette).toBeVisible({ timeout: 10_000 });
    await palette.getByRole("button", { name: /Exit/ }).click();

    // The ordinary DM dock returns — slot five is DM, not View.
    const dock = page.getByRole("navigation", { name: /Mobile actions/i });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("button", { name: /^DM$/i })).toBeVisible();

    // And the mode is genuinely off, not just hidden by the layout: crossing
    // back shows the header entry un-pressed rather than the MAP TOOLS window.
    await page.setViewportSize(DESKTOP);
    await expect(page.getByRole("button", { name: /START LIVE MAP/i })).toHaveCount(0);
    await expect(page.getByTitle("Author the live map on the table")).toBeVisible();
  });
});
