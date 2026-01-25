import { test, expect } from "@playwright/test";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

test.describe("Mobile Layout", () => {
  test("should render mobile layout with forced mobile parameter", async ({ page }) => {
    // Set viewport to a mobile size
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12/13 size

    // Go to home page with mobile flag
    await page.goto("/?mobile=true");

    // Enter room password
    await page.getByPlaceholder("Room password").fill(ROOM_PASSWORD);
    await page.getByRole("button", { name: /Enter Room/i }).click();

    // Wait for the map board to be visible (it's lazy loaded)
    // In mobile layout, we don't have the "Snap" button that joinDefaultRoom waits for.
    // We should wait for the mobile menu toggle.
    const menuToggle = page.locator('button:has-text("☰")');
    await expect(menuToggle).toBeVisible({ timeout: 15_000 });

    // Check that the map board is present
    const mapBoard = page.locator('[data-testid="map-board"]');
    await expect(mapBoard).toBeVisible();

    // Open the menu
    await menuToggle.click();

    // Check for mobile-specific buttons
    const diceButton = page.locator('button:has-text("🎲 Dice")');
    const logButton = page.locator('button:has-text("📜 Log")');
    await expect(diceButton).toBeVisible();
    await expect(logButton).toBeVisible();

    // Close the menu
    await page.locator('button:has-text("✕")').click();
    await expect(diceButton).not.toBeVisible();
  });

  test("should toggle dice roller in mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?mobile=true");

    await page.getByPlaceholder("Room password").fill(ROOM_PASSWORD);
    await page.getByRole("button", { name: /Enter Room/i }).click();

    // Wait for UI
    const menuToggle = page.locator('button:has-text("☰")');
    await expect(menuToggle).toBeVisible({ timeout: 15_000 });

    // Open menu
    await menuToggle.click();

    // Open dice roller
    await page.locator('button:has-text("🎲 Dice")').click();

    // Check if Dice Roller component is visible
    // The actual component has title "⚂ DICE ROLLER" and a roll button
    await expect(page.getByText(/DICE ROLLER/i)).toBeVisible();
    await expect(page.getByLabel("Roll dice")).toBeVisible();
  });
});
