/**
 * Mobile-layout entry helpers.
 *
 * The shared `joinDefaultRoom` in ../helpers.ts is NOT mobile-safe: it waits
 * for the desktop header's "Snap" button, which on a phone lives inside the
 * tool sheet and is not rendered until the sheet is open.
 */
import { expect, type Page } from "@playwright/test";
import { elevateToDM } from "../helpers";
import type { Pt } from "./touch.helpers";

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

/**
 * Absolute viewport position of the first token, so a marquee can be aimed at
 * something that is actually there rather than at a guessed region.
 *
 * token.x/y are cells on the live lattice with origin at world 0,0, so
 * world = cell * gridSize, and screen = world * cam.scale + cam offset.
 */
export async function firstTokenScreenPos(page: Page): Promise<Pt | null> {
  const box = await boardBox(page);
  const local = await page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    const token = data?.snapshot?.tokens?.[0];
    const cam = data?.cam;
    const gridSize = data?.gridSize;
    if (!token || !cam || !gridSize) return null;
    return {
      x: token.x * gridSize * cam.scale + cam.x,
      y: token.y * gridSize * cam.scale + cam.y,
    };
  });

  return local ? { x: box.x + local.x, y: box.y + local.y } : null;
}

/**
 * A marquee drag box that contains the first token AND stays inside the canvas.
 *
 * The default table puts the player's token at cell (0,0) with the camera at
 * the origin, i.e. the very top-left corner — so a naive "token ± 70" box
 * starts at -70 and never lands on the canvas at all.
 */
export async function marqueeBoxAroundFirstToken(
  page: Page,
  pad = 90,
): Promise<{ from: Pt; to: Pt } | null> {
  const token = await firstTokenScreenPos(page);
  if (!token) return null;
  const box = await boardBox(page);

  const clampX = (v: number) => Math.min(Math.max(v, box.x + 4), box.x + box.width - 4);
  const clampY = (v: number) => Math.min(Math.max(v, box.y + 4), box.y + box.height - 4);

  return {
    from: { x: clampX(token.x - pad), y: clampY(token.y - pad) },
    to: { x: clampX(token.x + pad), y: clampY(token.y + pad) },
  };
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

/**
 * A DM on a touch device, in map-edit, with a live document bound.
 *
 * Lives here because a fourth map-edit spec was about to copy it. The earlier
 * copies differ only in viewport and in whether they return the dock, which is
 * exactly the kind of near-duplicate that drifts — one of them gaining a wait
 * the others need is invisible until the others start flaking. New map-edit
 * specs should take this one; the older copies are left where they are rather
 * than rewritten under a slice that is not about them.
 */
export async function armLiveMapEdit(
  page: Page,
  viewport: { width: number; height: number } = { width: 390, height: 844 },
) {
  await page.setViewportSize(viewport);
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

/** Every element the table can see, with the field the drop MODE decides. */
export const placedElements = (page: Page) =>
  page.evaluate(
    () =>
      window.__HERO_BYTE_E2E__?.snapshot?.mapElements?.layers?.flatMap((layer) =>
        layer.elements.map((element) => ({
          type: element.type,
          rotation: element.transform.rotation ?? 0,
        })),
      ) ?? [],
  );

/**
 * The screen centre of the first placed element.
 *
 * A sample or a selection has to land INSIDE what it is aiming at, and the
 * point you clicked to PLACE a tile is not inside it: a tile snaps to the
 * NEAREST cell corner, so a tap at doc (176, 295) with a 50px grid puts the
 * tile at (200, 300) covering [200,250)x[300,350) — 24px away in x. Measured,
 * after a first version of the eyedropper spec tapped where it had placed and
 * sampled nothing at all.
 */
export async function firstElementScreenPos(page: Page): Promise<Pt | null> {
  const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
  const local = await page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    const cam = data?.cam;
    const gridSize = data?.gridSize ?? 0;
    const element = (data?.snapshot?.mapElements?.layers ?? []).flatMap(
      (layer) => layer.elements,
    )[0] as
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
    return { x: (t.x + w / 2) * cam.scale + cam.x, y: (t.y + h / 2) * cam.scale + cam.y };
  });
  return local ? { x: box.x + local.x, y: box.y + local.y } : null;
}
