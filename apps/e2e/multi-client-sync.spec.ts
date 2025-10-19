import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte multi-client synchronization", () => {
  test("two clients see each other's tokens", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await joinDefaultRoom(page1);
      await joinDefaultRoom(page2);

      // Wait for both clients to have their tokens
      await Promise.all([
        page1.waitForFunction(() => {
          const data = window.__HERO_BYTE_E2E__;
          return Boolean(data?.snapshot?.tokens && data.uid);
        }),
        page2.waitForFunction(() => {
          const data = window.__HERO_BYTE_E2E__;
          return Boolean(data?.snapshot?.tokens && data.uid);
        }),
      ]);

      const client1Info = await page1.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        return {
          uid: data?.uid ?? null,
          tokenCount: data?.snapshot?.tokens?.length ?? 0,
        };
      });

      const client2Info = await page2.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        return {
          uid: data?.uid ?? null,
          tokenCount: data?.snapshot?.tokens?.length ?? 0,
        };
      });

      expect(client1Info.uid).not.toBeNull();
      expect(client2Info.uid).not.toBeNull();
      expect(client1Info.uid).not.toBe(client2Info.uid);

      // Each client should see at least 2 tokens (their own + the other client's)
      expect(client1Info.tokenCount).toBeGreaterThanOrEqual(2);
      expect(client2Info.tokenCount).toBeGreaterThanOrEqual(2);

      // Verify client1 sees client2's token
      const client1SeesClient2 = await page1.evaluate((uid2) => {
        const data = window.__HERO_BYTE_E2E__;
        const tokens = data?.snapshot?.tokens ?? [];
        return tokens.some((t) => t.owner === uid2);
      }, client2Info.uid);

      expect(client1SeesClient2).toBe(true);

      // Verify client2 sees client1's token
      const client2SeesClient1 = await page2.evaluate((uid1) => {
        const data = window.__HERO_BYTE_E2E__;
        const tokens = data?.snapshot?.tokens ?? [];
        return tokens.some((t) => t.owner === uid1);
      }, client1Info.uid);

      expect(client2SeesClient1).toBe(true);
    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test("drawing created by one client appears on another client", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await joinDefaultRoom(page1);
      await joinDefaultRoom(page2);

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
      const initialDrawingCount = await page2.evaluate(() => {
        return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
      });

      // Client 1 draws
      await page1.getByRole("button", { name: /Draw Tools/i }).click();
      await expect(page1.locator("text=DRAWING TOOLS")).toBeVisible();

      const canvas1 = page1.getByTestId("map-board").locator("canvas").first();
      const box1 = await canvas1.boundingBox();
      expect(box1).not.toBeNull();

      const startX = box1!.x + box1!.width * 0.4;
      const startY = box1!.y + box1!.height * 0.4;

      await page1.mouse.move(startX, startY);
      await page1.mouse.down();
      await page1.mouse.move(startX + 100, startY + 50, { steps: 15 });
      await page1.mouse.up();

      // Wait for client 1 to register the drawing
      await page1.waitForFunction((prevCount) => {
        const data = window.__HERO_BYTE_E2E__;
        return (data?.snapshot?.drawings?.length ?? 0) > prevCount;
      }, initialDrawingCount);

      const drawingId = await page1.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return drawings.at(-1)?.id ?? null;
      });

      expect(drawingId).not.toBeNull();

      // Client 2 should see the new drawing
      await page2.waitForFunction(
        ({ count, drawingId }) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return drawings.length > count && drawings.some((d) => d.id === drawingId);
        },
        { count: initialDrawingCount, drawingId },
        { timeout: 15000 },
      );

      const client2Drawing = await page2.evaluate((drawingId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        const drawing = drawings.find((d) => d.id === drawingId);
        return {
          exists: Boolean(drawing),
          owner: drawing?.owner ?? null,
          type: drawing?.type,
        };
      }, drawingId);

      expect(client2Drawing.exists).toBe(true);
      expect(client2Drawing.owner).toBe(client1Uid);
      expect(client2Drawing.type).toBe("freehand");
    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test("token movement by one client syncs to another client", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await joinDefaultRoom(page1);
      await joinDefaultRoom(page2);

      await Promise.all([
        page1.waitForFunction(() => {
          const data = window.__HERO_BYTE_E2E__;
          if (!data?.snapshot || !data.uid) return false;
          return (
            Array.isArray(data.snapshot.tokens) &&
            data.snapshot.tokens.some((t) => t.owner === data.uid)
          );
        }),
        page2.waitForFunction(() => {
          const data = window.__HERO_BYTE_E2E__;
          if (!data?.snapshot || !data.uid) return false;
          return (
            Array.isArray(data.snapshot.tokens) &&
            data.snapshot.tokens.some((t) => t.owner === data.uid)
          );
        }),
      ]);

      const tokenInfo = await page1.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.snapshot || !data.uid || !data.cam) return null;
        const token = data.snapshot.tokens.find((t) => t.owner === data.uid);
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

      // Client 1 moves their token
      const canvas1 = page1.getByTestId("map-board").locator("canvas").first();
      const box1 = await canvas1.boundingBox();
      expect(box1).not.toBeNull();

      const offsetX = box1!.x;
      const offsetY = box1!.y;
      const startScreenX = offsetX + stageCenterX;
      const startScreenY = offsetY + stageCenterY;
      const targetScreenX = startScreenX + pixelStep;

      await page1.mouse.move(startScreenX, startScreenY);
      await page1.mouse.down();
      await page1.mouse.move(targetScreenX, startScreenY, { steps: 10 });
      await page1.mouse.up();

      // Wait for client 1 to register the move
      await page1.waitForFunction(
        ({ tokenId, targetX, targetY }) => {
          const data = window.__HERO_BYTE_E2E__;
          const token = data?.snapshot?.tokens?.find((t) => t.id === tokenId);
          return token?.x === targetX && token?.y === targetY;
        },
        { tokenId, targetX: startGridX + 1, targetY: startGridY },
      );

      // Client 2 should see the updated position
      await page2.waitForFunction(
        ({ tokenId, targetX, targetY }) => {
          const data = window.__HERO_BYTE_E2E__;
          const token = data?.snapshot?.tokens?.find((t) => t.id === tokenId);
          return token?.x === targetX && token?.y === targetY;
        },
        { tokenId, targetX: startGridX + 1, targetY: startGridY },
        { timeout: 15000 },
      );

      const client2TokenPos = await page2.evaluate((tokenId) => {
        const data = window.__HERO_BYTE_E2E__;
        const token = data?.snapshot?.tokens?.find((t) => t.id === tokenId);
        return { x: token?.x, y: token?.y };
      }, tokenId);

      expect(client2TokenPos).toEqual({ x: startGridX + 1, y: startGridY });
    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test("partial erase by one client syncs to another client", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await joinDefaultRoom(page1);
      await joinDefaultRoom(page2);

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

      // Client 1 draws
      await page1.getByRole("button", { name: /Draw Tools/i }).click();
      const canvas1 = page1.getByTestId("map-board").locator("canvas").first();
      const box1 = await canvas1.boundingBox();
      expect(box1).not.toBeNull();

      const startX = box1!.x + box1!.width * 0.3;
      const startY = box1!.y + box1!.height * 0.5;

      await page1.mouse.move(startX, startY);
      await page1.mouse.down();
      await page1.mouse.move(startX + 200, startY, { steps: 20 });
      await page1.mouse.up();

      await page1.waitForTimeout(500);

      const drawingId = await page1.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return drawings.at(-1)?.id ?? null;
      });

      expect(drawingId).not.toBeNull();

      // Wait for client 2 to see the drawing
      await page2.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return drawings.some((d) => d.id === id);
        },
        drawingId,
        { timeout: 10000 },
      );

      // Client 1 partially erases
      await page1.getByRole("button", { name: /Eraser/i }).click();

      const eraseX = startX + 100;
      await page1.mouse.move(eraseX, startY - 30);
      await page1.mouse.down();
      await page1.mouse.move(eraseX, startY + 30, { steps: 10 });
      await page1.mouse.up();

      // Wait for client 1 to process the erase
      await page1.waitForFunction(
        (origId) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return !drawings.some((d) => d.id === origId);
        },
        drawingId,
        { timeout: 5000 },
      );

      // Client 2 should see the erase result
      await page2.waitForFunction(
        (origId) => {
          const data = window.__HERO_BYTE_E2E__;
          const drawings = data?.snapshot?.drawings ?? [];
          return !drawings.some((d) => d.id === origId);
        },
        drawingId,
        { timeout: 15000 },
      );

      const client2State = await page2.evaluate((origId) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return {
          originalExists: drawings.some((d) => d.id === origId),
          freehandCount: drawings.filter((d) => d.type === "freehand").length,
        };
      }, drawingId);

      expect(client2State.originalExists).toBe(false);
      expect(client2State.freehandCount).toBeGreaterThanOrEqual(2);
    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
