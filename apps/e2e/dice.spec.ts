import { test, expect } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte dice", () => {
  test("player can roll a die and see it logged", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.getByRole("button", { name: /Dice/i }).click();
    await expect(page.getByText("⚂ DICE ROLLER")).toBeVisible();

    await page.getByRole("button", { name: "Add d20" }).click();
    await page.getByRole("button", { name: "Roll dice" }).click();

    const rollTotal = page.getByTestId("roll-result-total");
    await expect(rollTotal).toBeVisible({ timeout: 10_000 });
    const totalValue = (await rollTotal.textContent())?.trim();
    expect(totalValue).toMatch(/^[0-9]+$/);

    await page.getByRole("button", { name: /Log/i }).click();
    await expect(page.getByText("⚂ ROLL LOG")).toBeVisible();

    const logEntry = page.getByTestId("roll-log-entry").first();
    await expect(logEntry).toBeVisible({ timeout: 10_000 });
    await expect(logEntry).toContainText("=");
    const logText = (await logEntry.textContent()) ?? "";
    expect(logText).toMatch(/=\s*\d+/);
  });
});
