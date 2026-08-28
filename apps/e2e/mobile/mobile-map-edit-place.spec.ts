/**
 * M7 — Place, Scatter and Light driven by a finger.
 *
 * These three were the last map-edit tools a phone could not reach, and the
 * reason was never the plumbing: M6 closed the compat-mouse doubling that used
 * to drop two stamps per tap. The reason was AIMING. All three are pointed by a
 * ghost that follows the mouse, and a finger produces no hover, so a tap would
 * be a blind drop — worst for Scatter, whose cluster shape derives from the
 * exact point.
 *
 * So a finger gets a different gesture from a mouse: press AIMS, release DROPS.
 * The middle test is the one that pays for that decision. A spec that only
 * pressed-and-released would pass identically against a build that dropped on
 * press, which is the design this slice deliberately did not ship — so it holds
 * the finger down and asserts NOTHING has landed yet.
 *
 * The observables are the server's: `mapElements` for stamps and tiles,
 * `compiledScene.lights` for a torch pool. Every leg reads its observable
 * before the gesture, because "an element appeared" is satisfied by a build
 * where placing never worked and something else had already placed one.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag, touchTap } from "./touch.helpers";

const PHONE = { width: 390, height: 844 };

const elements = (page: Page) =>
  page.evaluate(
    () =>
      window.__HERO_BYTE_E2E__?.snapshot?.mapElements?.layers?.reduce(
        (total, layer) => total + layer.elements.length,
        0,
      ) ?? 0,
  );

const lights = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.lights?.length ?? 0);

async function armLiveMapEdit(page: Page) {
  await page.setViewportSize(PHONE);
  await joinMobileTable(page);
  await elevateToDM(page);

  await page.getByRole("button", { name: /^DM$/i }).click();
  await page.getByRole("button", { name: /Edit the live map/i }).click();

  const dock = page.getByRole("navigation", { name: /Map edit actions/i });
  await expect(dock).toBeVisible();

  await dock.getByRole("button", { name: /Tool/ }).click();
  await page.getByRole("button", { name: /Start live map/i }).click();
  await page.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId), {
    timeout: 30_000,
  });
  const toolGrid = page.locator(".mobile-tool-sheet__grid").first();
  await expect(toolGrid).toBeVisible({ timeout: 30_000 });
  return { dock, toolGrid };
}

/** A tool's commit is SKIPPED while a command is in flight and is not retried,
 * so a gesture started too soon after the last one is dropped in silence. */
const settle = (page: Page) => page.waitForTimeout(800);

test.describe("M7 — a finger places", () => {
  test("Place drops an object, and Scatter drops a handful", async ({ page }) => {
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    // ---- PLACE ----
    expect(await elements(page)).toBe(0); // positive control
    await toolGrid.getByRole("button", { name: /^Place$/ }).click();
    // Place takes an argument, so the sheet stays open over the asset picker.
    const placePanel = page.locator(".mobile-tool-sheet__section", { hasText: "Place" }).first();
    await expect(placePanel).toBeVisible();
    await page.getByRole("button", { name: /To the map/i }).click();

    await touchTap(cdp, at(0.4, 0.3));
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBe(1);

    // ---- SCATTER ----
    // A cluster, not one stamp: buildScatterDrafts commits several as ONE
    // command, so anything greater than +1 proves the scatter tool ran rather
    // than Place having stayed armed.
    await settle(page);
    await dock.getByRole("button", { name: /Tool/ }).click();
    await toolGrid.getByRole("button", { name: /^Scatter$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();

    await touchTap(cdp, at(0.6, 0.6));
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBeGreaterThan(2);
  });

  test("a press AIMS and only the release drops — the finger can still change its mind", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const { toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    await toolGrid.getByRole("button", { name: /^Place$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    expect(await elements(page)).toBe(0);

    // Press and HOLD. Under a drop-on-press build this is already a placement,
    // which is the whole reason this test exists.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: Math.round(at(0.4, 0.3).x), y: Math.round(at(0.4, 0.3).y), id: 0 }],
    });
    await page.waitForTimeout(600);
    expect(await elements(page)).toBe(0);

    // Slide to a different spot, still down. Still nothing.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: Math.round(at(0.65, 0.5).x), y: Math.round(at(0.65, 0.5).y), id: 0 }],
    });
    await page.waitForTimeout(300);
    expect(await elements(page)).toBe(0);

    // Lift. Now — and exactly once, not once per point slid through.
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBe(1);
    await settle(page);
    expect(await elements(page)).toBe(1);
  });

  test("a second finger abandons the drop instead of committing it", async ({ page }) => {
    test.setTimeout(150_000);
    const { toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    await toolGrid.getByRole("button", { name: /^Place$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();

    const first = at(0.35, 0.35);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: Math.round(first.x), y: Math.round(first.y), id: 0 }],
    });
    // Second finger lands: the gesture is promoted to the camera's. Someone
    // reaching for a pinch wants to zoom, not to stamp a crate wherever their
    // first finger happened to be resting.
    //
    // What this proves is the ROUTER's half — it stops calling commit — and
    // that is worth an end-to-end test because the promotion crosses three
    // hooks. It does NOT prove the aim itself is cleared: sabotaging
    // useMapEditTouchAim.cancel to keep the point left this green, because
    // commit is never reached either way. The ghost half is pinned where it is
    // visible, in useMapEditTouchAim.test.ts.
    const second = at(0.7, 0.7);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: Math.round(first.x), y: Math.round(first.y), id: 0 },
        { x: Math.round(second.x), y: Math.round(second.y), id: 1 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await settle(page);
    expect(await elements(page)).toBe(0);
  });

  test("Light drops a torch pool the whole table receives", async ({ page }) => {
    test.setTimeout(150_000);
    const { toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);

    expect(await lights(page)).toBe(0); // positive control
    await toolGrid.getByRole("button", { name: /^Light$/ }).click();
    // Light takes no argument, so it closes the sheet and puts the DM on the
    // map — the same rule Erase follows.
    await expect(page.locator(".mobile-tool-sheet")).toBeHidden();

    await touchTap(cdp, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.45 });
    await expect.poll(() => lights(page), { timeout: 30_000 }).toBe(1);

    // A drag is still one light, not one per move: the aim re-points, it does
    // not accumulate.
    await settle(page);
    await touchDrag(cdp, { x: box.x + box.width * 0.3, y: box.y + box.height * 0.7 }, [
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.7 },
    ]);
    await expect.poll(() => lights(page), { timeout: 30_000 }).toBe(2);
    await settle(page);
    expect(await lights(page)).toBe(2);
  });
});
