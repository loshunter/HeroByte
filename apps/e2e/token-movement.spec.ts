import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte token movement", () => {
  test("player can drag their token to a new grid square", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid || !data.cam) return false;
      return (
        Array.isArray(data.snapshot.tokens) &&
        data.snapshot.tokens.some((t) => t.owner === data.uid)
      );
    });

    const tokenInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid || !data.cam) {
        return null;
      }
      const token = data.snapshot.tokens.find((entry) => entry.owner === data.uid);
      if (!token) {
        return null;
      }
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

    const startScreenX = offsetX + stageCenterX;
    const startScreenY = offsetY + stageCenterY;
    const targetScreenX = startScreenX + pixelStep;
    const targetScreenY = startScreenY;

    await page.mouse.move(startScreenX, startScreenY);
    await page.mouse.down();
    await page.mouse.move(targetScreenX, targetScreenY, { steps: 10 });
    await page.mouse.up();

    const targetX = startGridX + 1;
    const targetY = startGridY;

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

    const finalPosition = await page.evaluate(
      ({ tokenId }) => {
        const data = window.__HERO_BYTE_E2E__;
        const token = data?.snapshot?.tokens?.find((entry) => entry.id === tokenId);
        if (!token) return null;
        return { x: token.x, y: token.y };
      },
      { tokenId },
    );

    expect(finalPosition).toEqual({ x: startGridX + 1, y: startGridY });
  });
});
