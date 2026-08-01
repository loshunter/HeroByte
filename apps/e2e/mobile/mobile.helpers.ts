/**
 * Mobile-layout entry helpers.
 *
 * The shared `joinDefaultRoom` in ../helpers.ts is NOT mobile-safe: it waits
 * for the desktop header's "Snap" button, which on a phone lives inside the
 * tool sheet and is not rendered until the sheet is open.
 */
import { expect, type Page } from "@playwright/test";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

/**
 * Enter the default table on the mobile layout.
 *
 * `?mobile=true` short-circuits the media-query path in App.tsx so the layout
 * choice is deterministic rather than dependent on the device descriptor.
 */
export async function joinMobileTable(page: Page): Promise<void> {
  await page.goto("/?mobile=true");

  const passwordInput = page.getByPlaceholder("Table password");
  await expect(passwordInput).toBeEnabled({ timeout: 15_000 });
  await passwordInput.fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Table/i }).click();

  await expect(page.getByRole("button", { name: /Tools/i })).toBeVisible({ timeout: 15_000 });

  // MapBoard is lazy-loaded behind Suspense — the canvas is not a given.
  await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(() => {
    const data = window.__HERO_BYTE_E2E__;
    return Boolean(data?.snapshot && data.uid && data.cam);
  });
}

/** Pick a tool from the mobile dock's tool sheet. The sheet auto-closes on pick. */
export async function selectMobileTool(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name: /Tools/i }).click();
  await page.getByRole("button", { name }).click();
}

/** Absolute viewport-space box of the Konva canvas. */
export async function boardBox(page: Page) {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

export async function readCam(page: Page) {
  return page.evaluate(() => {
    const cam = window.__HERO_BYTE_E2E__?.cam;
    return cam ? { x: cam.x, y: cam.y, scale: cam.scale } : null;
  });
}

export async function readDrawings(page: Page) {
  return page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    const drawings = data?.snapshot?.drawings ?? [];
    const last = drawings.at(-1);
    return {
      count: drawings.length,
      uid: data?.uid ?? null,
      lastType: last?.type ?? null,
      lastOwner: last?.owner ?? null,
      lastPointCount: Array.isArray(last?.points) ? last.points.length : 0,
    };
  });
}
