/**
 * Minimal Smoke Test for Session Loading
 *
 * This replaces the comprehensive 433-LOC session-load.spec.ts test.
 *
 * WHY THIS IS SUFFICIENT:
 * - Business logic (merging, preservation, normalization) is fully tested in:
 *   apps/server/src/domains/room/snapshot/__tests__/SnapshotLoader.test.ts (978 LOC, 25+ tests)
 * - This smoke test only validates WebSocket transport layer works end-to-end
 * - Verifies DM can send load-session message and state updates
 *
 * WHAT'S NOT TESTED HERE (but IS tested in SnapshotLoader.test.ts):
 * - Player merging logic
 * - Character/token preservation for connected players
 * - Duplicate ID prevention
 * - Field normalization
 * - Staging zone sanitization
 * - Grid settings merge
 * - Combat state loading
 * - And 18+ other edge cases
 */

import { expect, test } from "@playwright/test";
import { joinDefaultRoomAsDM } from "./helpers";
import { SnapshotBuilder } from "../client/src/test-utils";

test.describe("Session Load - Smoke Tests", () => {
  test("DM can load session via WebSocket and state updates", async ({ page }) => {
    await joinDefaultRoomAsDM(page);

    // Create minimal snapshot using builder
    const snapshot = new SnapshotBuilder()
      .withGridSize(60)
      .withCharacter({ id: "char-smoke", name: "Smoke Test Character" })
      .withToken({ id: "token-smoke", owner: "dm-1", x: 10, y: 10 })
      .build();

    // Send load-session message via WebSocket
    const loadSuccess = await page.evaluate((s) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return false;

      data.sendMessage({
        t: "load-session",
        snapshot: s,
      });
      return true;
    }, snapshot);

    expect(loadSuccess).toBe(true);

    // Wait for WebSocket round-trip
    await page.waitForTimeout(500);

    // Verify state updated (basic check only)
    const stateUpdated = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return {
        gridSize: data?.snapshot?.gridSize,
        hasCharacters: (data?.snapshot?.characters?.length ?? 0) > 0,
        hasTokens: (data?.snapshot?.tokens?.length ?? 0) > 0,
      };
    });

    // Basic smoke test assertions
    expect(stateUpdated.gridSize).toBe(60);
    expect(stateUpdated.hasCharacters).toBe(true);
    expect(stateUpdated.hasTokens).toBe(true);

    // That's it! No need to verify every field - SnapshotLoader.test.ts handles that
  });

  test("non-DM cannot load session (authorization check)", async ({ page }) => {
    // Join as regular player (not DM)
    await page.goto("http://localhost:3000?room=test-room");
    await page.waitForTimeout(1000);

    const snapshot = new SnapshotBuilder().withGridSize(70).build();

    // Try to send load-session message
    const attemptLoad = await page.evaluate((s) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return { sent: false, error: "no sendMessage" };

      try {
        data.sendMessage({
          t: "load-session",
          snapshot: s,
        });
        return { sent: true, error: null };
      } catch (err) {
        return {
          sent: false,
          error: err instanceof Error ? err.message : "unknown",
        };
      }
    }, snapshot);

    // Non-DM should be rejected (either client-side or server-side)
    // If message was sent, verify state didn't change
    if (attemptLoad.sent) {
      await page.waitForTimeout(500);

      const gridSize = await page.evaluate(() => {
        return window.__HERO_BYTE_E2E__?.snapshot?.gridSize;
      });

      // Grid size should NOT be 70 (session load should have been rejected)
      expect(gridSize).not.toBe(70);
    }
  });
});
