import { expect, test } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";

test.describe("Staging Zone Visual Rendering", () => {
  test("staging zone appears on canvas when DM sets it", async ({ page }, testInfo) => {
    await joinDefaultRoomAsDM(page);

    // Wait for room to be ready
    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    console.log("DM elevation successful");

    // Create a staging zone
    const testZone = {
      x: 0,
      y: 0,
      width: 6,
      height: 6,
      rotation: 0,
    };

    await page.evaluate((zone) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      console.log("Sending set-player-staging-zone message:", zone);
      data.sendMessage({
        t: "set-player-staging-zone",
        zone,
      });
    }, testZone);

    await page.waitForFunction(
      (zone) => {
        const current = window.__HERO_BYTE_E2E__?.snapshot?.playerStagingZone;
        return (
          current?.x === zone.x &&
          current.y === zone.y &&
          current.width === zone.width &&
          current.height === zone.height
        );
      },
      testZone,
      { timeout: 15_000 },
    );

    // Check if staging zone is in the snapshot
    const snapshotCheck = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return {
        playerStagingZone: data?.snapshot?.playerStagingZone ?? null,
        sceneObjects: data?.snapshot?.sceneObjects ?? [],
      };
    });

    console.log("Snapshot check:", JSON.stringify(snapshotCheck, null, 2));

    expect(snapshotCheck.playerStagingZone).not.toBeNull();
    expect(snapshotCheck.playerStagingZone?.x).toBe(0);
    expect(snapshotCheck.playerStagingZone?.y).toBe(0);

    // Check if staging-zone scene object exists
    const stagingZoneObject = snapshotCheck.sceneObjects.find(
      (obj: any) => obj.type === "staging-zone",
    );
    console.log("Staging zone scene object:", JSON.stringify(stagingZoneObject, null, 2));
    expect(stagingZoneObject).toBeDefined();
    expect(stagingZoneObject?.id).toBe("staging-zone");

    // Take a screenshot to visually verify
    await page.screenshot({ path: testInfo.outputPath("staging-zone-test.png") });

    // Check if the staging zone is actually rendered on the canvas
    // Look for the cyan/teal stroke color in the canvas
    const canvasCheck = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("canvas"));
      if (canvases.length === 0) return { found: false, reason: "No canvas element found" };

      // Look for cyan/teal color (rgba(77, 229, 192, ...))
      // The staging zone uses stroke="rgba(77, 229, 192, 0.75)"
      let cyanPixelCount = 0;
      for (const canvas of canvases) {
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (
            Math.abs(r - 77) < 30 &&
            Math.abs(g - 229) < 30 &&
            Math.abs(b - 192) < 30 &&
            data[i + 3] > 0
          ) {
            cyanPixelCount++;
          }
        }
      }

      return {
        found: cyanPixelCount > 0,
        reason: cyanPixelCount > 0 ? `Found ${cyanPixelCount} cyan pixels` : "No cyan pixels found",
        canvasCount: canvases.length,
      };
    });

    console.log("Canvas check:", canvasCheck);

    // The staging zone should be visible on the canvas
    expect(canvasCheck.found).toBe(true);
  });

  test("staging zone renders with custom position", async ({ page }, testInfo) => {
    await joinDefaultRoomAsDM(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    // Set grid size to a known value
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({ t: "grid-size", size: 50 });
    });

    await page.waitForTimeout(500);

    // Create a staging zone at position (5, 5) with size 10x8
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

    await page.waitForFunction(
      (zone) => {
        const stagingObject = window.__HERO_BYTE_E2E__?.snapshot?.sceneObjects?.find(
          (object) => object.type === "staging-zone",
        );
        return (
          stagingObject?.transform.x === zone.x &&
          stagingObject.transform.y === zone.y &&
          stagingObject.data.width === zone.width &&
          stagingObject.data.height === zone.height
        );
      },
      testZone,
      { timeout: 15_000 },
    );

    // Verify the scene object has correct dimensions
    const sceneObjectCheck = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const stagingObj = data?.snapshot?.sceneObjects?.find(
        (obj: any) => obj.type === "staging-zone",
      );
      return {
        found: !!stagingObj,
        transform: stagingObj?.transform,
        data: stagingObj?.data,
      };
    });

    console.log("Scene object check:", JSON.stringify(sceneObjectCheck, null, 2));

    expect(sceneObjectCheck.found).toBe(true);
    expect(sceneObjectCheck.transform?.x).toBe(5);
    expect(sceneObjectCheck.transform?.y).toBe(5);
    expect(sceneObjectCheck.data?.width).toBe(10);
    expect(sceneObjectCheck.data?.height).toBe(8);

    await page.screenshot({ path: testInfo.outputPath("staging-zone-custom-position.png") });
  });

  test("no staging zone visible when not set", async ({ page }) => {
    await joinDefaultRoomAsDM(page);

    await page.evaluate(() => {
      window.__HERO_BYTE_E2E__?.sendMessage?.({
        t: "set-player-staging-zone",
        zone: undefined,
      });
    });

    await page.waitForFunction(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.playerStagingZone === undefined;
    });

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return data.snapshot.players.some((p) => p.uid === data.uid);
    });

    await page.waitForTimeout(500);

    // Check that no staging zone exists initially
    const check = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return {
        playerStagingZone: data?.snapshot?.playerStagingZone,
        stagingZoneObject: data?.snapshot?.sceneObjects?.find(
          (obj: any) => obj.type === "staging-zone",
        ),
      };
    });

    console.log("Initial state check:", check);

    expect(check.playerStagingZone).toBeUndefined();
    expect(check.stagingZoneObject).toBeUndefined();
  });
});
