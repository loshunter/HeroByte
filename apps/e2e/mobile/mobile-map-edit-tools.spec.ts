/**
 * M5's tools driven by a finger, end to end, on the MOBILE layout.
 *
 * A new file rather than more of mobile-map-edit.spec.ts, which is at 272 of a
 * 348 cap — e2e specs are NOT exempt from the structure guard (the exemption is
 * the filename pattern `.test.`, not the directory).
 *
 * Every leg asserts its observable is ZERO before it drags and non-zero after.
 * That is the anti-vacuity device M4c paid for: a test whose drag never moves
 * cannot fail, because "nothing appeared" is satisfied by a build where
 * dragging never worked at all. Reading zero first proves the drag is what
 * changed the count.
 *
 * The observables are the SERVER's statements, not client drafts:
 *   walls/doors  -> snapshot.compiledScene, the same thing a player's fog reads
 *   splines/stamps -> snapshot.mapElements, which is privacy-filtered and sent
 *                     to every recipient. CompiledScene carries only walls,
 *                     doors and lights, so a spline never reaches it — that is
 *                     why this file reads two different fields rather than one.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag } from "./touch.helpers";

/**
 * 820x1180 is a TABLET. Everything below ran only at that width, which left the
 * width most players actually hold untested: the fit spec reaches 375 but only
 * measures, and measuring cannot catch a dial that is reachable yet unusable.
 */
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };

/** A DM on a touch device, in map-edit, with a live document bound. */
async function armLiveMapEdit(page: Page, viewport = TABLET) {
  await page.setViewportSize(viewport);
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
  await expect(page.locator(".mobile-tool-sheet__grid")).toBeVisible({ timeout: 30_000 });
  return { dock, toolGrid: page.locator(".mobile-tool-sheet__grid") };
}

const walls = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0);
const doors = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.length ?? 0);
const elements = (page: Page) =>
  page.evaluate(
    () =>
      window.__HERO_BYTE_E2E__?.snapshot?.mapElements?.layers?.reduce(
        (total, layer) => total + layer.elements.length,
        0,
      ) ?? 0,
  );

/**
 * A tool's onMouseUp SKIPS the commit while a command is still in flight and
 * does NOT retry, so a drag started too soon after the last one is silently
 * dropped. Same wait, for the same reason, as the sibling spec.
 */
const settle = (page: Page) => page.waitForTimeout(800);

test.describe("M5 tools by finger", () => {
  test("a finger authors a hall, a door and a spline, and the table receives all three", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    // ---- HALL, three cells wide ----
    expect(await walls(page)).toBe(0); // positive control
    await toolGrid.getByRole("button", { name: /^Hall$/ }).click();
    // Hall carries dials, so the sheet STAYS open — and the width control only
    // exists because it does.
    const widthRow = page.locator(".mobile-tool-sheet__section", { hasText: "Width (cells)" });
    await widthRow.getByRole("button", { name: "3", exact: true }).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    await touchDrag(cdp, at(0.2, 0.25), [at(0.75, 0.25)]);
    await expect.poll(() => walls(page), { timeout: 30_000 }).toBeGreaterThan(0);
    expect(await page.evaluate(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.mapTerrain))).toBe(
      true,
    );
    const afterHall = await walls(page);

    // ---- DOOR ----
    await settle(page);
    expect(await doors(page)).toBe(0); // positive control
    await dock.getByRole("button", { name: /Tool/ }).click();
    await toolGrid.getByRole("button", { name: /^Door$/ }).click();
    // Door has no dials, so it closes the sheet on its own.
    await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
    await touchDrag(cdp, at(0.3, 0.55), [at(0.45, 0.55)]);
    await expect.poll(() => doors(page), { timeout: 30_000 }).toBeGreaterThan(0);

    // ---- SPLINE, as a chain ----
    // A spline is a MapElement and never reaches compiledScene, so this leg
    // reads mapElements. Walls are re-checked afterwards to show the spline did
    // not simply land as another wall.
    await settle(page);
    const beforeSpline = await elements(page);
    await dock.getByRole("button", { name: /Tool/ }).click();
    await toolGrid.getByRole("button", { name: /^Spline$/ }).click();
    await page.getByRole("button", { name: /^Chain$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    await touchDrag(cdp, at(0.25, 0.8), [at(0.7, 0.8)]);
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBeGreaterThan(beforeSpline);
    expect(await walls(page)).toBe(afterHall);
  });

  test("a dial tool is usable at PHONE width, not just tablet width", async ({ page }) => {
    // The gap this closes: no test drove the authoring journey at 390. Hall is
    // the tool to prove it with, because it is the narrow case — it carries a
    // dial, so the sheet must STAY open and the width row must still be
    // operable in less than half the horizontal space the tablet gives it.
    test.setTimeout(150_000);
    const { toolGrid } = await armLiveMapEdit(page, PHONE);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    expect(await walls(page)).toBe(0); // positive control
    await toolGrid.getByRole("button", { name: /^Hall$/ }).click();

    // Reachable AND hittable: a control scrolled into view but sized under the
    // touch guideline is not usable, and at this width it is the one at risk.
    const widthRow = page.locator(".mobile-tool-sheet__section", { hasText: "Width (cells)" });
    const three = widthRow.getByRole("button", { name: "3", exact: true });
    await three.scrollIntoViewIfNeeded();
    const dial = (await three.boundingBox())!;
    expect(dial.height).toBeGreaterThanOrEqual(44);
    await three.click();

    await page.getByRole("button", { name: /To the map/i }).click();
    await touchDrag(cdp, at(0.2, 0.3), [at(0.8, 0.3)]);
    await expect.poll(() => walls(page), { timeout: 30_000 }).toBeGreaterThan(0);
  });

  test("POPULATE fills the room the DM just drew", async ({ page }) => {
    // The first end-to-end coverage POPULATE has ever had, on either layout.
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    const status = page.getByTestId("mobile-populate-status");
    const populate = page.getByRole("button", { name: /✨ Populate/i });

    // Nothing drawn yet: the footer says so, and the button refuses.
    await expect(status).toHaveText(/draw a room or hallway first/i);
    await expect(populate).toBeDisabled();

    // ---- draw a room ----
    await toolGrid.getByRole("button", { name: /^Room$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    await touchDrag(cdp, at(0.25, 0.3), [at(0.7, 0.65)]);
    await expect.poll(() => walls(page), { timeout: 30_000 }).toBeGreaterThan(0);
    await settle(page);

    // ---- the footer arms itself off that room ----
    const beforeFill = await elements(page);
    await dock.getByRole("button", { name: /Tool/ }).click();
    await expect(status).toHaveText(/just drew/i);
    await expect(populate).toBeEnabled();

    await populate.click();
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBeGreaterThan(beforeFill);

    // One fill per region: the target is consumed, so the footer goes back to
    // asking for a room rather than letting a second press stack an identical
    // scatter on the first.
    await expect(status).toHaveText(/draw a room or hallway first/i, { timeout: 15_000 });
    await expect(populate).toBeDisabled();
  });
});
