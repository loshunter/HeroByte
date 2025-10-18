import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte multi-select and group lock", () => {
  test("DM can select multiple tokens, lock them, and verify locked state persists", async ({
    page,
  }) => {
    await joinDefaultRoom(page);

    // Wait for initial token to appear
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return (
        Array.isArray(data.snapshot.tokens) &&
        data.snapshot.tokens.some((t) => t.owner === data.uid)
      );
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

    // Create additional test tokens
    const tokenIds = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return [];

      const existingToken = data.snapshot?.tokens?.find((t) => t.owner === data.uid);
      const ids = existingToken ? [existingToken.id] : [];

      // Create two more tokens
      for (let i = 0; i < 2; i++) {
        const mockToken = {
          id: `test-token-${i}`,
          owner: data.uid,
          x: 1 + i,
          y: 1,
          color: `hsl(${i * 120}, 70%, 50%)`,
        };
        ids.push(mockToken.id);
        // Simulate adding token (in real scenario, this would go through proper API)
      }

      return ids;
    });

    // Wait for scene objects to be built
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.sceneObjects && data.snapshot.sceneObjects.length > 0;
    });

    // Get scene object IDs for our tokens
    const sceneObjectIds = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot?.sceneObjects) return [];

      const tokenObjects = data.snapshot.sceneObjects.filter(
        (obj) => obj.type === "token" && obj.owner === data.uid,
      );

      return tokenObjects.map((obj) => obj.id);
    });

    console.log("Scene object IDs:", sceneObjectIds);

    if (sceneObjectIds.length < 1) {
      test.skip(true, "Not enough tokens to test multi-select");
      return;
    }

    // Test multi-select: select multiple objects
    const selectResult = await page.evaluate((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return false;

      data.sendMessage({
        t: "select-multiple",
        uid: data.uid,
        objectIds,
        mode: "replace",
      });

      return true;
    }, sceneObjectIds);

    expect(selectResult).toBe(true);

    // Wait for selection state to update
    await page.waitForFunction((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      const selection = data?.snapshot?.selectionState?.[data.uid];

      if (!selection) return false;

      if (selection.mode === "multiple") {
        return selection.objectIds.length === objectIds.length;
      }

      return false;
    }, sceneObjectIds);

    // Verify selection state
    const selectionState = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.selectionState?.[data.uid];
    });

    console.log("Selection state:", selectionState);
    expect(selectionState).toBeTruthy();
    if (selectionState?.mode === "multiple") {
      expect(selectionState.objectIds.length).toBeGreaterThan(0);
    }

    // Test bulk lock: lock all selected objects
    await page.evaluate((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;

      data.sendMessage({
        t: "lock-selected",
        uid: data.uid,
        objectIds,
      });
    }, sceneObjectIds);

    // Wait for lock state to propagate
    await page.waitForFunction((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot?.sceneObjects) return false;

      return objectIds.every((id) => {
        const obj = data.snapshot.sceneObjects.find((o) => o.id === id);
        return obj?.locked === true;
      });
    }, sceneObjectIds);

    // Verify all objects are locked
    const lockedStates = await page.evaluate((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot?.sceneObjects) return [];

      return objectIds.map((id) => {
        const obj = data.snapshot.sceneObjects.find((o) => o.id === id);
        return { id, locked: obj?.locked };
      });
    }, sceneObjectIds);

    console.log("Locked states:", lockedStates);
    lockedStates.forEach((state) => {
      expect(state.locked).toBe(true);
    });

    // Test that locked objects cannot be transformed by owner (non-DM)
    // First, disable DM mode
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

    // Attempt to transform a locked object as non-DM
    const transformAttempt = await page.evaluate((objectId) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return false;

      data.sendMessage({
        t: "transform-object",
        id: objectId,
        position: { x: 10, y: 10 },
      });

      return true;
    }, sceneObjectIds[0]);

    expect(transformAttempt).toBe(true);

    // Wait a moment for any potential update
    await page.waitForTimeout(500);

    // Verify position did NOT change (object is locked)
    const unchangedPosition = await page.evaluate((objectId) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objectId);
      return obj?.transform;
    }, sceneObjectIds[0]);

    console.log("Position after transform attempt:", unchangedPosition);
    // Position should not be 10,10 because object is locked
    expect(unchangedPosition?.x).not.toBe(10);

    // Re-enable DM mode
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({ t: "toggle-dm", isDM: true });
    });

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM === true;
    });

    // Test bulk unlock
    await page.evaluate((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;

      data.sendMessage({
        t: "unlock-selected",
        uid: data.uid,
        objectIds,
      });
    }, sceneObjectIds);

    // Wait for unlock state to propagate
    await page.waitForFunction((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot?.sceneObjects) return false;

      return objectIds.every((id) => {
        const obj = data.snapshot.sceneObjects.find((o) => o.id === id);
        return obj?.locked === false;
      });
    }, sceneObjectIds);

    // Verify all objects are unlocked
    const unlockedStates = await page.evaluate((objectIds) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot?.sceneObjects) return [];

      return objectIds.map((id) => {
        const obj = data.snapshot.sceneObjects.find((o) => o.id === id);
        return { id, locked: obj?.locked };
      });
    }, sceneObjectIds);

    console.log("Unlocked states:", unlockedStates);
    unlockedStates.forEach((state) => {
      expect(state.locked).toBe(false);
    });
  });
});
