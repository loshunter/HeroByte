/**
 * Minimal Smoke Test for Player Staging Zone
 *
 * This replaces the 402-LOC staging-zone.spec.ts test (which had 6 tests skipped, 1 active).
 *
 * WHY THIS IS SUFFICIENT:
 * - Business logic (validation, normalization, spawn position calculation) is fully tested in:
 *   apps/server/src/domains/room/staging/__tests__/StagingZoneManager.test.ts (483 LOC, 28 tests)
 * - Authorization (DM-only restriction) is tested in:
 *   apps/server/src/ws/__tests__/characterization/authorization.characterization.test.ts
 * - Transform logic is tested in:
 *   apps/server/src/domains/room/transform/__tests__/TransformHandler.test.ts (staging zone tests)
 *
 * WHAT'S NOT TESTED HERE (but IS tested in integration tests):
 * - Zone validation (13 tests): valid zones, negative dimensions, non-finite values, etc.
 * - setPlayerStagingZone (4 tests): state updates, scene graph rebuild
 * - getPlayerSpawnPosition (11 tests): spawn distribution, rotation handling, bounds checking
 * - Authorization: DM-only restriction
 * - Transform operations: position, scale, rotation
 *
 * ORIGINAL E2E TESTS (6 skipped, 1 active):
 * - ❌ SKIPPED: DM can create a staging zone (toggle-dm doesn't work in e2e)
 * - ❌ SKIPPED: DM can clear the staging zone (toggle-dm doesn't work in e2e)
 * - ❌ SKIPPED: staging zone validates coordinates (covered by integration tests)
 * - ❌ SKIPPED: staging zone persists in session snapshot (covered by session-load tests)
 * - ❌ SKIPPED: staging zone supports rotation property (covered by integration tests)
 * - ❌ SKIPPED: staging zone defaults rotation to 0 (covered by integration tests)
 * - ✅ ACTIVE: non-DM players cannot set staging zone (covered by authorization tests)
 *
 * NOTE: The original e2e tests were already mostly skipped because toggle-dm message
 * doesn't work reliably in E2E tests. This smoke test validates the basic WebSocket flow works.
 */

import { expect, test } from "@playwright/test";
import { joinDefaultRoomAsDM } from "./helpers";

test.describe("Player Staging Zone - Smoke Tests", () => {
  test("DM can set staging zone via WebSocket and it appears in snapshot", async ({ page }) => {
    await joinDefaultRoomAsDM(page);

    // Wait for room to be ready
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot && data.uid);
      },
      { timeout: 10000 },
    );

    // Create a staging zone
    const testZone = {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      rotation: 0,
    };

    await page.evaluate((zone) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone,
      });
    }, testZone);

    // Wait for WebSocket round-trip
    await page.waitForTimeout(500);

    // Verify staging zone appears in snapshot
    const stagingZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    // Basic smoke test assertions
    expect(stagingZone).not.toBeNull();
    expect(stagingZone?.x).toBe(100);
    expect(stagingZone?.y).toBe(100);
    expect(stagingZone?.width).toBe(50);
    expect(stagingZone?.height).toBe(50);

    // That's it! No need to test validation, normalization, spawn position, etc.
    // StagingZoneManager.test.ts handles all that (28 tests)
  });
});
