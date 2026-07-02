import { test, expect } from "./fixtures";

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

    const toolsButton = page.getByRole("button", { name: /Tools/i });
    await expect(toolsButton).toBeVisible({ timeout: 15_000 });

    // Check that the map board is present
    const mapBoard = page.locator('[data-testid="map-board"]');
    await expect(mapBoard).toBeVisible();

    // Check for mobile-specific dock buttons
    await expect(page.getByRole("button", { name: /Party/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Dice/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Log/i })).toBeVisible();

    // Open the tool sheet
    await toolsButton.click();

    await expect(page.getByRole("button", { name: /Ping/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Measure/i })).toBeVisible();

    await page.getByRole("button", { name: /Close tools/i }).click();
    await expect(page.getByRole("button", { name: /Ping/i })).not.toBeVisible();
  });

  test("should toggle dice roller in mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?mobile=true");

    await page.getByPlaceholder("Room password").fill(ROOM_PASSWORD);
    await page.getByRole("button", { name: /Enter Room/i }).click();

    const diceButton = page.getByRole("button", { name: /Dice/i });
    await expect(diceButton).toBeVisible({ timeout: 15_000 });
    await diceButton.click();

    // Check if Dice Roller component is visible
    // The actual component has title "⚂ DICE ROLLER" and a roll button
    await expect(page.getByText(/DICE ROLLER/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /ROLL!/i })).toBeVisible();
  });
});
