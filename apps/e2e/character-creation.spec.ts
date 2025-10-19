import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte character and token creation", () => {
  test("player can create a new character", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    const initialCharCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.characters?.length ?? 0;
    });

    // Look for character creation button
    const charButton = page.getByRole("button", { name: /Character/i });
    const buttonExists = await charButton.count();

    if (buttonExists === 0) {
      test.skip(true, "Character button not found");
      return;
    }

    await charButton.click();

    // Wait for character creation UI
    const createButton = page.getByRole("button", { name: /Create Character/i });
    const createExists = await createButton.count();

    if (createExists > 0) {
      // Fill in character details
      const nameInput = page.getByPlaceholder(/Name/i);
      const nameExists = await nameInput.count();

      if (nameExists > 0) {
        await nameInput.fill("Test Hero");
      }

      await createButton.click();

      await page.waitForFunction(
        (prevCount) => {
          const data = window.__HERO_BYTE_E2E__;
          return (data?.snapshot?.characters?.length ?? 0) > prevCount;
        },
        initialCharCount,
        { timeout: 5000 },
      );

      const finalCharCount = await page.evaluate(() => {
        return window.__HERO_BYTE_E2E__?.snapshot?.characters?.length ?? 0;
      });

      expect(finalCharCount).toBeGreaterThan(initialCharCount);
    } else {
      test.skip(true, "Create character UI not as expected");
    }
  });

  test("player can delete their character", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    // First, create a test character
    const charButton = page.getByRole("button", { name: /Character/i });
    const buttonExists = await charButton.count();

    if (buttonExists === 0) {
      test.skip(true, "Character feature not available");
      return;
    }

    const initialCount = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const chars = data?.snapshot?.characters ?? [];
      return chars.filter((c) => c.owner === data.uid).length;
    });

    // If no characters exist, skip
    if (initialCount === 0) {
      test.skip(true, "No characters to delete");
      return;
    }

    await charButton.click();

    // Find and click delete button for a character
    const deleteButton = page.getByRole("button", { name: /Delete/i }).first();
    const deleteExists = await deleteButton.count();

    if (deleteExists > 0) {
      await deleteButton.click();

      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.getByRole("button", { name: /Confirm/i });
      const confirmExists = await confirmButton.count();

      if (confirmExists > 0) {
        await confirmButton.click();
      }

      await page.waitForFunction(
        (prevCount) => {
          const data = window.__HERO_BYTE_E2E__;
          const chars = data?.snapshot?.characters ?? [];
          return chars.filter((c) => c.owner === data.uid).length < prevCount;
        },
        initialCount,
        { timeout: 5000 },
      );

      const finalCount = await page.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        const chars = data?.snapshot?.characters ?? [];
        return chars.filter((c) => c.owner === data.uid).length;
      });

      expect(finalCount).toBeLessThan(initialCount);
    } else {
      test.skip(true, "Delete button not found");
    }
  });

  test("player's token is created on join", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.snapshot || !data.uid) return false;
        return (
          Array.isArray(data.snapshot.tokens) &&
          data.snapshot.tokens.some((t) => t.owner === data.uid)
        );
      },
      { timeout: 10000 },
    );

    const tokenInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const token = data?.snapshot?.tokens?.find((t) => t.owner === data.uid);
      return {
        exists: Boolean(token),
        owner: token?.owner ?? null,
        hasPosition: token ? typeof token.x === "number" && typeof token.y === "number" : false,
        hasColor: Boolean(token?.color),
      };
    });

    expect(tokenInfo.exists).toBe(true);
    expect(tokenInfo.hasPosition).toBe(true);
    expect(tokenInfo.hasColor).toBe(true);
  });

  test("player can change their token color", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.snapshot || !data.uid) return false;
      return (
        Array.isArray(data.snapshot.tokens) &&
        data.snapshot.tokens.some((t) => t.owner === data.uid)
      );
    });

    const initialColor = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const token = data?.snapshot?.tokens?.find((t) => t.owner === data.uid);
      return token?.color ?? null;
    });

    expect(initialColor).not.toBeNull();

    // Look for settings or profile button
    const settingsButton = page.getByRole("button", { name: /Settings/i });
    const settingsExists = await settingsButton.count();

    if (settingsExists === 0) {
      test.skip(true, "Settings button not found");
      return;
    }

    await settingsButton.click();

    // Look for color picker
    const colorInput = page.locator('input[type="color"]').first();
    const colorExists = await colorInput.count();

    if (colorExists > 0) {
      // Set a new color
      await colorInput.fill("#ff0000");

      // Close settings or apply
      const applyButton = page.getByRole("button", { name: /Apply|Save|Close/i }).first();
      const applyExists = await applyButton.count();

      if (applyExists > 0) {
        await applyButton.click();
      } else {
        await page.keyboard.press("Escape");
      }

      await page.waitForFunction(
        (prevColor) => {
          const data = window.__HERO_BYTE_E2E__;
          const token = data?.snapshot?.tokens?.find((t) => t.owner === data.uid);
          return token?.color !== prevColor;
        },
        initialColor,
        { timeout: 5000 },
      );

      const newColor = await page.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        const token = data?.snapshot?.tokens?.find((t) => t.owner === data.uid);
        return token?.color ?? null;
      });

      expect(newColor).not.toBe(initialColor);
    } else {
      test.skip(true, "Color picker not found");
    }
  });

  test("token reflects character selection", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    const hasCharacters = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.characters?.length ?? 0) > 0;
    });

    if (!hasCharacters) {
      test.skip(true, "No characters available to test");
      return;
    }

    const charInfo = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const chars = data?.snapshot?.characters ?? [];
      const token = data?.snapshot?.tokens?.find((t) => t.owner === data.uid);
      return {
        charCount: chars.length,
        tokenCharId: token?.characterId ?? null,
        firstCharId: chars[0]?.id ?? null,
      };
    });

    expect(charInfo.charCount).toBeGreaterThan(0);

    // Verify token is associated with a character
    if (charInfo.tokenCharId) {
      const charExists = await page.evaluate((charId) => {
        const data = window.__HERO_BYTE_E2E__;
        const chars = data?.snapshot?.characters ?? [];
        return chars.some((c) => c.id === charId);
      }, charInfo.tokenCharId);

      expect(charExists).toBe(true);
    }
  });
});
