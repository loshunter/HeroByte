/**
 * DEPRECATED: This e2e test file is being replaced by:
 * 1. Integration tests: apps/server/src/domains/room/staging/__tests__/StagingZoneManager.test.ts
 *    - 28 tests covering all business logic (validation, normalization, spawn position)
 *    - Runtime: 16ms (vs this file which had 6 skipped tests + 1 slow active test)
 * 2. Authorization tests: apps/server/src/ws/__tests__/characterization/authorization.characterization.test.ts
 *    - Verifies set-player-staging-zone is DM-only
 * 3. Smoke test: apps/e2e/staging-zone.smoke.spec.ts
 *    - 1 test for WebSocket transport validation only
 *    - Runtime: ~5s
 *
 * ORIGINAL STATUS: 6 tests were already SKIPPED (toggle-dm doesn't work in e2e), 1 active
 * NEW STATUS: All coverage maintained with faster, more reliable tests
 *
 * This file will be removed after 1 sprint of running both test suites in parallel.
 * See: docs/testing/E2E_TO_INTEGRATION_MIGRATION.md
 *
 * DO NOT ADD NEW TESTS TO THIS FILE - Add them to StagingZoneManager.test.ts instead.
 */

import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

// NOTE: Most tests in this file are skipped because the toggle-dm message
// doesn't work reliably in E2E tests. The server-side staging zone logic is
// still covered by unit tests. The one active test verifies that non-DM players
// cannot set the staging zone.

test.describe("HeroByte player staging zone (DEPRECATED)", () => {
  test.skip("DM can create a staging zone and it appears in the snapshot", async ({ page }) => {
    // NOTE: Skipping because toggle-dm message doesn't work in E2E tests
    // The server-side logic for staging zones is tested via unit tests instead
    await joinDefaultRoom(page);

    // Wait for THIS player to exist in the snapshot
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    // Enable DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: true });
    });

    // Wait for DM status to update
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === true;
    });

    // Create a staging zone
    const testZone = {
      x: 5,
      y: 5,
      width: 10,
      height: 8,
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

    await page.waitForTimeout(500);

    // Verify staging zone appears in snapshot
    const stagingZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    expect(stagingZone).not.toBeNull();
    expect(stagingZone?.x).toBe(5);
    expect(stagingZone?.y).toBe(5);
    expect(stagingZone?.width).toBe(10);
    expect(stagingZone?.height).toBe(8);
    expect(stagingZone?.rotation).toBe(0);
  });

  test.skip("DM can clear the staging zone", async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for THIS player to exist in the snapshot
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    // Enable DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: true });
    });

    // Wait for DM status to update
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === true;
    });

    // Create a staging zone first
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone: { x: 5, y: 5, width: 10, height: 8 },
      });
    });

    await page.waitForTimeout(500);

    // Verify it exists
    let stagingZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });
    expect(stagingZone).not.toBeNull();

    // Clear the staging zone
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone: undefined,
      });
    });

    await page.waitForTimeout(500);

    // Verify it's cleared
    stagingZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });
    expect(stagingZone).toBeUndefined();
  });

  test.skip("staging zone validates coordinates and normalizes dimensions", async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for THIS player to exist in the snapshot
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    // Enable DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: true });
    });

    // Wait for DM status to update
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === true;
    });

    // Try to create a staging zone with negative dimensions
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone: { x: 10, y: 10, width: -5, height: -5 },
      });
    });

    await page.waitForTimeout(500);

    // Verify negative dimensions are normalized to positive
    const stagingZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    expect(stagingZone).not.toBeNull();
    expect(stagingZone?.width).toBeGreaterThan(0);
    expect(stagingZone?.height).toBeGreaterThan(0);
  });

  test.skip("staging zone persists in session snapshot", async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for THIS player to exist in the snapshot
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    // Enable DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: true });
    });

    // Wait for DM status to update
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === true;
    });

    // Create a staging zone
    const testZone = {
      x: 15,
      y: 20,
      width: 12,
      height: 10,
      rotation: 45,
    };

    await page.evaluate((zone) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone,
      });
    }, testZone);

    await page.waitForTimeout(500);

    // Get the current snapshot
    const snapshot = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot ?? null;
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.playerStagingZone).toBeTruthy();
    expect(snapshot?.playerStagingZone?.x).toBe(15);
    expect(snapshot?.playerStagingZone?.y).toBe(20);
    expect(snapshot?.playerStagingZone?.width).toBe(12);
    expect(snapshot?.playerStagingZone?.height).toBe(10);
    expect(snapshot?.playerStagingZone?.rotation).toBe(45);

    // Simulate session load with the staging zone
    await page.evaluate((snap) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !snap) return;
      data.sendMessage({
        t: "load-session",
        snapshot: snap,
      });
    }, snapshot);

    await page.waitForTimeout(1000);

    // Verify staging zone persisted after load
    const reloadedZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    expect(reloadedZone).not.toBeNull();
    expect(reloadedZone?.x).toBe(15);
    expect(reloadedZone?.y).toBe(20);
    expect(reloadedZone?.width).toBe(12);
    expect(reloadedZone?.height).toBe(10);
    expect(reloadedZone?.rotation).toBe(45);
  });

  test.skip("staging zone supports rotation property", async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for THIS player to exist in the snapshot
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    // Enable DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: true });
    });

    // Wait for DM status to update
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === true;
    });

    // Create staging zone with rotation
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone: { x: 0, y: 0, width: 10, height: 10, rotation: 90 },
      });
    });

    await page.waitForTimeout(500);

    const stagingZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    expect(stagingZone).not.toBeNull();
    expect(stagingZone?.rotation).toBe(90);
  });

  test.skip("staging zone defaults rotation to 0 when not provided", async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for THIS player to exist in the snapshot
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    // Enable DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: true });
    });

    // Wait for DM status to update
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === true;
    });

    // Create staging zone without rotation
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone: { x: 0, y: 0, width: 10, height: 10 },
      });
    });

    await page.waitForTimeout(500);

    const stagingZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    expect(stagingZone).not.toBeNull();
    expect(stagingZone?.rotation).toBe(0);
  });

  test("non-DM players cannot set staging zone", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return Array.isArray(data.snapshot.players) && data.snapshot.players.length > 0;
    });

    // Ensure we're NOT in DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: false });
    });

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === false;
    });

    const initialZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    // Try to create a staging zone as non-DM
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "set-player-staging-zone",
        zone: { x: 5, y: 5, width: 10, height: 10 },
      });
    });

    await page.waitForTimeout(500);

    // Verify staging zone was not created
    const finalZone = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.playerStagingZone ?? null;
    });

    // Should remain unchanged
    expect(finalZone).toEqual(initialZone);
  });
});
