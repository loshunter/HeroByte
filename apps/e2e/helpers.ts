import { expect, type Page } from "@playwright/test";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

export async function joinDefaultRoom(page: Page) {
  await page.goto("/");

  await page.getByPlaceholder("Room password").fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Room/i }).click();

  await expect(page.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 15_000 });
}
