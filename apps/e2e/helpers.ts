import { expect, type Page } from "@playwright/test";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";
const DM_PASSWORD = process.env.E2E_DM_PASSWORD ?? "FunDM";

/** What the page actually was when the login form never arrived. */
async function describeStuckPage(page: Page): Promise<string> {
  const state = await page
    .evaluate(() => {
      const root = document.getElementById("root");
      return {
        url: location.href,
        readyState: document.readyState,
        mounted: (root?.childElementCount ?? 0) > 0,
        scripts: [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")),
        text: (document.body.innerText ?? "").trim().slice(0, 300),
      };
    })
    .catch((error: unknown) => ({ evaluateFailed: String(error) }));
  return `joinDefaultRoom: the login form never appeared. Page state: ${JSON.stringify(state)}`;
}

export async function joinDefaultRoom(page: Page) {
  await page.goto("/");

  const snapButton = page.getByRole("button", { name: "Snap" });
  if (await snapButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }

  const passwordInput = page.getByPlaceholder("Table password");
  try {
    await expect(passwordInput).toBeEnabled({ timeout: 15_000 });
  } catch (cause) {
    // This timeout is the suite's one recurring flake (4 sightings: 2026-08-18
    // and three on 2026-08-29, each in a DIFFERENT spec, each passing alone —
    // 25/25 on a repeat-each of the last one). "element(s) not found" says
    // nothing about WHY, so every sighting has been diagnosed by guesswork
    // from an old note. It now reports its own state, so the next one is
    // evidence instead: an EMPTY mount means the bundle never executed, a
    // filled one means the app rendered something other than the login form.
    throw new Error(`${await describeStuckPage(page)}\n\n${String(cause)}`);
  }
  await passwordInput.fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Table/i }).click();

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
