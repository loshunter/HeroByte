import { expect, type Page } from "@playwright/test";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";
const DM_PASSWORD = process.env.E2E_DM_PASSWORD ?? "FunDM";

export async function joinDefaultRoom(page: Page) {
  await page.goto("/");

  const snapButton = page.getByRole("button", { name: "Snap" });
  if (await snapButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }

  const passwordInput = page.getByPlaceholder("Room password");
  await expect(passwordInput).toBeEnabled({ timeout: 15_000 });
  await passwordInput.fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Room/i }).click();

  await expect(snapButton).toBeVisible({ timeout: 15_000 });
}

export async function joinDefaultRoomAsDM(page: Page) {
  await joinDefaultRoom(page);
  await elevateToDM(page);
}

export async function elevateToDM(page: Page) {
  await page.waitForFunction(() => {
    const data = window.__HERO_BYTE_E2E__;
    return Boolean(data?.snapshot && data.uid);
  });

  await page.evaluate((dmPassword) => {
    const data = window.__HERO_BYTE_E2E__;
    if (data?.sendMessage) {
      data.sendMessage({
        t: "elevate-to-dm",
        dmPassword,
      });
    }
  }, DM_PASSWORD);

  await page.waitForFunction(
    () => {
      const data = window.__HERO_BYTE_E2E__;
      const currentPlayer = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return currentPlayer?.isDM === true;
    },
    { timeout: 10000 },
  );
}
