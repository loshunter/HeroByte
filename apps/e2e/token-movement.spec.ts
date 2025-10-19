import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte token movement", () => {
  test("player can drag their token to a new grid square", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot) return false;
      return Array.isArray(data.snapshot.tokens) && data.snapshot.tokens.length > 0 && Boolean(data.uid);
    });

    const tokenInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) {
        return null;
      }
      const token = data.snapshot.tokens.find((entry) => entry.owner === data.uid);
      if (!token) {
        return null;
      }
      return {
        tokenId: token.id,
        startX: token.x,
        startY: token.y,
        gridSize: data.gridSize ?? data.snapshot.gridSize ?? 50,
      };
    });

    expect(tokenInfo).not.toBeNull();
    const { tokenId, startX, startY, gridSize } = tokenInfo!;

    await page.waitForFunction(
      ({ tokenId }) => {
        const stage = (window as typeof window & { Konva?: any }).Konva?.stages?.[0];
        if (!stage) return false;
        return Boolean(stage.findOne(`[data-token-id="token:${tokenId}"]`));
      },
      { tokenId },
    );

    const dragMetrics = await page.evaluate(
      ({ tokenId, gridSize }) => {
        const stage = (window as typeof window & { Konva?: any }).Konva?.stages?.[0];
        const data = window.__HERO_BYTE_E2E__;
        if (!stage || !data) {
          return null;
        }
        const node = stage.findOne(`[data-token-id="token:${tokenId}"]`);
        if (!node) {
          return null;
        }
        const rect = node.getClientRect({ relativeTo: stage });
        const camScale = data.cam?.scale ?? 1;
        return {
          startScreenX: rect.x + rect.width / 2,
          startScreenY: rect.y + rect.height / 2,
          pixelStep: gridSize * camScale,
        };
      },
      { tokenId, gridSize },
    );

    expect(dragMetrics).not.toBeNull();
    const { startScreenX, startScreenY, pixelStep } = dragMetrics!;

    const canvasBox = await page.getByTestId("map-board").locator("canvas").first().boundingBox();
    expect(canvasBox).not.toBeNull();

    const offsetX = canvasBox!.x;
    const offsetY = canvasBox!.y;

    const targetScreenX = startScreenX + pixelStep;
    const targetScreenY = startScreenY;

    await page.mouse.move(offsetX + startScreenX, offsetY + startScreenY);
    await page.mouse.down();
    await page.mouse.move(offsetX + targetScreenX, offsetY + targetScreenY, { steps: 10 });
    await page.mouse.up();

    const targetX = startX + 1;
    const targetY = startY;

    await page.waitForFunction(
      ({ tokenId, targetX, targetY }) => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.snapshot) return false;
        const token = data.snapshot.tokens.find((entry) => entry.id === tokenId);
        if (!token) return false;
        return token.x === targetX && token.y === targetY;
      },
      { tokenId, targetX, targetY },
    );

    const finalPosition = await page.evaluate(({ tokenId }) => {
      const data = window.__HERO_BYTE_E2E__;
      const token = data?.snapshot?.tokens?.find((entry) => entry.id === tokenId);
      if (!token) return null;
      return { x: token.x, y: token.y };
    }, { tokenId });

    expect(finalPosition).toEqual({ x: startX + 1, y: startY });
  });
});
