/**
 * Keyboard movement — the desktop path, driven by REAL key presses.
 *
 * A bare movement key moves the selected token one whole cell over the
 * relative `step-object` message (the server applies it on the ordinary
 * transform road); a typing surface keeps its keystrokes (invariant 4.17); a
 * selection the player may not move sends nothing.
 */
import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

type Cell = { x: number; y: number };

async function ownToken(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => {
    const data = window.__HERO_BYTE_E2E__;
    return Boolean(data?.snapshot?.tokens?.some((t) => t.owner === data.uid));
  });
  return page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__!;
    const token = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
    return { id: token.id, x: token.x, y: token.y };
  });
}

const readCell = (page: import("@playwright/test").Page, id: string): Promise<Cell> =>
  page.evaluate((tokenId) => {
    const token = window.__HERO_BYTE_E2E__!.snapshot!.tokens.find((t) => t.id === tokenId)!;
    return { x: token.x, y: token.y };
  }, id);

// JRPGButton's accessible name is its TEXT ("🖱️ Select"); the title is a
// description. Locate by title, the comprehensive-mvp precedent.
const selectTool = (page: import("@playwright/test").Page) =>
  page.locator('button[title="Select multiple objects"]');

async function selectObject(page: import("@playwright/test").Page, objectId: string) {
  await page.evaluate((id) => {
    const data = window.__HERO_BYTE_E2E__!;
    data.sendMessage!({ t: "select-object", uid: data.uid!, objectId: id });
  }, objectId);
  await page.waitForFunction((id) => {
    const data = window.__HERO_BYTE_E2E__;
    const entry = data?.snapshot?.selectionState?.[data.uid!];
    return entry?.mode === "single" && entry.objectId === id;
  }, objectId);
}

test.describe("keyboard movement", () => {
  test("ArrowRight and w step the selected token one whole cell each", async ({ page }) => {
    await joinDefaultRoom(page);
    // Selection only lives in Select/Transform mode (it auto-clears elsewhere).
    await selectTool(page).click();
    const token = await ownToken(page);
    await selectObject(page, `token:${token.id}`);

    // The step starts from the NEAREST cell, so a token spawned at a
    // fractional cell (the staging zone does that) lands on whole cells.
    const origin = { x: Math.round(token.x), y: Math.round(token.y) };

    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => readCell(page, token.id), { timeout: 5_000 })
      .toEqual({ x: origin.x + 1, y: origin.y });

    await page.keyboard.press("w");
    await expect
      .poll(() => readCell(page, token.id), { timeout: 5_000 })
      .toEqual({ x: origin.x + 1, y: origin.y - 1 });
  });

  test("a movement key typed into the chat box stays in the chat box", async ({ page }) => {
    await joinDefaultRoom(page);
    await selectTool(page).click();
    const token = await ownToken(page);
    await selectObject(page, `token:${token.id}`);
    const before = await readCell(page, token.id);

    await page.locator('button[title="View dice roll history"]').click();
    await page.getByRole("button", { name: "CHAT" }).click();
    const chat = page.getByPlaceholder("Say something...");
    await chat.focus();
    await page.keyboard.press("d");
    await page.keyboard.press("w");
    // Last: in a single-line input ArrowUp moves the caret to the start.
    await page.keyboard.press("ArrowUp");

    await expect(chat).toHaveValue("dw");
    // Give a wrongly-sent move time to land before asserting it did not.
    await page.waitForTimeout(500);
    expect(await readCell(page, token.id)).toEqual(before);
  });

  test("a player cannot key-move someone else's token", async ({ page, browser }) => {
    // A second player in its own context guarantees a token that is not ours.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await joinDefaultRoom(otherPage);
      const other = await ownToken(otherPage);

      await joinDefaultRoom(page);
      await selectTool(page).click();
      await page.waitForFunction(
        (id) => window.__HERO_BYTE_E2E__?.snapshot?.tokens?.some((t) => t.id === id),
        other.id,
      );
      await selectObject(page, `token:${other.id}`);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
      expect(await readCell(page, other.id)).toEqual({ x: other.x, y: other.y });
    } finally {
      await otherContext.close();
    }
  });
});
