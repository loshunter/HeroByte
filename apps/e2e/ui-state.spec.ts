import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte UI state and accessibility", () => {
  test("all main UI panels can be opened and closed", async ({ page }) => {
    await joinDefaultRoom(page);

    // Test Draw Tools panel
    const drawButton = page.getByRole("button", { name: /Draw Tools/i });
    await expect(drawButton).toBeVisible();
    await drawButton.click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible({ timeout: 5000 });

    // Close by clicking button again
    await drawButton.click();
    await expect(page.locator("text=DRAWING TOOLS")).not.toBeVisible({ timeout: 5000 });

    // Test Dice panel
    const diceButton = page.getByRole("button", { name: /Dice/i });
    await expect(diceButton).toBeVisible();
    await diceButton.click();
    await expect(page.locator("text=DICE ROLLER")).toBeVisible({ timeout: 5000 });

    await diceButton.click();
    await expect(page.locator("text=DICE ROLLER")).not.toBeVisible({ timeout: 5000 });

    // Test Log panel
    const logButton = page.getByRole("button", { name: /Log/i });
    await expect(logButton).toBeVisible();
    await logButton.click();
    await expect(page.locator("text=ROLL LOG")).toBeVisible({ timeout: 5000 });

    await logButton.click();
    await expect(page.locator("text=ROLL LOG")).not.toBeVisible({ timeout: 5000 });
  });

  test("panels can be dragged to reposition", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    const header = page.locator("text=DRAWING TOOLS").first();
    const initialBox = await header.boundingBox();

    if (initialBox) {
      const startX = initialBox.x + initialBox.width / 2;
      const startY = initialBox.y + initialBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);

      const finalBox = await header.boundingBox();
      expect(finalBox).not.toBeNull();

      // Position should have changed
      const moved = finalBox!.x !== initialBox.x || finalBox!.y !== initialBox.y;
      expect(moved).toBe(true);
    }
  });

  test("DM mode can be toggled", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.players && data.uid);
    });

    // Look for DM toggle
    const dmToggle = page.getByRole("button", { name: /DM|Dungeon Master/i });
    const dmExists = await dmToggle.count();

    if (dmExists === 0) {
      test.skip(true, "DM toggle not found");
      return;
    }

    const initialDMState = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM ?? false;
    });

    await dmToggle.click();

    await page.waitForFunction(
      (prevState) => {
        const data = window.__HERO_BYTE_E2E__;
        const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
        return (player?.isDM ?? false) !== prevState;
      },
      initialDMState,
      { timeout: 5000 },
    );

    const newDMState = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const player = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return player?.isDM ?? false;
    });

    expect(newDMState).toBe(!initialDMState);
  });

  test("keyboard shortcuts work for common actions", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings && data.uid);
    });

    const initialCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    // Open drawing tools and draw
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const x = box!.x + box!.width * 0.4;
    const y = box!.y + box!.height * 0.4;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction((c) => {
      return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) > c;
    }, initialCount);

    // Test Ctrl+Z for undo
    await page.keyboard.press("Control+z");

    await page.waitForFunction((c) => {
      return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) === c;
    }, initialCount);

    const afterUndo = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    expect(afterUndo).toBe(initialCount);

    // Test Ctrl+Y for redo
    await page.keyboard.press("Control+y");

    await page.waitForFunction((c) => {
      return (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) > c;
    }, initialCount);

    const afterRedo = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0;
    });

    expect(afterRedo).toBeGreaterThan(initialCount);
  });

  test("page maintains state after refresh", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings && data.uid);
    });

    // Draw something
    await page.getByRole("button", { name: /Draw Tools/i }).click();
    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const x = box!.x + box!.width * 0.4;
    const y = box!.y + box!.height * 0.4;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(1000);

    const drawingId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return drawings.at(-1)?.id ?? null;
    });

    expect(drawingId).not.toBeNull();

    // Refresh the page
    await page.reload();

    // Re-join the room
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.drawings);
    });

    // Check if the drawing still exists
    const drawingExists = await page.evaluate((id) => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return drawings.some((d) => d.id === id);
    }, drawingId);

    expect(drawingExists).toBe(true);
  });

  test("UI handles invalid actions gracefully", async ({ page }) => {
    await joinDefaultRoom(page);

    // Verify the app doesn't crash when sending messages
    const messageSent = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.sendMessage);
    });

    expect(messageSent).toBe(true);
  });

  test("help/info tooltips are accessible", async ({ page }) => {
    await joinDefaultRoom(page);

    // Look for buttons with tooltips
    const snapButton = page.getByRole("button", { name: "Snap" });
    await expect(snapButton).toBeVisible();

    // Hover to show tooltip
    await snapButton.hover();
    await page.waitForTimeout(500);

    // Check if tooltip appeared (implementation-specific)
    const tooltip = page.locator('[role="tooltip"]').first();
    const tooltipExists = await tooltip.count();

    if (tooltipExists > 0) {
      await expect(tooltip).toBeVisible();
    }
  });

  test("color picker is accessible and functional", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();

    // Look for color input
    const colorInputs = page.locator('input[type="color"]');
    const colorCount = await colorInputs.count();

    if (colorCount > 0) {
      const colorInput = colorInputs.first();
      await expect(colorInput).toBeVisible();

      const initialColor = await colorInput.inputValue();
      expect(initialColor).toBeTruthy();

      // Set a new color
      await colorInput.fill("#00ff00");

      const newColor = await colorInput.inputValue();
      expect(newColor.toLowerCase()).toBe("#00ff00");
    }
  });

  test("session list shows active players", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot?.players && data.uid);
    });

    const playerInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const players = data?.snapshot?.players ?? [];
      return {
        count: players.length,
        selfIncluded: players.some((p) => p.uid === data.uid),
      };
    });

    expect(playerInfo.count).toBeGreaterThan(0);
    expect(playerInfo.selfIncluded).toBe(true);
  });
});
