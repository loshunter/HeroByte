import { test, expect } from "@playwright/test";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

test.describe("HeroByte smoke", () => {
  test("user can join default room", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Join Your Room/i })).toBeVisible();

    await page.getByPlaceholder("Room password").fill(ROOM_PASSWORD);
    await page.getByRole("button", { name: /Enter Room/i }).click();

    await expect(page.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 15_000 });
  });
});
