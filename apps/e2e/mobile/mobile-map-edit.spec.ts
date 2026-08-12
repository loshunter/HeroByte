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
import { expect, test, type Browser, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
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

/**
 * The slice's own done-when, driven entirely through the mobile shell:
 * DM -> Map -> START LIVE MAP -> drag a room -> drag a wall, and a second
 * browser as a player sees the wall arrive as a vision blocker.
 */
test.describe("the mobile map-edit mode", () => {
  test("a DM authors a room and a wall from the dock, and a player receives them", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(120_000);

    // Separate contexts → distinct session UIDs. A shared one collides the
    // DM's uid and trips the connection-conflict close.
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const page = await dmContext.newPage();
    const player = await playerContext.newPage();

    try {
      // A tablet: the done-when's device, and the width a DM would author on.
      await page.setViewportSize({ width: 820, height: 1180 });
      await joinMobileTable(page);
      await elevateToDM(page);

      // ---- DM -> Map: slot five opens the screen, the screen arms the mode ----
      await page.getByRole("button", { name: /^DM$/i }).click();
      await expect(page.getByRole("dialog", { name: "DM Menu" })).toBeVisible();
      await page.getByRole("button", { name: /Edit the live map/i }).click();

      // Arming a Mode clears the surface: the screen that launched it must be
      // gone, or the DM is looking at the menu instead of the map.
      await expect(page.getByRole("dialog", { name: "DM Menu" })).toBeHidden();
      const dock = page.getByRole("navigation", { name: /Map edit actions/i });
      await expect(dock).toBeVisible();
      await expect(page.getByRole("navigation", { name: /Mobile actions/i })).toHaveCount(0);

      // ---- START LIVE MAP from the sheet ----
      await dock.getByRole("button", { name: /Tool/ }).click();
      await page.getByRole("button", { name: /Start live map/i }).click();
      await page.waitForFunction(
        () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
        undefined,
        { timeout: 30_000 },
      );
      // Room and Wall only exist once the controller is on the bound document.
      // Scoped to the tool GRID, not the page: M5 adds sub-panels below it whose
      // swatch labels are terrain family names, and the Room panel's "Wall ring:"
      // options are one badly-named family away from matching /Wall/ too (desktop
      // derives those labels by stripping a " Wall" suffix, so a family that does
      // not end in it keeps the word). An unscoped match becomes a strict-mode
      // violation the moment that happens, and the failure reads as a UI bug.
      const toolGrid = page.locator(".mobile-tool-sheet__grid");
      const roomTool = toolGrid.getByRole("button", { name: /Room/ });
      await expect(roomTool).toBeVisible({ timeout: 30_000 });

      const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
      const cdp = await openTouch(page);
      const at = (fx: number, fy: number) => ({
        x: box.x + box.width * fx,
        y: box.y + box.height * fy,
      });

      // ---- drag a room ----
      // Room carries dials (wall ring, floor), so since M5 the sheet STAYS
      // open on selection and the DM dismisses it deliberately. Asserting the
      // open state first is the point: it is what makes this leg fail if the
      // rule is ever silently reverted to close-on-any-tool.
      await roomTool.click();
      await expect(page.locator(".mobile-tool-sheet")).toBeVisible();
      await page.getByRole("button", { name: /To the map/i }).click();
      await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
      await touchDrag(cdp, at(0.25, 0.3), [at(0.75, 0.6)]);
      await page.waitForFunction(
        () => {
          const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
          return (snapshot?.compiledScene?.walls?.length ?? 0) > 0 && Boolean(snapshot?.mapTerrain);
        },
        undefined,
        { timeout: 30_000 },
      );
      const afterRoom = await wallCount(page);

      // ---- drag a wall ----
      // The room's placeRoom command must settle first: a tool's onMouseUp
      // skips the commit while a command is in flight, and does NOT retry —
      // so a wall dragged too soon is silently dropped. Same wait the desktop
      // smoke spec takes for the same reason.
      await page.waitForTimeout(800);
      await dock.getByRole("button", { name: /Tool/ }).click();
      await toolGrid.getByRole("button", { name: /Wall/ }).click();
      // Wall has NO dials, so it closes the sheet on its own — the other half
      // of the same rule, and the half that would pass vacuously if the sheet
      // simply never closed.
      await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
      await touchDrag(cdp, at(0.3, 0.75), [at(0.7, 0.75)]);
      await expect.poll(() => wallCount(page), { timeout: 30_000 }).toBeGreaterThan(afterRoom);

      // ---- a player, in a second browser, receives it as a vision blocker ----
      await joinMobileTable(player);
      await player.waitForFunction(
        (expected) => {
          const scene = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene;
          return (
            (scene?.walls?.length ?? 0) >= expected &&
            (scene?.walls ?? []).some((wall) => wall.blocksVision === true)
          );
        },
        afterRoom + 1,
        { timeout: 30_000 },
      );
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });

  test("the palette fits a 375x812 phone in both orientations", async ({ page }) => {
    await joinMobileTable(page);
    await elevateToDM(page);
    await page.getByRole("button", { name: /^DM$/i }).click();
    await page.getByRole("button", { name: /Edit the live map/i }).click();

    for (const size of [
      { width: 375, height: 812 },
      { width: 812, height: 375 },
    ]) {
      await page.setViewportSize(size);
      const dock = page.getByRole("navigation", { name: /Map edit actions/i });
      await expect(dock).toBeVisible();

      // Five slots, never six: the dock is a hardcoded 5-column grid and a
      // sixth child overlaps rather than wraps (settled, handoff §9).
      const buttons = dock.getByRole("button");
      await expect(buttons).toHaveCount(5);

      const dockBox = (await dock.boundingBox())!;
      expect(dockBox.x).toBeGreaterThanOrEqual(0);
      expect(Math.round(dockBox.x + dockBox.width)).toBeLessThanOrEqual(size.width);

      for (let i = 0; i < 5; i += 1) {
        const slot = (await buttons.nth(i).boundingBox())!;
        // The 44px touch floor, and inside the viewport horizontally.
        expect(Math.round(slot.height)).toBeGreaterThanOrEqual(44);
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(Math.round(slot.x + slot.width)).toBeLessThanOrEqual(size.width);
      }

      // And the LABELS fit inside those slots, which is a different question
      // the boxes above cannot answer. Found in the browser, not here: at the
      // 11px readability floor "Cancel" rendered 67px in a 59px content box
      // and was clipped, while every box assertion above stayed green. One
      // pixel-font word has no break opportunity, so it overflows rather than
      // wrapping — five characters is the real ceiling for a dock label.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('nav[aria-label="Map edit actions"] button')]
          .filter((button) => button.scrollWidth > button.clientWidth + 1)
          .map((button) => button.textContent?.trim().replace(/\s+/g, " ") ?? ""),
      );
      expect(clipped).toEqual([]);

      // The sheet the mode opens must fit too — M3's contract, and the first
      // sheet in this mode is the one holding START LIVE MAP.
      await dock.getByRole("button", { name: /Tool/ }).click();
      const sheet = page.locator(".mobile-tool-sheet");
      const sheetBox = (await sheet.boundingBox())!;
      expect(sheetBox.y).toBeGreaterThanOrEqual(0);
      expect(Math.round(sheetBox.y + sheetBox.height)).toBeLessThanOrEqual(size.height);
      await expect(page.getByRole("button", { name: /Start live map/i })).toBeVisible();
      await page.getByRole("button", { name: /Close tools/i }).click();
    }
  });
});
