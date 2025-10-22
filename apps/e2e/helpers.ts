import { expect, type Page } from "@playwright/test";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";
const DM_PASSWORD = process.env.E2E_DM_PASSWORD ?? "FunDM";

export async function joinDefaultRoom(page: Page) {
  await page.goto("/");

  await page.getByPlaceholder("Room password").fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Room/i }).click();

  await expect(page.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 15_000 });
}

export async function joinDefaultRoomAsDM(page: Page) {
  await page.goto("/");

  await page.getByPlaceholder("Room password").fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Room/i }).click();

  await expect(page.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 15_000 });

  // Wait for the UI to be ready
  await page.waitForFunction(() => {
    const data = window.__HERO_BYTE_E2E__;
    return Boolean(data?.snapshot && data.uid);
  });

  // Elevate to DM using the DM password
  await page.evaluate((dmPassword) => {
    const data = window.__HERO_BYTE_E2E__;
    if (data?.sendMessage) {
      data.sendMessage({
        t: "elevate-to-dm",
        dmPassword: dmPassword,
      });
    }
  }, DM_PASSWORD);

  // Wait a moment for the message to be processed
  await page.waitForTimeout(500);

  // Wait for DM elevation to complete by checking the snapshot
  await page.waitForFunction(
    () => {
      const data = window.__HERO_BYTE_E2E__;
      const currentPlayer = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return currentPlayer?.isDM === true;
    },
    { timeout: 10000 },
  );
}
