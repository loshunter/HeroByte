import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte transform tool", () => {
  test("player can select and move a scene object", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot && data.uid);
      },
      { timeout: 10000 },
    );

    const hasSceneObjects = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.sceneObjects?.length ?? 0) > 0;
    });

    if (!hasSceneObjects) {
      test.skip(true, "No scene objects to transform");
      return;
    }

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

    await page.waitForFunction(
      (objId) => {
        const data = window.__HERO_BYTE_E2E__;
        const selection = data?.snapshot?.selectionState?.[data.uid];
        return selection?.mode === "single" && selection?.objectId === objId;
      },
      objectInfo.id,
      { timeout: 5000 },
    );

    // Transform the object
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

    await page.waitForFunction(
      ({ objId, targetX, targetY }) => {
        const data = window.__HERO_BYTE_E2E__;
        const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
        return obj?.transform?.x === targetX && obj?.transform?.y === targetY;
      },
      { objId: objectInfo.id, targetX: newX, targetY: newY },
      { timeout: 5000 },
    );

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
  });

  test("player can rotate a scene object", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.sceneObjects && data.uid);
    });

    const hasSceneObjects = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.sceneObjects?.length ?? 0) > 0;
    });

    if (!hasSceneObjects) {
      test.skip(true, "No scene objects to transform");
      return;
    }

    const objectInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.[0];
      return {
        id: obj?.id ?? null,
        initialRotation: obj?.transform?.rotation ?? 0,
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

    await page.waitForTimeout(500);

    // Rotate the object by 45 degrees
    const newRotation = objectInfo.initialRotation + 45;

    await page.evaluate(
      ({ objId, rotation }) => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.sendMessage) return;
        data.sendMessage({
          t: "transform-object",
          id: objId,
          rotation,
        });
      },
      { objId: objectInfo.id, rotation: newRotation },
    );

    await page.waitForFunction(
      ({ objId, targetRotation }) => {
        const data = window.__HERO_BYTE_E2E__;
        const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
        return Math.abs((obj?.transform?.rotation ?? 0) - targetRotation) < 0.01;
      },
      { objId: objectInfo.id, targetRotation: newRotation },
      { timeout: 5000 },
    );

    const finalRotation = await page.evaluate((objId) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
      return obj?.transform?.rotation ?? 0;
    }, objectInfo.id);

    expect(Math.abs(finalRotation - newRotation)).toBeLessThan(0.01);
  });

  test("player can scale a scene object", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.sceneObjects && data.uid);
    });

    const hasSceneObjects = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.sceneObjects?.length ?? 0) > 0;
    });

    if (!hasSceneObjects) {
      test.skip(true, "No scene objects to transform");
      return;
    }

    const objectInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.[0];
      return {
        id: obj?.id ?? null,
        initialScaleX: obj?.transform?.scaleX ?? 1,
        initialScaleY: obj?.transform?.scaleY ?? 1,
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

    await page.waitForTimeout(500);

    // Scale the object
    const newScaleX = objectInfo.initialScaleX * 1.5;
    const newScaleY = objectInfo.initialScaleY * 1.5;

    await page.evaluate(
      ({ objId, scaleX, scaleY }) => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.sendMessage) return;
        data.sendMessage({
          t: "transform-object",
          id: objId,
          scale: { x: scaleX, y: scaleY },
        });
      },
      { objId: objectInfo.id, scaleX: newScaleX, scaleY: newScaleY },
    );

    await page.waitForFunction(
      ({ objId, targetScaleX, targetScaleY }) => {
        const data = window.__HERO_BYTE_E2E__;
        const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
        const scaleX = obj?.transform?.scaleX ?? 1;
        const scaleY = obj?.transform?.scaleY ?? 1;
        return Math.abs(scaleX - targetScaleX) < 0.01 && Math.abs(scaleY - targetScaleY) < 0.01;
      },
      { objId: objectInfo.id, targetScaleX: newScaleX, targetScaleY: newScaleY },
      { timeout: 5000 },
    );

    const finalScale = await page.evaluate((objId) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
      return {
        scaleX: obj?.transform?.scaleX ?? 1,
        scaleY: obj?.transform?.scaleY ?? 1,
      };
    }, objectInfo.id);

    expect(Math.abs(finalScale.scaleX - newScaleX)).toBeLessThan(0.01);
    expect(Math.abs(finalScale.scaleY - newScaleY)).toBeLessThan(0.01);
  });

  test("DM can transform locked objects", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.sceneObjects && data.uid);
    });

    // Enable DM mode
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

    const hasSceneObjects = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.sceneObjects?.length ?? 0) > 0;
    });

    if (!hasSceneObjects) {
      test.skip(true, "No scene objects to test");
      return;
    }

    const objectId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.sceneObjects?.[0]?.id ?? null;
    });

    expect(objectId).not.toBeNull();

    // Lock the object
    await page.evaluate((objId) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage || !data.uid) return;
      data.sendMessage({
        t: "lock-selected",
        uid: data.uid,
        objectIds: [objId],
      });
    }, objectId);

    await page.waitForFunction(
      (objId) => {
        const data = window.__HERO_BYTE_E2E__;
        const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
        return obj?.locked === true;
      },
      objectId,
      { timeout: 5000 },
    );

    // As DM, should still be able to transform
    const initialPos = await page.evaluate((objId) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
      return { x: obj?.transform?.x ?? 0, y: obj?.transform?.y ?? 0 };
    }, objectId);

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
      { objId: objectId, x: initialPos.x + 100, y: initialPos.y + 50 },
    );

    await page.waitForFunction(
      ({ objId, targetX, targetY }) => {
        const data = window.__HERO_BYTE_E2E__;
        const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
        return obj?.transform?.x === targetX && obj?.transform?.y === targetY;
      },
      { objId: objectId, targetX: initialPos.x + 100, targetY: initialPos.y + 50 },
      { timeout: 5000 },
    );

    const finalPos = await page.evaluate((objId) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === objId);
      return { x: obj?.transform?.x ?? 0, y: obj?.transform?.y ?? 0 };
    }, objectId);

    expect(finalPos.x).toBe(initialPos.x + 100);
    expect(finalPos.y).toBe(initialPos.y + 50);
  });

  test("player staging zone is transformable", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.sceneObjects && data.uid);
    });

    // Look for staging zone object
    const stagingZoneId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const stagingZone = data?.snapshot?.sceneObjects?.find(
        (obj) => obj.type === "staging-zone" && obj.owner === data.uid,
      );
      return stagingZone?.id ?? null;
    });

    if (!stagingZoneId) {
      test.skip(true, "No staging zone found");
      return;
    }

    const initialTransform = await page.evaluate((id) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === id);
      return {
        x: obj?.transform?.x ?? 0,
        y: obj?.transform?.y ?? 0,
        scaleX: obj?.transform?.scaleX ?? 1,
      };
    }, stagingZoneId);

    // Transform staging zone
    const newX = initialTransform.x + 50;
    const newY = initialTransform.y + 50;

    await page.evaluate(
      ({ id, x, y }) => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.sendMessage) return;
        data.sendMessage({
          t: "transform-object",
          id,
          position: { x, y },
        });
      },
      { id: stagingZoneId, x: newX, y: newY },
    );

    await page.waitForFunction(
      ({ id, targetX, targetY }) => {
        const data = window.__HERO_BYTE_E2E__;
        const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === id);
        return obj?.transform?.x === targetX && obj?.transform?.y === targetY;
      },
      { id: stagingZoneId, targetX: newX, targetY: newY },
      { timeout: 5000 },
    );

    const finalTransform = await page.evaluate((id) => {
      const data = window.__HERO_BYTE_E2E__;
      const obj = data?.snapshot?.sceneObjects?.find((o) => o.id === id);
      return {
        x: obj?.transform?.x ?? 0,
        y: obj?.transform?.y ?? 0,
      };
    }, stagingZoneId);

    expect(finalTransform.x).toBe(newX);
    expect(finalTransform.y).toBe(newY);
  });
});
