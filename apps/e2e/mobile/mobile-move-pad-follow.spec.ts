/**
 * The phone pad no longer covers the piece it moves (follow-up F1). At 375×812
 * the selection sheet plus the dock is an opaque band over the bottom of the
 * map; a token walking ↓ used to walk under it — every press charged in
 * combat, nothing visible either way. Now a step that would put the token, or
 * the nameplate hanging below it, under the sheet's REAL top brings the
 * camera back on that axis only, placing the piece a lead inside the edge it
 * crossed so the next step scrolls one step's worth (a 120 ms glide); a step
 * in the middle of the open map moves the camera not at all.
 *
 * The sheet's, the strip's and the board's rects are measured
 * (getBoundingClientRect) and converted to the STAGE's frame (minus the
 * board's top-left); the token's is the PAINTED rect of its Konva node, read
 * after the glide and the node's tween settle — not the camera arithmetic
 * the feature itself uses.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { boardBox, joinMobileTable, readCam, selectMobileTool } from "./mobile.helpers";

/** The sprite's painted box in stage px (glow and stroke excluded). */
async function paintedRect(page: Page, sceneId: string) {
  // The camera glide is 120 ms and Konva's node tween ≤ 300 ms; a hidden tab
  // would freeze both, a visible one settles.
  await page.waitForTimeout(600);
  return page.evaluate((id) => {
    const konva = (
      window as unknown as { Konva?: { stages: Array<{ findOne: (s: string) => unknown }> } }
    ).Konva;
    const node = konva?.stages[0]?.findOne("#" + id) as
      | { getClientRect: (o: object) => { x: number; y: number; width: number; height: number } }
      | undefined;
    if (!node) throw new Error("token node not found: " + id);
    const r = node.getClientRect({ skipShadow: true, skipStroke: true });
    return { top: r.y, bottom: r.y + r.height, left: r.x, right: r.x + r.width };
  }, sceneId);
}

const rectTop = (page: Page, selector: string) =>
  page.evaluate((s) => document.querySelector(s)?.getBoundingClientRect().top ?? null, selector);
const rectBottom = (page: Page, selector: string) =>
  page.evaluate((s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? null, selector);

/** Which element a tap at a stage point would reach. */
const tapTarget = (page: Page, x: number, y: number, boardY: number) =>
  page.evaluate(
    ([px, py]) => {
      const element = document.elementFromPoint(px, py);
      return {
        tag: element?.tagName.toLowerCase() ?? null,
        inStrip: Boolean(element?.closest(".mobile-combat-strip")),
      };
    },
    [x, y + boardY],
  );

async function selectOwnToken(page: Page) {
  await selectMobileTool(page, /^Select$/i);
  const token = await page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__!;
    const own = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
    data.sendMessage!({ t: "select-object", uid: data.uid!, objectId: `token:${own.id}` });
    return { id: own.id, x: Math.round(own.x), y: Math.round(own.y), grid: data.gridSize! };
  });
  // The plate-vs-no-plate distinction the portrait case rides on holds for a
  // grid between 20 and 60px; the table's is 50.
  expect(token.grid).toBeGreaterThan(20);
  expect(token.grid).toBeLessThan(60);
  const pad = page.getByRole("group", { name: "Move selection" });
  await expect(pad).toBeVisible({ timeout: 5_000 });
  const board = await boardBox(page);
  const sheetTop = (await rectTop(page, ".mobile-selection-sheet"))! - board.y;
  return { token, pad, sheetTop, board };
}

const readCell = (page: Page, id: string) =>
  page.evaluate((tokenId) => {
    const own = window.__HERO_BYTE_E2E__!.snapshot!.tokens.find((t) => t.id === tokenId)!;
    return { x: own.x, y: own.y };
  }, id);

/** Waits for the follow to land: the camera's y left the parked value, then the glide ended. */
async function followedFrom(page: Page, parkedY: number) {
  await expect.poll(async () => (await readCam(page))!.y, { timeout: 5_000 }).not.toBe(parkedY);
  await page.waitForTimeout(300);
  return (await readCam(page))!;
}

test.describe("mobile — move pad camera follow", () => {
  test("portrait: a step under the sheet brings the token a lead inside the band's bottom, vertically only; a step in the open map leaves the camera alone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    const { token, pad, sheetTop, board } = await selectOwnToken(page);
    expect(sheetTop).toBeGreaterThan(0);
    expect(sheetTop).toBeLessThan(board.height);

    // PARK the token OFF-CENTRE horizontally (screen x 100), its cell 20px
    // above where the follow would fire — a finger pan never triggers the
    // follow (that is the design: re-panning against a finger would fight it).
    const g = token.grid;
    const parkedCellTop = sheetTop - 16 - 40 - 20 - g;
    expect(parkedCellTop).toBeGreaterThan(16); // the precondition is real, not assumed
    const parked = { x: 100 - (token.x + 0.5) * g, y: parkedCellTop - token.y * g, scale: 1 };
    await page.evaluate((cam) => window.__HERO_BYTE_E2E__!.setCam!(cam), parked);
    await expect.poll(() => readCam(page)).toEqual(parked);

    // One step ↓ puts the plate under the sheet: the token moves one cell and
    // the camera brings it back — y changes, x does NOT (the axis that stayed in).
    await pad.getByRole("button", { name: "Move down", exact: true }).tap();
    await expect
      .poll(() => readCell(page, token.id), { timeout: 5_000 })
      .toEqual({ x: token.x, y: token.y + 1 });
    const cam = await followedFrom(page, parked.y);
    expect(cam.x).toBe(parked.x);
    const rect = await paintedRect(page, `token:${token.id}`);
    // The cell's centre sits a LEAD (half a cell) inside the band's bottom:
    // sheetTop − 16 (pad) − 40 (plate) − g/2 (lead) − g/2 (half the cell). A
    // stage-centred placement (406) or a band-centred one (~214) both miss.
    expect((rect.top + rect.bottom) / 2).toBeCloseTo(sheetTop - 56 - g, 0);
    expect(rect.bottom + 36).toBeLessThan(sheetTop);
    expect((rect.left + rect.right) / 2).toBeCloseTo(100, 0);

    // A step ↑ from there: the token moves, the camera does not — a follow
    // that pans on every press is a different bug.
    await pad.getByRole("button", { name: "Move up", exact: true }).tap();
    await expect
      .poll(() => readCell(page, token.id), { timeout: 5_000 })
      .toEqual({ x: token.x, y: token.y });
    await page.waitForTimeout(500);
    expect(await readCam(page)).toEqual(cam);
  });

  test("landscape: the one-row pad leaves room for the token AND its plate above the sheet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    await joinMobileTable(page);
    const { token, pad, sheetTop } = await selectOwnToken(page);
    const g = token.grid;
    // Room for cell + plate inside the pads (the one-row fold bought it), but
    // not for a lead as well — so the piece is centred with its plate.
    expect(sheetTop - 32).toBeGreaterThanOrEqual(g + 40);
    expect(sheetTop - 32).toBeLessThan(2 * g + 40);
    const parked = { x: 406 - (token.x + 0.5) * g, y: 16 - token.y * g, scale: 1 };
    await page.evaluate((cam) => window.__HERO_BYTE_E2E__!.setCam!(cam), parked);
    await expect.poll(() => readCam(page)).toEqual(parked);

    await pad.getByRole("button", { name: "Move down", exact: true }).tap();
    await expect
      .poll(() => readCell(page, token.id), { timeout: 5_000 })
      .toEqual({ x: token.x, y: token.y + 1 });
    const cam = await followedFrom(page, parked.y);
    expect(cam.x).toBe(parked.x);
    const rect = await paintedRect(page, `token:${token.id}`);
    // Centred with the plate in [16, sheetTop − 16]: centre (sheetTop − 40) / 2.
    expect((rect.top + rect.bottom) / 2).toBeCloseTo((sheetTop - 40) / 2, 0);
    expect(rect.bottom + 36).toBeLessThan(sheetTop);
  });

  test("landscape in combat: the strip leaves no room below it, so the token sits over the strip's gap — still tappable, never behind the sheet", async ({
    page,
    browser,
  }) => {
    const dmContext = await browser.newContext();
    const dm = await dmContext.newPage();
    const send = (message: unknown) =>
      dm.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);
    const combatActive = () =>
      dm.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.combatActive === true);
    try {
      await joinMobileTable(dm);
      await elevateToDM(dm);
      await page.setViewportSize({ width: 812, height: 375 });
      await joinMobileTable(page);
      const { token, pad, sheetTop, board } = await selectOwnToken(page);
      const g = token.grid;
      await send({ t: "start-combat" });
      await expect.poll(combatActive, { timeout: 5_000 }).toBe(true);
      try {
        await expect(page.locator(".mobile-combat-strip")).toBeVisible({ timeout: 5_000 });
        const stripBottom = (await rectBottom(page, ".mobile-combat-strip"))! - board.y;
        // Below the strip there is no room for the cell inside the pads.
        expect(sheetTop - 16 - (stripBottom + 16)).toBeLessThan(g);

        const parked = { x: 406 - (token.x + 0.5) * g, y: 16 - token.y * g, scale: 1 };
        await page.evaluate((cam) => window.__HERO_BYTE_E2E__!.setCam!(cam), parked);
        await expect.poll(() => readCam(page)).toEqual(parked);
        await pad.getByRole("button", { name: "Move down", exact: true }).tap();
        await expect
          .poll(() => readCell(page, token.id), { timeout: 5_000 })
          .toEqual({ x: token.x, y: token.y + 1 });
        await followedFrom(page, parked.y);
        const rect = await paintedRect(page, `token:${token.id}`);
        // The strip is given up, not the sheet: centred with the plate as in
        // plain landscape, over the strip's transparent gap.
        expect((rect.top + rect.bottom) / 2).toBeCloseTo((sheetTop - 40) / 2, 0);
        expect(rect.top).toBeLessThan(stripBottom);
        expect(rect.bottom + 36).toBeLessThan(sheetTop);
        // And a tap there reaches the MAP, not the strip's box (its gap lets
        // taps through; only its buttons take them).
        const target = await tapTarget(page, 406, (rect.top + rect.bottom) / 2, board.y);
        expect(target).toEqual({ tag: "canvas", inStrip: false });
      } finally {
        await send({ t: "end-combat" }).catch(() => undefined);
        await expect.poll(combatActive, { timeout: 5_000 }).toBe(false);
      }
    } finally {
      await dmContext.close();
    }
  });
});
