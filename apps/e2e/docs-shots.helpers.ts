import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "./fixtures";

// Shared plumbing for the documentation screenshot harness
// (docs-screenshots.*.ts, run via `pnpm docs:screenshots`). Not a test file.

export const IMG_DIR = path.resolve(process.cwd(), "docs", "user-guide", "img");

export function ensureImgDir() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
}

// Full-viewport JPEG. Screenshots are committed to the repo, so JPEG keeps the
// canvas-heavy captures an order of magnitude smaller than PNG.
export async function shotPage(page: Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(IMG_DIR, `${name}.jpg`),
    type: "jpeg",
    quality: 90,
    animations: "disabled",
  });
}

// Soft-step runner: a failed optional step records the failure and moves on so
// one broken capture doesn't lose the remaining screenshots. The caller
// asserts the collected failures at the end, so the run still fails loudly.
export function makeSteps() {
  const failures: string[] = [];
  async function step(
    name: string,
    fn: () => Promise<void>,
    opts: { required?: boolean } = {},
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      if (opts.required) {
        throw new Error(`Required step failed — ${failures.join("\n")}`);
      }
    }
  }
  return { step, failures };
}

// Map-edit tools are two-point drags; intermediate moves make the stage event
// router treat it as a genuine drag (same approach as the live-map smoke spec).
export async function dragBoard(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

// Freehand-style drag through a list of points (drawing tools, paint strokes).
export async function dragPath(page: Page, points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return;
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    await page.mouse.move(point.x, point.y, { steps: 6 });
  }
  await page.mouse.up();
}

export async function boardCenter(page: Page) {
  const box = await boardBox(page);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// The visible canvas strip. Floating chrome (map palette on the left, header
// above) still overlaps it, so authoring drags should stay right of ~270px
// from the left edge and inside the box vertically.
export async function boardBox(page: Page) {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

export async function hideEntitiesPanel(page: Page) {
  const hide = page.getByRole("button", { name: /HIDE ENTITIES/ });
  if (await hide.isVisible().catch(() => false)) {
    await hide.click();
    await page.waitForTimeout(300);
  }
}

export async function waitSnap(page: Page, predicate: () => boolean, timeout = 20_000) {
  await page.waitForFunction(predicate, undefined, { timeout });
}

// Let an in-flight map-studio command land and the terrain bake settle before
// capturing: the palette shows "saving…" while a command is outstanding and
// "loading…" while a create/open/bind round trip is, and a "Painting terrain…
// N%" chip tracks the local worker bake.
//
// Both labels are waited on because until M5 they were ONE span that rendered
// "saving…" off the BIND flag. So this helper has been waiting out the bind and
// never once waited for a command — the thing its own comment said it was for,
// and the 1.2s extraMs below was quietly covering the difference.
//
// exact on the new one: Playwright's default string match is a case-insensitive
// SUBSTRING, and both upload buttons render "Uploading…", which contains it.
export async function waitBake(page: Page, extraMs = 1_200) {
  await expect(page.getByText("saving…")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("loading…", { exact: true })).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(/Painting terrain/)).toBeHidden({ timeout: 30_000 });
  await page.waitForTimeout(extraMs);
}

// Compute a dungeon-generator region drag that is guaranteed valid: zooms out
// (verified against the live camera scale) until a ≥minCells×minCells block of
// POSITIVE world cells — clear of the authored content near the origin — fits
// inside the visible canvas, then returns the screen-space drag points.
export async function computeGenRegion(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  opts: { minCells?: number; clearCols?: number; clearRows?: number } = {},
) {
  const minCells = opts.minCells ?? 21;
  const clearCols = opts.clearCols ?? 16;
  const clearRows = opts.clearRows ?? 9;
  const anchor = { x: box.x + box.width / 2, y: box.y + 50 };
  await page.mouse.move(anchor.x, anchor.y);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const view = await page.evaluate(() => ({
      cam: window.__HERO_BYTE_E2E__?.cam ?? { x: 0, y: 0, scale: 1 },
      grid: window.__HERO_BYTE_E2E__?.snapshot?.gridSize ?? 50,
    }));
    const cellPx = view.grid * view.cam.scale;
    const worldColAt = (sx: number) => (sx - box.x - view.cam.x) / cellPx;
    const worldRowAt = (sy: number) => (sy - box.y - view.cam.y) / cellPx;
    const toScreen = (col: number, row: number) => ({
      x: box.x + view.cam.x + col * cellPx,
      y: box.y + view.cam.y + row * cellPx,
    });

    // Usable screen band: right of the floating palette, inside the canvas.
    const col1 = Math.max(clearCols, Math.ceil(worldColAt(box.x + 285)), 0);
    const row1 = Math.max(clearRows, Math.ceil(worldRowAt(box.y + 25)), 0);
    const col2 = Math.floor(worldColAt(box.x + box.width - 25));
    const row2 = Math.floor(worldRowAt(box.y + box.height - 25));

    if (col2 - col1 >= minCells && row2 - row1 >= minCells) {
      return { from: toScreen(col1, row1), to: toScreen(col2, row2) };
    }
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(80);
  }
  throw new Error("Could not zoom out far enough to fit a generator region");
}

// UI-driven DM elevation (screenshot-friendly path through the settings menu +
// password modal, unlike helpers.elevateToDM which injects a WS message).
export async function elevateViaUI(page: Page, opts: { onModal?: () => Promise<void> } = {}) {
  const dmPassword = process.env.E2E_DM_PASSWORD ?? "FunDM";
  // The gear button's accessible name is its emoji content, so target the
  // title attribute rather than a role+name query.
  await page.getByTitle("Open player settings").first().click();
  await page.getByRole("button", { name: /DM Mode: OFF/ }).click();
  const passwordField = page.locator("input[type='password']:visible").first();
  await expect(passwordField).toBeVisible();
  if (opts.onModal) await opts.onModal();
  await passwordField.fill(dmPassword);
  await page.getByRole("button", { name: "Elevate to DM" }).click();
  await expect(page.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 10_000 });
  await closeTopWindow(page, "Player Settings");
}

// Close the top-most draggable window by its × button. Tolerant by design:
// some windows close themselves (e.g. player settings after a DM status
// change), so finding no × is success, not an error.
export async function closeTopWindow(page: Page, _nearText?: string) {
  const closers = page.getByRole("button", { name: "×" });
  const count = await closers.count();
  if (count > 0) {
    await closers.last().click();
  }
}

export async function openDMMenu(page: Page) {
  const menuButton = page.getByRole("button", { name: /DM MENU/i });
  const heading = page.getByText("Dungeon Master Tools");
  if (!(await heading.isVisible().catch(() => false))) {
    await menuButton.click();
    await expect(heading).toBeVisible();
  }
}

export async function selectDMTab(
  page: Page,
  tab: "Map Setup" | "NPCs & Monsters" | "Props & Objects" | "Players" | "Session",
) {
  await openDMMenu(page);
  await page.getByRole("button", { name: tab }).click();
}

export async function startLiveMap(page: Page) {
  await page.getByTitle("Author the live map on the table").click();
  await page.getByRole("button", { name: /START LIVE MAP/i }).click();
  await waitSnap(page, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId));
  await expect(page.getByText("● LIVE")).toBeVisible();
}

// Aim the staging zone away from the world origin so joining players spawn
// inside the room the DM authors in the walkthrough (origin sits under the
// top-left chrome after a camera reset).
export async function setStagingZone(
  page: Page,
  zone: { x: number; y: number; w: number; h: number },
) {
  await selectDMTab(page, "Map Setup");
  await page.getByLabel("Center X").fill(String(zone.x));
  await page.getByLabel("Center Y").fill(String(zone.y));
  await page.getByLabel("Width (tiles)").fill(String(zone.w));
  await page.getByLabel("Height (tiles)").fill(String(zone.h));
  await page.getByRole("button", { name: "Apply Zone" }).click();
  // The staging zone may not surface under a stable key on the wire snapshot;
  // give the round trip a moment rather than pinning a field name.
  await page.waitForTimeout(800);
}
