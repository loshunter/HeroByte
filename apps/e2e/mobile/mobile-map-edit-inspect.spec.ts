/**
 * M8's remainder — editing what is already on the map, and the layer stack.
 *
 * Two surfaces that were desktop-only, and one of them is not a convenience:
 * **the Lighting layer's opacity IS the ambient light** — 1 is day, lower is
 * night, and torch pools only glow once it drops — so a DM authoring on a
 * tablet could place lights and never turn the lights down.
 *
 * BOTH ARE DISCLOSURES, and the tests assert that too. The sheet is
 * bottom-anchored and every row it grows is map the DM can no longer tap.
 *
 * On the SIZE these run at. Select keeps the sheet open, because the readout
 * and DELETE both live in it — so the target has to be map the sheet is not
 * covering, which on an 820x1180 tablet is the upper third and on a 390x844
 * phone is nothing at all (measured: the sheet spans y 79..742 of 844). The
 * sibling delete spec made the same choice for the same reason. The phone is
 * not abandoned, though, and the second test is the proof: closing the sheet,
 * tapping, and reopening keeps the selection, which is a real two-extra-taps
 * workflow rather than a gap.
 *
 * The observables are the server's — `mapElements` for a transform, its
 * `lighting.ambient` for the layer opacity — never a control's own state. A
 * slider wired to nothing looks identical to one wired to something.
 */
import { expect, test } from "../fixtures";
import { armLiveMapEdit, firstElementScreenPos, placedElements } from "./mobile.helpers";
import { openTouch, touchTap } from "./touch.helpers";

type Page = Parameters<typeof placedElements>[0];

const TABLET = { width: 820, height: 1180 };

/** A tool's commit is SKIPPED while a command is in flight and is not retried. */
const settle = (page: Page) => page.waitForTimeout(800);

/** Ambient light, which the snapshot omits entirely at plain daylight. */
const ambient = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.mapElements?.lighting?.ambient ?? 1);

/** Place one object in the UPPER third, where the open sheet is not covering
 * it, and return its screen centre. Not the point that placed it: a tile snaps
 * to the nearest cell corner, so that point is outside the tile it made. */
async function placeAndPick(
  page: Page,
  dock: ReturnType<Page["getByRole"]>,
  toolGrid: ReturnType<Page["locator"]>,
) {
  const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
  const cdp = await openTouch(page);

  await toolGrid.getByRole("button", { name: /^Place$/ }).click();
  await page.getByRole("button", { name: /To the map/i }).click();
  await touchTap(cdp, { x: box.x + box.width * 0.45, y: box.y + box.height * 0.12 });
  await expect.poll(async () => (await placedElements(page)).length, { timeout: 30_000 }).toBe(1);

  await settle(page);
  await dock.getByRole("button", { name: /Tool/ }).click();
  await toolGrid.getByRole("button", { name: /^Select$/ }).click();
  const target = (await firstElementScreenPos(page))!;
  const sheetTop = (await page.locator(".mobile-tool-sheet").boundingBox())!.y;
  // If this ever fails, the sheet grew over the target and the tap below would
  // press a tool tile instead — which reads as "selection is broken".
  expect(target.y, "the element is under the sheet, so it cannot be tapped").toBeLessThan(
    sheetTop - 20,
  );
  await touchTap(cdp, target);
  await expect(page.getByTestId("mobile-select-status")).toHaveText(/picked/i, { timeout: 10_000 });
  return { cdp, box };
}

test.describe("M8 — the inspector and the layer stack", () => {
  test("Edit turns a placed object, and the table receives the new angle", async ({ page }) => {
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page, TABLET);
    expect((await placedElements(page)).length).toBe(0); // positive control
    await placeAndPick(page, dock, toolGrid);
    expect((await placedElements(page))[0]!.rotation).toBe(0); // positive control

    // Closed by default: picking a thing in order to delete it must not pay
    // for an editor nobody opened.
    await expect(page.getByTestId("mobile-inspector")).toBeHidden();
    await page.getByTestId("mobile-inspector-toggle").click();
    await expect(page.getByTestId("mobile-inspector")).toBeVisible();

    const clockwise = page.getByRole("button", { name: /Turn element clockwise/i });
    await clockwise.click();
    await clockwise.click();
    await page.getByTestId("mobile-inspector-apply").click();

    await expect
      .poll(async () => (await placedElements(page))[0]?.rotation, { timeout: 30_000 })
      .toBe(30);
    // Applying EDITS the element rather than adding one.
    expect(await placedElements(page)).toHaveLength(1);
  });

  test("a phone keeps the selection across closing and reopening the sheet", async ({ page }) => {
    // The phone's whole workflow, and the reason Select is not simply
    // tablet-only: the sheet covers the map at 390px, so the DM closes it,
    // taps, and reopens. If the selection did not survive that, there would be
    // no way to pick anything on a phone at all.
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    await toolGrid.getByRole("button", { name: /^Place$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    await touchTap(cdp, { x: box.x + box.width * 0.45, y: box.y + box.height * 0.3 });
    await expect.poll(async () => (await placedElements(page)).length, { timeout: 30_000 }).toBe(1);

    await settle(page);
    await dock.getByRole("button", { name: /Tool/ }).click();
    await toolGrid.getByRole("button", { name: /^Select$/ }).click();
    await expect(page.getByTestId("mobile-select-status")).toHaveText(/tap an element/i);

    await page.locator(".mobile-tool-sheet__close").click();
    await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
    await touchTap(cdp, (await firstElementScreenPos(page))!);

    await dock.getByRole("button", { name: /Tool/ }).click();
    await expect(page.getByTestId("mobile-select-status")).toHaveText(/picked/i, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("mobile-inspector-toggle")).toBeVisible();
    await expect(page.getByTestId("mobile-select-delete")).toBeEnabled();
  });

  test("Layers dims the Lighting layer, which is how a touch DM makes it night", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const { toolGrid } = await armLiveMapEdit(page, TABLET);
    await expect(toolGrid).toBeVisible();

    // Closed by default, for the same reason as the inspector: this footer
    // rides under every tool, not just one.
    await expect(page.getByTestId("mobile-layers")).toBeHidden();
    await page.getByTestId("mobile-layers-toggle").click();
    await expect(page.getByTestId("mobile-layers")).toBeVisible();

    expect(await ambient(page)).toBe(1); // positive control: a live map starts as day

    await page.getByRole("slider", { name: /Lighting opacity/i }).fill("0.2");

    await expect.poll(() => ambient(page), { timeout: 30_000 }).toBeCloseTo(0.2, 2);
  });

  test("every control in both panels clears the 44px touch floor", async ({ page }) => {
    // These panels introduce the sheet's first NATIVE controls — a select and a
    // range input — and neither inherits the floor from
    // .mobile-tool-sheet__button. A range in particular passes a bounding-box
    // audit while being a 4px line to actually drag.
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page, TABLET);
    await placeAndPick(page, dock, toolGrid);
    await page.getByTestId("mobile-inspector-toggle").click();
    await page.getByTestId("mobile-layers-toggle").click();

    const tooSmall = await page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>(".mobile-tool-sheet");
      if (!sheet) return ["no sheet"];
      return [...sheet.querySelectorAll<HTMLElement>("button, select, input[type='range']")]
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          // Zero height means clipped out of the scroller, not undersized.
          return rect.height > 0 && (rect.height < 44 || rect.width < 44);
        })
        .map(
          (control) =>
            `${control.tagName}:${(control.getAttribute("aria-label") ?? control.textContent ?? "?").trim().slice(0, 24)}`,
        );
    });

    expect(tooSmall, `controls under the 44px floor: ${tooSmall.join(", ")}`).toEqual([]);
  });
});
