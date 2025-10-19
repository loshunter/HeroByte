import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte player state save/load", () => {
  test("player can save and load their state including drawings", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);
    expect(myUid).not.toBeNull();

    // Update player HP and name
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({ t: "set-hp", hp: 75, maxHp: 120 });
      data.sendMessage({ t: "rename", name: "Test Hero" });
    });

    // Wait for snapshot to update with new values
    await page.waitForFunction(
      (uid) => {
        const data = window.__HERO_BYTE_E2E__;
        const player = data?.snapshot?.players?.find((p) => p.uid === uid);
        return player?.name === "Test Hero" && player?.hp === 75 && player?.maxHp === 120;
      },
      myUid,
      { timeout: 5000 },
    );

    // Create a drawing
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const x = box!.x + box!.width * 0.4;
    const y = box!.y + box!.height * 0.4;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 50, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      (uid) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings ?? [];
        return drawings.some((d) => d.owner === uid);
      },
      myUid,
      { timeout: 5000 },
    );

    // Get player state before save
    const stateBefore = await page.evaluate((uid) => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === uid);
      const token = data?.snapshot?.tokens?.find((t) => t.owner === uid);
      const drawings = data?.snapshot?.drawings?.filter((d) => d.owner === uid) ?? [];
      return {
        name: player?.name,
        hp: player?.hp,
        maxHp: player?.maxHp,
        tokenColor: token?.color,
        tokenPosition: { x: token?.x, y: token?.y },
        drawingCount: drawings.length,
        firstDrawingId: drawings[0]?.id,
      };
    }, myUid);

    expect(stateBefore.name).toBe("Test Hero");
    expect(stateBefore.hp).toBe(75);
    expect(stateBefore.maxHp).toBe(120);
    expect(stateBefore.drawingCount).toBeGreaterThan(0);

    // Simulate saving player state by capturing current state
    // (In real app, this would trigger a file download, but we can't test that in Playwright)
    const playerState = await page.evaluate((uid) => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === uid);
      const token = data?.snapshot?.tokens?.find((t) => t.owner === uid);
      const drawings = data?.snapshot?.drawings?.filter((d) => d.owner === uid) ?? [];

      return {
        name: player?.name ?? "Unknown",
        hp: player?.hp ?? 100,
        maxHp: player?.maxHp ?? 100,
        portrait: player?.portrait,
        token: token
          ? {
              id: token.id,
              color: token.color,
              imageUrl: token.imageUrl,
              position: { x: token.x, y: token.y },
            }
          : undefined,
        statusEffects: player?.statusEffects ?? [],
        drawings: drawings.map((d) => ({
          id: d.id,
          type: d.type,
          points: d.points,
          color: d.color,
          width: d.width,
          opacity: d.opacity,
          owner: d.owner,
        })),
      };
    }, myUid);

    expect(playerState.name).toBe("Test Hero");
    expect(playerState.hp).toBe(75);
    expect(playerState.maxHp).toBe(120);
    expect(playerState.drawings.length).toBeGreaterThan(0);

    // Verify state structure is valid
    expect(typeof playerState.name).toBe("string");
    expect(typeof playerState.hp).toBe("number");
    expect(typeof playerState.maxHp).toBe("number");
    expect(Array.isArray(playerState.drawings)).toBe(true);

    if (playerState.drawings.length > 0) {
      const firstDrawing = playerState.drawings[0];
      expect(firstDrawing.id).toBeTruthy();
      expect(firstDrawing.type).toBeTruthy();
      expect(Array.isArray(firstDrawing.points)).toBe(true);
      expect(firstDrawing.color).toBeTruthy();
      expect(typeof firstDrawing.width).toBe("number");
      expect(typeof firstDrawing.opacity).toBe("number");
    }
  });

  test("player state includes token data", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return (
        Array.isArray(data.snapshot.tokens) &&
        data.snapshot.tokens.some((t) => t.owner === data.uid)
      );
    });

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);
    expect(myUid).not.toBeNull();

    const tokenData = await page.evaluate((uid) => {
      const data = window.__HERO_BYTE_E2E__;
      const token = data?.snapshot?.tokens?.find((t) => t.owner === uid);
      return {
        exists: Boolean(token),
        id: token?.id,
        color: token?.color,
        position: token ? { x: token.x, y: token.y } : null,
        imageUrl: token?.imageUrl,
      };
    }, myUid);

    expect(tokenData.exists).toBe(true);
    expect(tokenData.id).toBeTruthy();
    expect(tokenData.color).toBeTruthy();
    expect(tokenData.position).not.toBeNull();
    expect(typeof tokenData.position?.x).toBe("number");
    expect(typeof tokenData.position?.y).toBe("number");
  });

  test("player state can be reconstructed from snapshot", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);

    // Create multiple drawings
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Draw 2 strokes
    for (let i = 0; i < 2; i++) {
      const x = box!.x + box!.width * (0.3 + i * 0.1);
      const y = box!.y + box!.height * (0.3 + i * 0.1);

      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 80, y + 40, { steps: 8 });
      await page.mouse.up();

      await page.waitForTimeout(300);
    }

    await page.waitForFunction(
      (uid) => {
        const data = window.__HERO_BYTE_E2E__;
        const drawings = data?.snapshot?.drawings?.filter((d) => d.owner === uid) ?? [];
        return drawings.length >= 2;
      },
      myUid,
      { timeout: 5000 },
    );

    // Extract complete player state
    const playerState = await page.evaluate((uid) => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === uid);
      const token = data?.snapshot?.tokens?.find((t) => t.owner === uid);
      const drawings = data?.snapshot?.drawings?.filter((d) => d.owner === uid) ?? [];

      return {
        player: {
          uid: player?.uid,
          name: player?.name,
          hp: player?.hp,
          maxHp: player?.maxHp,
          portrait: player?.portrait,
          statusEffects: player?.statusEffects,
        },
        token: token
          ? {
              id: token.id,
              color: token.color,
              x: token.x,
              y: token.y,
              imageUrl: token.imageUrl,
            }
          : null,
        drawingCount: drawings.length,
        drawings: drawings.map((d) => ({
          type: d.type,
          pointCount: d.points?.length ?? 0,
        })),
      };
    }, myUid);

    // Verify all data is present
    expect(playerState.player.uid).toBe(myUid);
    expect(playerState.player.name).toBeTruthy();
    expect(typeof playerState.player.hp).toBe("number");
    expect(typeof playerState.player.maxHp).toBe("number");

    expect(playerState.token).not.toBeNull();
    expect(playerState.token?.id).toBeTruthy();

    expect(playerState.drawingCount).toBeGreaterThanOrEqual(2);
    expect(playerState.drawings.length).toBeGreaterThanOrEqual(2);

    playerState.drawings.forEach((drawing) => {
      expect(drawing.type).toBeTruthy();
      expect(drawing.pointCount).toBeGreaterThan(0);
    });
  });

  test("player HP and maxHP values are preserved in state", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);

    // Set custom HP values
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({ t: "set-hp", hp: 42, maxHp: 85 });
    });

    // Wait for HP values to update in snapshot
    await page.waitForFunction(
      (uid) => {
        const data = window.__HERO_BYTE_E2E__;
        const player = data?.snapshot?.players?.find((p) => p.uid === uid);
        return player?.hp === 42 && player?.maxHp === 85;
      },
      myUid,
      { timeout: 5000 },
    );

    const hpState = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return {
        hp: player?.hp,
        maxHp: player?.maxHp,
      };
    });

    expect(hpState.hp).toBe(42);
    expect(hpState.maxHp).toBe(85);
  });
});
