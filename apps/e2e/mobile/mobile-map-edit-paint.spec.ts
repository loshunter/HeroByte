/**
 * M6 — Paint and Erase driven by a finger.
 *
 * `VISION.md:46` promises touch map painting, and until this slice the two
 * brushes were the one tool class a phone could not reach: M4c armed the DRAG
 * class only, so Paint and Erase had no tile and the touch path refused to arm
 * them.
 *
 * The observable is `snapshot.mapTerrain` — the terrain the SERVER published to
 * the table, not a client draft. Each leg reads it BEFORE the gesture as a
 * positive control, because "terrain appeared" is satisfied by a build where
 * painting never worked but something else had already painted.
 *
 * The third test is the one that pays for the arming decision. A touch DRAG
 * generates no compatibility mouse events but a TAP generates a full pair, and
 * the mouse path routes to the same handlers — so a tap would run the brush
 * twice and cost two undo steps for one cell. It counts the `paint-terrain`
 * commands on the wire, which is the only place that doubling is visible: both
 * commands paint the same cell, so the terrain looks identical either way.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag, touchTap } from "./touch.helpers";

const PHONE = { width: 390, height: 844 };

/** Painted cells, counted off the published terrain's RLE runs. A run pair is
 * (value, length); only non-zero values are painted. */
const paintedCells = (page: Page) =>
  page.evaluate(() => {
    const terrain = window.__HERO_BYTE_E2E__?.snapshot?.mapTerrain?.terrain;
    if (!terrain) return 0;
    let total = 0;
    for (const runs of Object.values(terrain.chunks)) {
      for (let i = 0; i < runs.length; i += 2) {
        if (runs[i] !== 0) total += runs[i + 1]!;
      }
    }
    return total;
  });

/** A DM on a phone, in map-edit, with a live document bound. */
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
  const toolGrid = page.locator(".mobile-tool-sheet__grid");
  await expect(toolGrid).toBeVisible({ timeout: 30_000 });
  return { dock, toolGrid };
}

/**
 * A tool's onMouseUp skips its commit while a command is still in flight and
 * does NOT retry, so a gesture started too soon after the last one is dropped
 * in silence. Same wait, for the same reason, as the sibling map-edit specs.
 */
const settle = (page: Page) => page.waitForTimeout(800);

test.describe("M6 — a finger paints", () => {
  test("Paint lays terrain down and Erase takes it back", async ({ page }) => {
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    // ---- PAINT ----
    expect(await paintedCells(page)).toBe(0); // positive control
    await toolGrid.getByRole("button", { name: /^Paint$/ }).click();
    // Paint carries the family picker, so the sheet STAYS open. Choosing a
    // shelf and a family is the touch answer to the desktop deck's hover card.
    const paintSection = page.locator(".mobile-tool-sheet__section", { hasText: "Paint" });
    await expect(paintSection).toBeVisible();
    await page.getByRole("button", { name: /To the map/i }).click();

    await touchDrag(cdp, at(0.25, 0.35), [at(0.75, 0.35)]);
    await expect.poll(() => paintedCells(page), { timeout: 30_000 }).toBeGreaterThan(0);
    const painted = await paintedCells(page);

    // ---- ERASE ----
    await settle(page);
    await dock.getByRole("button", { name: /Tool/ }).click();
    await toolGrid.getByRole("button", { name: /^Erase$/ }).click();
    // Erase takes no argument, so it closes the sheet and puts the DM on the
    // map — the difference from Paint, and the reason PANEL_TOOLS holds one
    // and not the other.
    await expect(page.locator(".mobile-tool-sheet")).toBeHidden();

    // The same line, wider at both ends so a cell the paint drag clipped is
    // certainly covered.
    await touchDrag(cdp, at(0.2, 0.35), [at(0.8, 0.35)]);
    await expect.poll(() => paintedCells(page), { timeout: 30_000 }).toBeLessThan(painted);
  });

  test("a brush tap paints once, not once per input path", async ({ page }) => {
    test.setTimeout(150_000);
    const { toolGrid } = await armLiveMapEdit(page);

    // Count paint-terrain commands on the wire. The doubling this guards
    // against is invisible in the terrain — both commands paint the same cell —
    // so the socket is the only place it shows.
    await page.evaluate(() => {
      const w = window as unknown as { __paintCommands?: number };
      w.__paintCommands = 0;
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (this: WebSocket, data: Parameters<typeof send>[0]) {
        if (typeof data === "string" && data.includes('"paint-terrain"')) {
          w.__paintCommands = (w.__paintCommands ?? 0) + 1;
        }
        return send.call(this, data);
      };
    });

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);

    await toolGrid.getByRole("button", { name: /^Paint$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();

    await touchTap(cdp, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.4 });

    // The cell has to actually land — otherwise a count of zero would pass the
    // assertion below while proving nothing.
    await expect.poll(() => paintedCells(page), { timeout: 30_000 }).toBeGreaterThan(0);
    // Give the compat pair every chance to arrive late before reading.
    await settle(page);

    const commands = await page.evaluate(
      () => (window as unknown as { __paintCommands?: number }).__paintCommands ?? 0,
    );
    expect(commands).toBe(1);
  });
});
