/**
 * Minimal Smoke Test for Transform Tool
 *
 * This replaces the comprehensive 431-LOC transform-tool.spec.ts test.
 *
 * WHY THIS IS SUFFICIENT:
 * - Business logic (position, rotation, scale, locked state, authorization) is fully tested in:
 *   apps/server/src/domains/room/transform/__tests__/TransformHandler.test.ts (760 LOC, 30+ tests)
 * - This smoke test only validates WebSocket transport layer works end-to-end
 * - Verifies player can send transform-object message and state updates
 *
 * WHAT'S NOT TESTED HERE (but IS tested in TransformHandler.test.ts):
 * - Map transforms (4 tests)
 * - Token transforms (5 tests)
 * - Staging zone transforms (6 tests)
 * - Drawing transforms (3 tests)
 * - Prop transforms (4 tests)
 * - Pointer transforms (2 tests)
 * - Locked state handling (6 tests)
 * - Edge cases (3 tests)
 * - Authorization (DM vs player permissions)
 */

import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("Transform Tool - Smoke Tests", () => {
  test("player can transform scene object via WebSocket", async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for room to be ready
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot && data.uid);
      },
      { timeout: 10000 },
    );

    // Check if there are any scene objects to transform
    const hasSceneObjects = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.sceneObjects?.length ?? 0) > 0;
    });

    if (!hasSceneObjects) {
      test.skip(true, "No scene objects available for transform smoke test");
      return;
    }

    // Get first object's info
    const objectInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.[0];
      return {
        id: obj?.id ?? null,
        initialX: obj?.transform?.x ?? 0,
        initialY: obj?.transform?.y ?? 0,
      };
    });

    expect(objectInfo.id).not.toBeNull();

    // Select the object
    await page.evaluate((objId) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({
        t: "select-object",
        uid: data.uid,
        objectId: objId,
      });
    }, objectInfo.id);

    // Wait for selection (basic check)
    await page.waitForTimeout(500);

    // Transform the object (move it)
    const newX = objectInfo.initialX + 100;
    const newY = objectInfo.initialY + 50;

    await page.evaluate(
      ({ objId, x, y }) => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.sendMessage) return;
        data.sendMessage({
          t: "transform-object",
          id: objId,
          position: { x, y },
        });
      },
      { objId: objectInfo.id, x: newX, y: newY },
    );

    // Wait for WebSocket round-trip
    await page.waitForFunction(
      ({ objId, targetX, targetY }) => {
        const data = window.__HERO_BYTE_E2E__;
        const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
        return obj?.transform?.x === targetX && obj?.transform?.y === targetY;
      },
      { objId: objectInfo.id, targetX: newX, targetY: newY },
      { timeout: 5000 },
    );

    // Basic smoke test assertion
    const finalPosition = await page.evaluate((objId) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
      return {
        x: obj?.transform?.x ?? 0,
        y: obj?.transform?.y ?? 0,
      };
    }, objectInfo.id);

    expect(finalPosition.x).toBe(newX);
    expect(finalPosition.y).toBe(newY);

    // That's it! No need to test rotation, scale, authorization, etc.
    // TransformHandler.test.ts handles all that
  });
});
