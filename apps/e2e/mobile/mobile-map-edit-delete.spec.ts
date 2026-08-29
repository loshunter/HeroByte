/**
 * SELECT + DELETE by finger — the phone's only route to removing one element.
 *
 * Three things here are load-bearing rather than cosmetic:
 *   - the TAP is the point. Everything else in this mode is a drag, and a drag
 *     produces no compatibility mouse events while a tap does. Selection rides
 *     that compat path — `useStageEventRouter` binds mousedown unconditionally
 *     and each handler self-gates — and CDP's touch dispatch produces it, so
 *     the phone's real mechanism is what CI exercises. Nothing in
 *     `useArmedTouchTool` is involved: select is deliberately NOT armed on the
 *     touch path (verified by disabling an experimental arm and watching this
 *     spec stay green), which is also why it cannot double-fire the way the
 *     click tools would;
 *   - the target is a Row's STAMP, located by reading the document rather than
 *     by aiming at the drag. When this spec was written a wall could not be
 *     selected at ALL — `selectElementAtPoint` resolved tiles, stamps and
 *     shapes only — and a Room was no good either, since its floor is terrain
 *     and its walls are filtered out of `mapElements`. Proximity hit testing
 *     has since made every kind selectable, so a wall would work now; the stamp
 *     stays because reading the element's real position out of the document
 *     beats aiming at a drag whose jitter is deliberate;
 *   - `test`/`expect` come from `../fixtures`, NOT `@playwright/test` — the
 *     resetRoom fixture rides on that import, and without it this spec inherits
 *     whatever the previous file left in the room and the counts drift.
 *
 * e2e specs are NOT exempt from the 350-LOC structure guard: the exemption is
 * the filename substring `.test.`, and this is a `.spec.`.
 */

import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag, touchTap } from "./touch.helpers";

const elements = (page: Page) =>
  page.evaluate(
    () =>
      window.__HERO_BYTE_E2E__?.snapshot?.mapElements?.layers?.reduce(
        (total, layer) => total + layer.elements.length,
        0,
      ) ?? 0,
  );

/**
 * Viewport position of the first SELECTABLE element, read from the live
 * document rather than guessed from the drag.
 *
 * Guessing is what the first two cuts of this spec did, and Row is the reason
 * the remaining one still would be: it scatters its stamps along the drag with
 * deliberate jitter and gaps, so the drag midpoint is not where a stamp is. The
 * seam already carries the answer.
 *
 * `mapElements` is the privacy-filtered projection — the visible art, with the
 * walls dropped. That used to mirror what `selectElementAtPoint` resolved; it
 * NO LONGER DOES, since proximity hit testing made walls selectable on the
 * canvas while they are still absent from this projection. So this helper can
 * only aim at what `mapElements` carries, which is why the target is a stamp.
 * Element transforms are document PIXELS (unlike tokens, which are cells), so
 * the cell-size multiply the token helper needs is absent here.
 *
 * Aims the element's CENTRE, not its transform origin. `transform.x/y` is the
 * top-LEFT, and the hit test is an inclusive bounds check — tapping the exact
 * corner lands on the boundary and is one rounding error from missing, which is
 * how this read as "selection is broken" when only the aim was.
 */
async function firstElementScreenPos(page: Page): Promise<{ x: number; y: number } | null> {
  const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
  const local = await page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    const cam = data?.cam;
    const gridSize = data?.gridSize ?? 0;
    const layers = data?.snapshot?.mapElements?.layers ?? [];
    const element = layers.flatMap((layer) => layer.elements)[0] as
      | {
          type?: string;
          transform?: { x: number; y: number; scaleX: number; scaleY: number };
          data?: { width?: number; height?: number; columns?: number; rows?: number };
        }
      | undefined;
    if (!element?.transform || !cam) return null;
    const t = element.transform;
    const d = element.data ?? {};
    const w =
      element.type === "tile" ? (d.columns ?? 1) * gridSize * t.scaleX : (d.width ?? 0) * t.scaleX;
    const h =
      element.type === "tile" ? (d.rows ?? 1) * gridSize * t.scaleY : (d.height ?? 0) * t.scaleY;
    return {
      x: (t.x + w / 2) * cam.scale + cam.x,
      y: (t.y + h / 2) * cam.scale + cam.y,
    };
  });
  return local ? { x: box.x + local.x, y: box.y + local.y } : null;
}

/**
 * A tool's onMouseUp SKIPS the commit while a command is still in flight and
 * does NOT retry, so a gesture started too soon after the last one is silently
 * dropped. Same wait, for the same reason, as the sibling specs.
 */
const settle = (page: Page) => page.waitForTimeout(800);

const doorState = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.[0]?.state ?? null);

/**
 * Screen position of the first compiled door's midpoint. Doors never reach the
 * mapElements projection (the privacy filter drops the wall family), so the
 * stamp helper above cannot aim here — but the compiled scene carries the
 * endpoints in document pixels, and the camera math is the same.
 */
async function firstDoorScreenPos(page: Page): Promise<{ x: number; y: number } | null> {
  const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
  const local = await page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    const cam = data?.cam;
    const door = data?.snapshot?.compiledScene?.doors?.[0];
    if (!door || !cam) return null;
    return {
      x: ((door.x1 + door.x2) / 2) * cam.scale + cam.x,
      y: ((door.y1 + door.y2) / 2) * cam.scale + cam.y,
    };
  });
  return local ? { x: box.x + local.x, y: box.y + local.y } : null;
}

/** Armed, live, and with the sheet CLOSED so the canvas is uncovered. */
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
  await expect(page.locator(".mobile-tool-sheet__grid")).toBeVisible({ timeout: 30_000 });
}

/** Arms a tool from the sheet and uncovers the canvas. Room keeps the sheet
 * open (it has dials), so closing is explicit rather than assumed. */
async function armAndClose(page: Page, name: RegExp): Promise<void> {
  const dock = page.getByRole("navigation", { name: /Map edit actions/i });
  if (!(await page.locator(".mobile-tool-sheet").isVisible())) {
    await dock.getByRole("button", { name: /Tool/ }).click();
  }
  await page.locator(".mobile-tool-sheet__grid").getByRole("button", { name }).click();
  if (await page.locator(".mobile-tool-sheet").isVisible()) {
    await page.getByRole("button", { name: /Close tools/i }).click();
  }
  await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
}

test.describe("mobile map edit — select and delete", () => {
  test("a DM taps a floor tile on the phone and deletes it, then authors again", async ({
    page,
  }) => {
    // A tablet: the width a DM would author on, and wide enough that the open
    // sheet still leaves the upper canvas clear for the tap.
    await page.setViewportSize({ width: 820, height: 1180 });
    await enterLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    // Anchor by canvas FRACTION: an exact world delta at an unknown camera
    // walks the drag clean off the canvas. Kept in the upper third so the
    // bottom sheet — which STAYS open under Select — never covers the target.
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    // ---- author with Row: it lays STAMPS, which are what this spec can AIM at.
    // A Room is no good here — its floor is terrain and its walls never reach
    // the mapElements projection, so there is nothing to read a position from,
    // even though a wall is perfectly selectable by hand now. ----
    await armAndClose(page, /^Row$/);
    await touchDrag(cdp, at(0.28, 0.22), [at(0.66, 0.22)]);
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBeGreaterThan(0);
    await settle(page);
    const authored = await elements(page);
    const target = await firstElementScreenPos(page);
    expect(target, "no selectable element was authored").not.toBeNull();

    // ---- arm Select; the sheet must STAY open, because its panel is the
    // readout and the delete button both ----
    const dock = page.getByRole("navigation", { name: /Map edit actions/i });
    await dock.getByRole("button", { name: /Tool/ }).click();
    await page
      .locator(".mobile-tool-sheet__grid")
      .getByRole("button", { name: /^Select$/ })
      .click();
    await expect(page.locator(".mobile-tool-sheet")).toBeVisible();

    const status = page.getByTestId("mobile-select-status");
    const del = page.getByTestId("mobile-select-delete");
    await expect(status).toHaveText(/tap an element/i);
    await expect(del).toBeDisabled();

    // ---- the tap that is the whole point ----
    await touchTap(cdp, target!);
    await expect(status).toHaveText(/picked/i, { timeout: 10_000 });
    await expect(del).toBeEnabled();

    await del.click();
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBeLessThan(authored);
    // Selection is re-derived from the live document, so it clearing is itself
    // proof the delete round-tripped rather than the button merely firing.
    await expect(status).toHaveText(/tap an element/i, { timeout: 10_000 });
    await expect(del).toBeDisabled();

    // ---- not sticky: authoring still works afterwards ----
    // Delete leaving the mode wedged would be invisible to the assertions above
    // and would strand a DM who deleted one thing mid-session.
    await settle(page);
    const afterDelete = await elements(page);
    await armAndClose(page, /^Row$/);
    await touchDrag(cdp, at(0.28, 0.62), [at(0.66, 0.62)]);
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBeGreaterThan(afterDelete);
  });

  test("a tap on empty canvas clears the selection rather than deleting blind", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await enterLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    await armAndClose(page, /^Row$/);
    await touchDrag(cdp, at(0.28, 0.22), [at(0.62, 0.22)]);
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBeGreaterThan(0);
    await settle(page);
    const authored = await elements(page);
    const target = (await firstElementScreenPos(page))!;

    const dock = page.getByRole("navigation", { name: /Map edit actions/i });
    await dock.getByRole("button", { name: /Tool/ }).click();
    await page
      .locator(".mobile-tool-sheet__grid")
      .getByRole("button", { name: /^Select$/ })
      .click();

    const status = page.getByTestId("mobile-select-status");
    await touchTap(cdp, target);
    await expect(status).toHaveText(/picked/i, { timeout: 10_000 });

    // Miss the stamp by a wide margin: the readout must fall back to the prompt
    // and DELETE must go cold, or a stale selection is one tap from deleting
    // something the DM can no longer see highlighted.
    //
    // The empty point is derived from the SHEET rather than written as a
    // fraction of the canvas. A fixed 0.48 cleared the sheet's top edge by
    // ~20px until M7 added three tiles and a fourth grid row; the tap then
    // landed on the sheet, the selection never cleared, and the failure read as
    // a selection bug rather than a layout one. Anything above the sheet is a
    // point the finger can actually reach.
    const sheetTop = (await page.locator(".mobile-tool-sheet").boundingBox())!.y;
    const emptyY = sheetTop - 80;
    expect(emptyY).toBeGreaterThan(box.y + 40); // the miss must still be ON the map
    await touchTap(cdp, { x: box.x + box.width * 0.88, y: emptyY });
    await expect(status).toHaveText(/tap an element/i, { timeout: 10_000 });
    await expect(page.getByTestId("mobile-select-delete")).toBeDisabled();
    expect(await elements(page)).toBe(authored);
  });

  test("a tap ON a door selects it instead of swinging it open", async ({ page }) => {
    // The door sprite's hit line is a listening Konva shape, and Konva
    // preventDefaults the touchstart on listening shapes — which kills the
    // compat mouse pair Select resolves on. So a tap landing dead-on a door
    // (its 18px hit band is the natural finger target) toggled the door and
    // could never pick it. While Select is armed the line now yields the press
    // to the stage, and proximity selection resolves the door.
    await page.setViewportSize({ width: 820, height: 1180 });
    await enterLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    // ---- author a door; it compiles closed ----
    await armAndClose(page, /^Door$/);
    await touchDrag(cdp, at(0.3, 0.2), [at(0.5, 0.2)]);
    await expect.poll(() => doorState(page), { timeout: 30_000 }).toBe("closed");
    await settle(page);
    const target = await firstDoorScreenPos(page);
    expect(target, "no compiled door to aim at").not.toBeNull();

    // ---- arm Select; its panel is the readout ----
    const dock = page.getByRole("navigation", { name: /Map edit actions/i });
    await dock.getByRole("button", { name: /Tool/ }).click();
    await page
      .locator(".mobile-tool-sheet__grid")
      .getByRole("button", { name: /^Select$/ })
      .click();
    const status = page.getByTestId("mobile-select-status");
    await expect(status).toHaveText(/tap an element/i);

    // ---- the dead-on tap ----
    await touchTap(cdp, target!);
    await expect(status).toHaveText(/Door/i, { timeout: 10_000 });
    // And the door did NOT swing: selecting and toggling are different verbs.
    expect(await doorState(page)).toBe("closed");
  });
});
