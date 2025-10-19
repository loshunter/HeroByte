import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte undo/redo workflow", () => {
  test("undo and redo work for drawing actions", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings && data.uid);
    });

    const initialCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    // Open drawing tools
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Draw first stroke
    const x1 = box!.x + box!.width * 0.3;
    const y1 = box!.y + box!.height * 0.3;

    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x1 + 100, y1 + 50, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      (prevCount) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) > prevCount;
      },
      initialCount,
      { timeout: 5000 },
    );

    // Draw second stroke
    const x2 = x1 + 50;
    const y2 = y1 + 100;

    await page.mouse.move(x2, y2);
    await page.mouse.down();
    await page.mouse.move(x2 + 80, y2 - 40, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      (prevCount) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) > prevCount + 1;
      },
      initialCount,
      { timeout: 5000 },
    );

    const afterTwoDrawings = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    expect(afterTwoDrawings).toBe(initialCount + 2);

    // Undo second drawing - check button is not disabled first
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeEnabled({ timeout: 5000 });
    await undoButton.click();

    await page.waitForFunction(
      (expectedCount) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) === expectedCount;
      },
      initialCount + 1,
      { timeout: 5000 },
    );

    const afterFirstUndo = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    expect(afterFirstUndo).toBe(initialCount + 1);

    // Undo first drawing
    await expect(undoButton).toBeEnabled({ timeout: 5000 });
    await undoButton.click();

    await page.waitForFunction(
      (expectedCount) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) === expectedCount;
      },
      initialCount,
      { timeout: 5000 },
    );

    const afterSecondUndo = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    expect(afterSecondUndo).toBe(initialCount);

    // Redo first drawing
    const redoButton = page.getByRole("button", { name: /Redo/i });
    await expect(redoButton).toBeEnabled({ timeout: 5000 });
    await redoButton.click();

    await page.waitForFunction(
      (expectedCount) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) === expectedCount;
      },
      initialCount + 1,
      { timeout: 5000 },
    );

    // Redo second drawing
    await expect(redoButton).toBeEnabled({ timeout: 5000 });
    await redoButton.click();

    await page.waitForFunction(
      (expectedCount) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) === expectedCount;
      },
      initialCount + 2,
      { timeout: 5000 },
    );

    const afterRedos = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    expect(afterRedos).toBe(initialCount + 2);
  });

  test("token movement can be performed successfully", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return (
        Array.isArray(data.snapshot.tokens) &&
        data.snapshot.tokens.some((t) => t.owner === data.uid)
      );
    });

    const tokenInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid || !data.cam) return null;
      const token = data.snapshot.tokens.find((entry) => entry.owner === data.uid);
      if (!token) return null;
      const gridSize = data.gridSize ?? data.snapshot.gridSize ?? 50;
      const cam = data.cam;
      const centerStageX = cam.x + (token.x * gridSize + gridSize / 2) * cam.scale;
      const centerStageY = cam.y + (token.y * gridSize + gridSize / 2) * cam.scale;
      return {
        tokenId: token.id,
        startGridX: token.x,
        startGridY: token.y,
        stageCenterX: centerStageX,
        stageCenterY: centerStageY,
        pixelStep: gridSize * cam.scale,
      };
    });

    expect(tokenInfo).not.toBeNull();
    const { tokenId, startGridX, startGridY, stageCenterX, stageCenterY, pixelStep } = tokenInfo!;

    const canvasBox = await page.getByTestId("map-board").locator("canvas").first().boundingBox();
    expect(canvasBox).not.toBeNull();

    const offsetX = canvasBox!.x;
    const offsetY = canvasBox!.y;

    // Move token one square to the right
    const startScreenX = offsetX + stageCenterX;
    const startScreenY = offsetY + stageCenterY;
    const targetScreenX = startScreenX + pixelStep;

    await page.mouse.move(startScreenX, startScreenY);
    await page.mouse.down();
    await page.mouse.move(targetScreenX, startScreenY, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      ({ tokenId, targetX, targetY }) => {
        const data = window.__HERO_BYTE_E2E__;
        const token = data?.snapshot?.tokens?.find((t) => t.id === tokenId);
        return token?.x === targetX && token?.y === targetY;
      },
      { tokenId, targetX: startGridX + 1, targetY: startGridY },
      { timeout: 10000 },
    );

    const afterMove = await page.evaluate((id) => {
      const data = window.__HERO_BYTE_E2E__;
      const token = data?.snapshot?.tokens?.find((t) => t.id === id);
      return { x: token?.x, y: token?.y };
    }, tokenId);

    expect(afterMove).toEqual({ x: startGridX + 1, y: startGridY });
  });

  test("undo/redo clears when new action is performed after undo", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings && data.uid);
    });

    const initialCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    // Open drawing tools and draw two strokes
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // First stroke
    const x1 = box!.x + box!.width * 0.3;
    const y1 = box!.y + box!.height * 0.3;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x1 + 100, y1, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      (c) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) > c;
      },
      initialCount,
      { timeout: 5000 },
    );

    // Second stroke
    await page.mouse.move(x1, y1 + 50);
    await page.mouse.down();
    await page.mouse.move(x1 + 100, y1 + 50, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      (c) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) > c + 1;
      },
      initialCount,
      { timeout: 5000 },
    );

    // Undo once (removes second stroke)
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeEnabled({ timeout: 5000 });
    await undoButton.click();

    await page.waitForFunction(
      (c) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) === c + 1;
      },
      initialCount,
      { timeout: 5000 },
    );

    // Draw a new stroke (should clear redo history)
    await page.mouse.move(x1 + 50, y1 + 100);
    await page.mouse.down();
    await page.mouse.move(x1 + 150, y1 + 100, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      (c) => {
        return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) === c + 2;
      },
      initialCount,
      { timeout: 5000 },
    );

    // Redo button should now be disabled since redo stack was cleared
    const redoButton = page.getByRole("button", { name: /Redo/i });
    await expect(redoButton).toBeDisabled({ timeout: 2000 });

    const finalCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    expect(finalCount).toBe(initialCount + 2);
  });
});
