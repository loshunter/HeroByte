import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte partial erase", () => {
  // Clear drawings before each test to ensure test isolation
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

  test("Single Client - Partial Erase with Undo/Redo", async ({ page }) => {
    // Baseline: Get initial drawing count (should be 0)
    const initialCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Draw horizontal stroke (40% from left/top)
    const startX = box!.x + box!.width * 0.4;
    const startY = box!.y + box!.height * 0.4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY, { steps: 20 });
    await page.mouse.up();

    // Verify drawing created
    await page.waitForFunction((previousCount) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings;
      return Array.isArray(drawings) && drawings.length > previousCount;
    }, initialCount);

    const drawingInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      const last = drawings.at(-1);
      return {
        id: last?.id ?? null,
        type: last?.type,
        pointCount: Array.isArray(last?.points) ? last.points.length : 0,
        count: drawings.length,
      };
    });

    expect(drawingInfo.id).not.toBeNull();
    expect(drawingInfo.type).toBe("freehand");
    expect(drawingInfo.pointCount).toBeGreaterThan(2);
    expect(drawingInfo.count).toBeGreaterThan(initialCount);

    const originalDrawingId = drawingInfo.id;

    // Switch to eraser tool
    await page.getByRole("button", { name: /Eraser/i }).click();

    // Erase vertically through middle of stroke
    const eraseX = startX + 100;
    const eraseStartY = startY - 30;
    const eraseEndY = startY + 30;

    await page.mouse.move(eraseX, eraseStartY);
    await page.mouse.down();
    await page.mouse.move(eraseX, eraseEndY, { steps: 15 });
    await page.mouse.up();

    // Verify original drawing gone and segments created
    await page.waitForFunction(
      (origId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return !drawings.some((d) => d.id === origId);
      },
      originalDrawingId,
      { timeout: 5000 },
    );

    const afterEraseInfo = await page.evaluate((origId) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      const segments = drawings.filter((d) => d.type === "freehand");
      return {
        originalExists: drawings.some((d) => d.id === origId),
        segmentCount: segments.length,
        segmentIds: segments.map((d) => d.id),
        totalCount: drawings.length,
      };
    }, originalDrawingId);

    expect(afterEraseInfo.originalExists).toBe(false);
    expect(afterEraseInfo.segmentCount).toBeGreaterThanOrEqual(2);
    expect(afterEraseInfo.segmentIds.length).toBeGreaterThanOrEqual(2);

    const segmentIds = afterEraseInfo.segmentIds;

    // Test Undo - should restore original drawing AND remove segments
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toBeEnabled({ timeout: 5000 });
    await undoButton.click();

    // Wait for original to be restored and segments to be removed
    await page.waitForFunction(
      ({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const originalBack = drawings.some((d) => d.id === origId);
        const segmentsGone = segmentIds.every((segId: string) => !drawings.some((d) => d.id === segId));
        return originalBack && segmentsGone;
      },
      { origId: originalDrawingId, segmentIds },
      { timeout: 5000 },
    );

    const afterUndo = await page.evaluate(({ origId, segmentIds }) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return {
        originalExists: drawings.some((d) => d.id === origId),
        segmentsExist: segmentIds.some((segId: string) => drawings.some((d) => d.id === segId)),
        drawingCount: drawings.length,
      };
    }, { origId: originalDrawingId, segmentIds });

    expect(afterUndo.originalExists).toBe(true);
    expect(afterUndo.segmentsExist).toBe(false); // Segments should be removed!
    expect(afterUndo.drawingCount).toBe(initialCount + 1); // Only the original drawing

    // Test Redo - should re-apply the partial erase (original gone, segments back)
    const redoButton = page.getByRole("button", { name: /Redo/i });
    await expect(redoButton).toBeVisible();
    await expect(redoButton).toBeEnabled({ timeout: 5000 });
    await redoButton.click();

    // Wait for original to be gone and segments to be restored
    await page.waitForFunction(
      ({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const originalGone = !drawings.some((d) => d.id === origId);
        const segmentsBack = segmentIds.every((segId: string) => drawings.some((d) => d.id === segId));
        return originalGone && segmentsBack;
      },
      { origId: originalDrawingId, segmentIds },
      { timeout: 5000 },
    );

    const afterRedo = await page.evaluate(({ origId, segmentIds }) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return {
        originalExists: drawings.some((d) => d.id === origId),
        segmentsExist: segmentIds.every((segId: string) => drawings.some((d) => d.id === segId)),
        segmentCount: segmentIds.filter((segId: string) => drawings.some((d) => d.id === segId)).length,
      };
    }, { origId: originalDrawingId, segmentIds });

    expect(afterRedo.originalExists).toBe(false);
    expect(afterRedo.segmentsExist).toBe(true); // Segments should be restored!
    expect(afterRedo.segmentCount).toBeGreaterThanOrEqual(2);

    // History cleanup: Double undo to return to baseline
    await expect(undoButton).toBeEnabled({ timeout: 5000 });
    await undoButton.click();

    // Undo restores original drawing
    await page.waitForFunction(
      (origId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return drawings.some((d) => d.id === origId);
      },
      originalDrawingId,
      { timeout: 5000 },
    );

    const afterSecondUndo = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    // After undo, should have just the original drawing back
    expect(afterSecondUndo).toBe(initialCount + 1);

    // Verify no orphaned selections
    const noOrphanedSelections = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const selectedIds = data?.selectedIds ?? [];
      const drawings = data?.snapshot?.drawings ?? [];
      const drawingIds = new Set(drawings.map((d) => d.id));
      return selectedIds.every((id: string) => drawingIds.has(id));
    });

    expect(noOrphanedSelections).toBe(true);

    // Verify no console errors
    const consoleErrors = await page.evaluate(() => {
      return (window as any).__consoleErrors ?? [];
    });

    expect(consoleErrors).toEqual([]);
  });

  test("Multi-Client - Partial Erase Synchronization", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Both clients join the room
      await joinDefaultRoom(page1);
      await joinDefaultRoom(page2);

      // Wait for both clients to be ready
      await Promise.all([
        page1.waitForFunction(() => {
          const data = window.__HERO_BYTE_E2E__;
          return Boolean(data?.snapshot?.drawings && data.uid);
        }),
        page2.waitForFunction(() => {
          const data = window.__HERO_BYTE_E2E__;
          return Boolean(data?.snapshot?.drawings && data.uid);
        }),
      ]);

      const client1Uid = await page1.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);
      const client2Uid = await page2.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);

      expect(client1Uid).not.toBeNull();
      expect(client2Uid).not.toBeNull();
      expect(client1Uid).not.toBe(client2Uid);

      const initialCount = await page1.evaluate(() => {
        return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
      });

      // Client 1 draws horizontal stroke
      await page1.getByRole("button", { name: /Draw Tools/i }).click();
      await expect(page1.locator("text=DRAWING TOOLS")).toBeVisible();

      const canvas1 = page1.getByTestId("map-board").locator("canvas").first();
      const box1 = await canvas1.boundingBox();
      expect(box1).not.toBeNull();

      const startX = box1!.x + box1!.width * 0.4;
      const startY = box1!.y + box1!.height * 0.4;

      await page1.mouse.move(startX, startY);
      await page1.mouse.down();
      await page1.mouse.move(startX + 200, startY, { steps: 20 });
      await page1.mouse.up();

      // Client 1 verifies drawing created
      await page1.waitForFunction((prevCount) => {
        const data = window.__HERO_BYTE_E2E__;
        return (data?.snapshot?.drawings?.length ?? 0) > prevCount;
      }, initialCount, { timeout: 5000 });

      const drawingId = await page1.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return drawings.at(-1)?.id ?? null;
      });

      expect(drawingId).not.toBeNull();

      // Client 2 verifies drawing appears (15s timeout for WebSocket sync)
      await page2.waitForFunction(
        ({ count, drawingId }) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return drawings.length > count && drawings.some((d) => d.id === drawingId);
        },
        { count: initialCount, drawingId },
        { timeout: 15000 },
      );

      const client2DrawingInfo = await page2.evaluate((drawingId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const drawing = drawings.find((d) => d.id === drawingId);
        return {
          exists: Boolean(drawing),
          owner: drawing?.owner ?? null,
          type: drawing?.type,
        };
      }, drawingId);

      expect(client2DrawingInfo.exists).toBe(true);
      expect(client2DrawingInfo.owner).toBe(client1Uid);
      expect(client2DrawingInfo.type).toBe("freehand");

      // Client 1 erases vertically through middle
      await page1.getByRole("button", { name: /Eraser/i }).click();

      const eraseX = startX + 100;
      const eraseStartY = startY - 30;
      const eraseEndY = startY + 30;

      await page1.mouse.move(eraseX, eraseStartY);
      await page1.mouse.down();
      await page1.mouse.move(eraseX, eraseEndY, { steps: 15 });
      await page1.mouse.up();

      // Client 1 verifies erase completed
      await page1.waitForFunction(
        (origId) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return !drawings.some((d) => d.id === origId);
        },
        drawingId,
        { timeout: 5000 },
      );

      const client1Segments = await page1.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const segments = drawings.filter((d) => d.type === "freehand");
        return {
          count: segments.length,
          ids: segments.map((d) => d.id),
        };
      });

      expect(client1Segments.count).toBeGreaterThanOrEqual(2);

      // Client 2 verifies original gone, segments appear (15s timeout)
      await page2.waitForFunction(
        (origId) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return !drawings.some((d) => d.id === origId);
        },
        drawingId,
        { timeout: 15000 },
      );

      const client2AfterErase = await page2.evaluate((origId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const segments = drawings.filter((d) => d.type === "freehand");
        return {
          originalExists: drawings.some((d) => d.id === origId),
          segmentCount: segments.length,
          segmentIds: segments.map((d) => d.id),
        };
      }, drawingId);

      expect(client2AfterErase.originalExists).toBe(false);
      expect(client2AfterErase.segmentCount).toBeGreaterThanOrEqual(2);

      // Verify segment IDs match between clients
      expect(new Set(client2AfterErase.segmentIds)).toEqual(new Set(client1Segments.ids));

      // Client 1 clicks Undo
      const undoButton = page1.getByRole("button", { name: /Undo/i });
      await expect(undoButton).toBeVisible();
      await expect(undoButton).toBeEnabled({ timeout: 5000 });
      await undoButton.click();

      // Client 1 verifies original restored
      await page1.waitForFunction(
        (origId) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return drawings.some((d) => d.id === origId);
        },
        drawingId,
        { timeout: 5000 },
      );

      // Client 2 verifies original restored and segments removed (15s timeout)
      await page2.waitForFunction(
        ({ origId, segmentIds }) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          const originalBack = drawings.some((d) => d.id === origId);
          const segmentsGone = segmentIds.every((segId: string) => !drawings.some((d) => d.id === segId));
          return originalBack && segmentsGone;
        },
        { origId: drawingId, segmentIds: client1Segments.ids },
        { timeout: 15000 },
      );

      const client2AfterUndo = await page2.evaluate(({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return {
          originalExists: drawings.some((d) => d.id === origId),
          segmentsExist: segmentIds.some((segId: string) => drawings.some((d) => d.id === segId)),
          drawingCount: drawings.length,
        };
      }, { origId: drawingId, segmentIds: client1Segments.ids });

      expect(client2AfterUndo.originalExists).toBe(true);
      expect(client2AfterUndo.segmentsExist).toBe(false); // Segments should be removed
      expect(client2AfterUndo.drawingCount).toBe(initialCount + 1);

      // Client 1 clicks Redo
      const redoButton = page1.getByRole("button", { name: /Redo/i });
      await expect(redoButton).toBeVisible();
      await expect(redoButton).toBeEnabled({ timeout: 5000 });
      await redoButton.click();

      // Client 1 verifies original gone
      await page1.waitForFunction(
        (origId) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return !drawings.some((d) => d.id === origId);
        },
        drawingId,
        { timeout: 5000 },
      );

      // Client 2 verifies original gone and segments restored (15s timeout)
      await page2.waitForFunction(
        ({ origId, segmentIds }) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          const originalGone = !drawings.some((d) => d.id === origId);
          const segmentsBack = segmentIds.every((segId: string) => drawings.some((d) => d.id === segId));
          return originalGone && segmentsBack;
        },
        { origId: drawingId, segmentIds: client1Segments.ids },
        { timeout: 15000 },
      );

      const client2AfterRedo = await page2.evaluate(({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return {
          originalExists: drawings.some((d) => d.id === origId),
          segmentsExist: segmentIds.every((segId: string) => drawings.some((d) => d.id === segId)),
          segmentCount: drawings.filter((d) => d.type === "freehand").length,
        };
      }, { origId: drawingId, segmentIds: client1Segments.ids });

      expect(client2AfterRedo.originalExists).toBe(false);
      expect(client2AfterRedo.segmentsExist).toBe(true); // Segments should be restored
      expect(client2AfterRedo.segmentCount).toBeGreaterThanOrEqual(2);

      // Verify no orphaned selections on both clients
      const [client1NoOrphans, client2NoOrphans] = await Promise.all([
        page1.evaluate(() => {
          const data = window.__HERO_BYTE_E2E__;
          const selectedIds = data?.selectedIds ?? [];
          const drawings = data?.snapshot?.drawings ?? [];
          const drawingIds = new Set(drawings.map((d) => d.id));
          return selectedIds.every((id: string) => drawingIds.has(id));
        }),
        page2.evaluate(() => {
          const data = window.__HERO_BYTE_E2E__;
          const selectedIds = data?.selectedIds ?? [];
          const drawings = data?.snapshot?.drawings ?? [];
          const drawingIds = new Set(drawings.map((d) => d.id));
          return selectedIds.every((id: string) => drawingIds.has(id));
        }),
      ]);

      expect(client1NoOrphans).toBe(true);
      expect(client2NoOrphans).toBe(true);

      // Verify no console errors on both clients
      const [client1Errors, client2Errors] = await Promise.all([
        page1.evaluate(() => (window as any).__consoleErrors ?? []),
        page2.evaluate(() => (window as any).__consoleErrors ?? []),
      ]);

      expect(client1Errors).toEqual([]);
      expect(client2Errors).toEqual([]);
    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test("player can partially erase a freehand drawing and create segments", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings && data.uid);
    });

    const { initialCount, uid } = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return {
        initialCount: data?.snapshot?.drawings?.length ?? 0,
        uid: data?.uid ?? null,
      };
    });

    expect(uid).not.toBeNull();

    // Open drawing tools
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Draw a horizontal stroke
    const startX = box!.x + box!.width * 0.3;
    const startY = box!.y + box!.height * 0.5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY, { steps: 20 });
    await page.mouse.up();

    // Wait for drawing to be created
    await page.waitForFunction((previousCount) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings;
      return Array.isArray(drawings) && drawings.length > previousCount;
    }, initialCount);

    const drawingInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      const last = drawings.at(-1);
      return {
        id: last?.id ?? null,
        type: last?.type,
        pointCount: Array.isArray(last?.points) ? last.points.length : 0,
      };
    });

    expect(drawingInfo.id).not.toBeNull();
    expect(drawingInfo.type).toBe("freehand");
    expect(drawingInfo.pointCount).toBeGreaterThan(2);

    const originalDrawingId = drawingInfo.id;

    // Switch to eraser tool
    await page.getByRole("button", { name: /Eraser/i }).click();

    // Erase through the middle of the stroke vertically
    const eraseX = startX + 100;
    const eraseStartY = startY - 30;
    const eraseEndY = startY + 30;

    await page.mouse.move(eraseX, eraseStartY);
    await page.mouse.down();
    await page.mouse.move(eraseX, eraseEndY, { steps: 10 });
    await page.mouse.up();

    // Wait for partial erase to complete
    // The original drawing should be replaced by two segments
    await page.waitForFunction(
      (origId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return !drawings.some((d) => d.id === origId);
      },
      originalDrawingId,
      { timeout: 5000 },
    );

    const afterEraseInfo = await page.evaluate((origId) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      const newDrawings = drawings.filter((d) => d.id !== origId && d.type === "freehand");
      return {
        originalExists: drawings.some((d) => d.id === origId),
        newSegmentCount: newDrawings.length,
        segmentIds: newDrawings.map((d) => d.id),
      };
    }, originalDrawingId);

    expect(afterEraseInfo.originalExists).toBe(false);
    expect(afterEraseInfo.newSegmentCount).toBeGreaterThanOrEqual(2);
    expect(afterEraseInfo.segmentIds.length).toBeGreaterThanOrEqual(2);
  });

  test("partial erase supports undo and redo", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings && data.uid);
    });

    const initialCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    // Open drawing tools and draw
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.3;
    const startY = box!.y + box!.height * 0.5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY, { steps: 20 });
    await page.mouse.up();

    await page.waitForFunction((previousCount) => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.drawings?.length ?? 0) > previousCount;
    }, initialCount);

    const originalDrawingId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return drawings.at(-1)?.id ?? null;
    });

    // Switch to eraser and partially erase
    await page.getByRole("button", { name: /Eraser/i }).click();

    const eraseX = startX + 100;
    await page.mouse.move(eraseX, startY - 30);
    await page.mouse.down();
    await page.mouse.move(eraseX, startY + 30, { steps: 10 });
    await page.mouse.up();

    // Wait for erase to complete
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

    // Test Undo - should restore original drawing and remove segments
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeVisible();
    await undoButton.click();

    await page.waitForFunction(
      ({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const originalBack = drawings.some((d) => d.id === origId);
        const segmentsGone = segmentIds.every((segId: string) => !drawings.some((d) => d.id === segId));
        return originalBack && segmentsGone;
      },
      { origId: originalDrawingId, segmentIds },
      { timeout: 5000 },
    );

    const afterUndo = await page.evaluate(({ origId, segmentIds }) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return {
        originalExists: drawings.some((d) => d.id === origId),
        segmentsExist: segmentIds.some((segId: string) => drawings.some((d) => d.id === segId)),
        drawingCount: drawings.length,
      };
    }, { origId: originalDrawingId, segmentIds });

    expect(afterUndo.originalExists).toBe(true);
    expect(afterUndo.segmentsExist).toBe(false); // Segments should be removed
    expect(afterUndo.drawingCount).toBe(initialCount + 1);

    // Test Redo - should re-apply the partial erase (remove original, restore segments)
    const redoButton = page.getByRole("button", { name: /Redo/i });
    await expect(redoButton).toBeVisible();
    await redoButton.click();

    await page.waitForFunction(
      ({ origId, segmentIds }) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const originalGone = !drawings.some((d) => d.id === origId);
        const segmentsBack = segmentIds.every((segId: string) => drawings.some((d) => d.id === segId));
        return originalGone && segmentsBack;
      },
      { origId: originalDrawingId, segmentIds },
      { timeout: 5000 },
    );

    const afterRedo = await page.evaluate(({ origId, segmentIds }) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return {
        originalExists: drawings.some((d) => d.id === origId),
        segmentsExist: segmentIds.every((segId: string) => drawings.some((d) => d.id === segId)),
        segmentCount: drawings.filter((d) => d.type === "freehand").length,
      };
    }, { origId: originalDrawingId, segmentIds });

    expect(afterRedo.originalExists).toBe(false);
    expect(afterRedo.segmentsExist).toBe(true); // Segments should be restored
    expect(afterRedo.segmentCount).toBeGreaterThanOrEqual(2);
  });
});
