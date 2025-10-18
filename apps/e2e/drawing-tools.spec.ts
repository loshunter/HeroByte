import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte drawing tools", () => {
  test("player can create a freehand drawing", async ({ page }) => {
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

    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.4;
    const startY = box!.y + box!.height * 0.4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 10, { steps: 12 });
    await page.mouse.move(startX + 120, startY - 20, { steps: 12 });
    await page.mouse.up();

    await page.waitForFunction((previousCount) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings;
      return Array.isArray(drawings) && drawings.length > previousCount;
    }, initialCount);

    const result = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      const last = drawings.at(-1);
      return {
        count: drawings.length,
        uid: data?.uid ?? null,
        lastDrawing: last
          ? {
              owner: last.owner ?? null,
              type: last.type,
              pointCount: Array.isArray(last.points) ? last.points.length : 0,
            }
          : null,
      };
    });

    expect(result.count).toBeGreaterThan(initialCount);
    expect(result.lastDrawing).not.toBeNull();
    expect(result.lastDrawing?.type).toBe("freehand");
    expect(result.lastDrawing?.owner).toBe(result.uid);
    expect(result.lastDrawing?.pointCount ?? 0).toBeGreaterThan(2);
  });
});
