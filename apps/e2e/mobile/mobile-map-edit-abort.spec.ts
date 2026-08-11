/**
 * The ⨯ ABORT slot, driven end to end (M4c review, completeness critic).
 *
 * The critic's point was exact: the button's cross-tree path — useReducer in
 * MobileLayout, a counter prop onto MapBoard, an effect in useMapEditCancel,
 * a cleared drag ref — was covered piece by piece and never once as a whole.
 * A break anywhere along it would have left every unit test green.
 *
 * It also has to be tested with a gesture the two-finger rule does NOT already
 * cancel, or the assertion proves nothing about the button. That gesture is:
 * drag, hold STILL, tap the dock, lift. The gesture router notices a second
 * touch at the stage's own touchstart or at the next touchmove — a tap on the
 * dock produces neither, because the touchstart targets the button and there
 * is no further movement. So the drag survives to the lift, and the lift is
 * what commits. Only the signal can stop it.
 *
 * Lives in its own file because mobile-map-edit.spec.ts is already 254 lines
 * of a 348 ceiling, and e2e specs are not __tests__-exempt from the guard.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag, touchDragThenTapElsewhere } from "./touch.helpers";

function wallCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0);
}

/** Arm the mode from the DM screen and bind a live map, all by tapping. */
async function enterLiveMapEdit(page: Page): Promise<void> {
  await joinMobileTable(page);
  await elevateToDM(page);
  await page.getByRole("button", { name: /^DM$/i }).click();
  await page.getByRole("button", { name: /Edit the live map/i }).click();

  const dock = page.getByRole("navigation", { name: /Map edit actions/i });
  await expect(dock).toBeVisible();
  await dock.getByRole("button", { name: /Tool/ }).click();
  await page.getByRole("button", { name: /Start live map/i }).click();
  await page.waitForFunction(
    () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
    undefined,
    { timeout: 30_000 },
  );
  // Wall is the default sub-tool; closing the sheet uncovers the canvas.
  await expect(page.getByRole("button", { name: /Wall/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Close tools/i }).click();
  await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
}

test.describe("the abort slot", () => {
  test("a tap on ABORT mid-drag makes the release commit nothing", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 820, height: 1180 });
    await enterLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });
    const abort = page
      .getByRole("navigation", { name: /Map edit actions/i })
      .getByRole("button", { name: /Abort/ });
    const abortBox = (await abort.boundingBox())!;
    const abortCentre = {
      x: abortBox.x + abortBox.width / 2,
      y: abortBox.y + abortBox.height / 2,
    };

    const cdp = await openTouch(page);

    // A POSITIVE CONTROL FIRST. Without it, "no wall appeared" would be
    // satisfied by a build where dragging never worked at all.
    expect(await wallCount(page)).toBe(0);
    await touchDrag(cdp, at(0.3, 0.3), [at(0.7, 0.3)]);
    await expect.poll(() => wallCount(page), { timeout: 30_000 }).toBe(1);

    // Now the same drag, aborted with the other thumb before the lift.
    await touchDragThenTapElsewhere(cdp, at(0.3, 0.5), at(0.7, 0.5), abortCentre);

    // The first drag's commit landed inside the poll budget above, so a steady
    // count here is an assertion rather than an absence.
    await page.waitForTimeout(2_000);
    expect(await wallCount(page)).toBe(1);

    // And the abort is not sticky: the mode still works afterwards.
    await touchDrag(cdp, at(0.3, 0.7), [at(0.7, 0.7)]);
    await expect.poll(() => wallCount(page), { timeout: 30_000 }).toBe(2);
  });
});
