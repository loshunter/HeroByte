import { test, expect } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte dice", () => {
  test("player can roll a die and see it logged", async ({ page }) => {
    await joinDefaultRoom(page);

    const initialRollCount =
      (await page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.diceRolls?.length ?? 0)) ?? 0;

    const diceToggle = page.getByRole("button", { name: "⚂ Dice" });
    await expect(diceToggle).toBeVisible();
    await diceToggle.click();
    await expect(page.getByText("⚂ DICE ROLLER")).toBeVisible();

    await page.getByRole("button", { name: "Add d20" }).click();
    await page.getByRole("button", { name: "Roll dice" }).click();

    const rollTotal = page.getByTestId("roll-result-total");
    await expect(rollTotal).toBeVisible({ timeout: 10_000 });
    const totalValue = (await rollTotal.textContent())?.trim();
    expect(totalValue).toMatch(/^[0-9]+$/);

    await page.waitForFunction(
      (previousCount) => {
        const data = window.__HERO_BYTE_E2E__;
        const rolls = data?.snapshot?.diceRolls;
        return Array.isArray(rolls) && rolls.length > previousCount;
      },
      initialRollCount,
      { timeout: 10_000 },
    );

    const diceHeader = page.getByText("⚂ DICE ROLLER").first();
    const headerBox = await diceHeader.boundingBox();
    if (headerBox) {
      const startDragX = headerBox.x + headerBox.width / 2;
      const startDragY = headerBox.y + headerBox.height / 2;
      await page.mouse.move(startDragX, startDragY);
      await page.mouse.down();
      await page.mouse.move(startDragX, startDragY + 260, { steps: 10 });
      await page.mouse.up();
    }

    const logToggle = page.getByRole("button", { name: "📜 Log" });
    await expect(logToggle).toBeVisible();
    await logToggle.click();
    await expect(page.getByText("⚂ ROLL LOG")).toBeVisible();

    const logEntry = page.getByTestId("roll-log-entry").first();
    await expect(logEntry).toBeVisible({ timeout: 10_000 });
    await expect(logEntry).toContainText("=");
    const logText = (await logEntry.textContent()) ?? "";
    expect(logText).toMatch(/=\s*\d+/);
  });
});
