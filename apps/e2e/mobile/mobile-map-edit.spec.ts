/**
 * Live map authoring BY FINGER (M4c).
 *
 * This spec runs in the touch project but on the DESKTOP layout
 * (`?mobile=false`) on purpose: it isolates the question every piece of the
 * mobile palette rests on — can a trusted touch drag reach useMapEditTool and
 * land an element? — from the separate question of whether the mobile dock
 * offers the controls. The mobile-shell half is guarded separately.
 *
 * The observable is `snapshot.compiledScene.walls`, not any client-side draft:
 * that is the server's own statement that the wall is on the table, and it is
 * the same thing a player's fog reads. The shared fixture resets the room AND
 * the map store before each test, so no live map exists at the start and
 * nothing authored here leaks into another spec.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { openTouch, touchDrag, touchDragThenSecondFinger } from "./touch.helpers";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

/** Enter the default table on the DESKTOP layout inside the touch context. */
async function joinDesktopTableWithTouch(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/?mobile=false");

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

/** Arm map-edit from the header and bind a live document. */
async function startLiveMap(page: Page): Promise<void> {
  await page.getByTitle("Author the live map on the table").click();
  await page.getByRole("button", { name: /START LIVE MAP/i }).click();
  await page.waitForFunction(
    () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
    undefined,
    { timeout: 20_000 },
  );
  // ● LIVE is the palette stating that the controller's ACTIVE document is the
  // room's bound one — the gate every tool silently no-ops without.
  await expect(page.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
}

function wallCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0);
}

test.describe("live map authoring by finger", () => {
  test("a one-finger drag lands a wall; a second finger discards the next one", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await joinDesktopTableWithTouch(page);
    await elevateToDM(page);
    await startLiveMap(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    // Anchor by canvas FRACTION: an exact world delta at an unknown camera
    // walks the drag clean off the canvas.
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    expect(await wallCount(page)).toBe(0);

    // Wall is the default sub-tool.
    await touchDrag(cdp, at(0.3, 0.4), [at(0.6, 0.4)]);
    await expect.poll(() => wallCount(page), { timeout: 20_000 }).toBe(1);

    // Now the gesture that must NOT commit: the same drag, but a second finger
    // lands before the lift. "I want to zoom", not "stamp what I have".
    await touchDragThenSecondFinger(cdp, at(0.3, 0.65), at(0.6, 0.65), at(0.8, 0.75), [
      at(0.2, 0.55),
      at(0.9, 0.85),
    ]);

    // A commit would have arrived by now — the first drag's did, inside the
    // same poll budget — so a steady 1 is the assertion, not an absence.
    await page.waitForTimeout(2_000);
    expect(await wallCount(page)).toBe(1);
  });
});
