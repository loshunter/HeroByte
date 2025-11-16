/**
 * Smoke test for partial erase WebSocket transport
 *
 * This minimal E2E test validates WebSocket communication for partial erase operations.
 * Business logic is comprehensively tested in integration tests (see PARTIAL_ERASE_MIGRATION.md).
 *
 * Integration Test Coverage (31 tests, 886 LOC):
 * - apps/server/src/domains/__tests__/mapService.test.ts (10 tests, 319 LOC)
 *   → Partial erase segment creation, undo/redo logic, batch operations
 * - apps/server/src/ws/handlers/__tests__/DrawingMessageHandler.test.ts (17 tests, 298 LOC)
 *   → WebSocket message handlers for draw, erase, undo, redo
 * - apps/client/src/hooks/__tests__/useDrawingTool.test.ts (4 tests, 269 LOC)
 *   → Client-side drawing tool state management
 *
 * This smoke test focuses solely on end-to-end WebSocket round-trip validation.
 *
 * @see docs/testing/PARTIAL_ERASE_MIGRATION.md for full migration details
 */

import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte partial erase - Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for state to be ready
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings !== undefined && data.uid);
    });

    // Clear all drawings to start fresh
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();
    await page.getByRole("button", { name: /Clear All/i }).click();
    await page.waitForTimeout(500); // Wait for clear to propagate
  });

  test("WebSocket round-trip: draw → partial erase → undo → redo", async ({ page }) => {
    const initialCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // 1. Draw horizontal stroke
    const startX = box!.x + box!.width * 0.4;
    const startY = box!.y + box!.height * 0.4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY, { steps: 20 });
    await page.mouse.up();

    // Verify drawing created via WebSocket
    await page.waitForFunction(
      (previousCount) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings;
        return Array.isArray(drawings) && drawings.length > previousCount;
      },
      initialCount,
      { timeout: 5000 },
    );

    const originalDrawingId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return drawings.at(-1)?.id ?? null;
    });

    expect(originalDrawingId).not.toBeNull();

    // 2. Partial erase through middle
    await page.getByRole("button", { name: /Eraser/i }).click();

    const eraseX = startX + 100;
    const eraseStartY = startY - 30;
    const eraseEndY = startY + 30;

    await page.mouse.move(eraseX, eraseStartY);
    await page.mouse.down();
    await page.mouse.move(eraseX, eraseEndY, { steps: 15 });
    await page.mouse.up();

    // Verify original removed and segments created via WebSocket
    await page.waitForFunction(
      (origId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return !drawings.some((d) => d.id === origId);
      },
      originalDrawingId,
      { timeout: 5000 },
    );

    const segmentIds = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return drawings.filter((d) => d.type === "freehand").map((d) => d.id);
    });

    expect(segmentIds.length).toBeGreaterThanOrEqual(2);

    // 3. Test Undo via WebSocket
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toBeEnabled({ timeout: 5000 });
    await undoButton.click();

    // Verify original restored and segments removed via WebSocket
    await page.waitForFunction(
      ({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const originalBack = drawings.some((d) => d.id === origId);
        const segmentsGone = segmentIds.every(
          (segId: string) => !drawings.some((d) => d.id === segId),
        );
        return originalBack && segmentsGone;
      },
      { origId: originalDrawingId, segmentIds },
      { timeout: 5000 },
    );

    // 4. Test Redo via WebSocket
    const redoButton = page.getByRole("button", { name: /Redo/i });
    await expect(redoButton).toBeVisible();
    await expect(redoButton).toBeEnabled({ timeout: 5000 });
    await redoButton.click();

    // Verify original removed and segments restored via WebSocket
    await page.waitForFunction(
      ({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const originalGone = !drawings.some((d) => d.id === origId);
        const segmentsBack = segmentIds.every((segId: string) =>
          drawings.some((d) => d.id === segId),
        );
        return originalGone && segmentsBack;
      },
      { origId: originalDrawingId, segmentIds },
      { timeout: 5000 },
    );

    // WebSocket validation complete - business logic tested in integration tests
  });
});
