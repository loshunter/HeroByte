import { expect, test } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";
import { openChat } from "./chat-journey.helpers";

// At 1024 px Chat & Rolls (docked at innerWidth - 420) covered the selection bar's
// 🔓 Unlock, the button the locked toast names. Raising the bar over the windows was
// reverted (3fd6c945: it covered their ✕), so the bar steps aside instead.
test.describe("the DM's selection bar beside Chat & Rolls", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("🔓 Unlock takes the click with Chat & Rolls open at 1024 px", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const tokenId = await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.tokens?.find((token) => token.owner === data.uid)?.id ?? false;
    });
    const sceneId = `token:${await tokenId.jsonValue()}`;
    await page.evaluate((id) => {
      const data = window.__HERO_BYTE_E2E__;
      data?.sendMessage?.({
        t: "select-multiple",
        uid: data.uid,
        objectIds: [id],
        mode: "replace",
      });
    }, sceneId);

    const bar = page.getByTestId("selection-bar");
    await expect(bar).toBeVisible();
    await openChat(page);
    // On a computer Chat & Rolls is a floating window (DraggableWindow), not a dialog.
    const chat = page
      .locator("[data-floating-window]")
      .filter({ has: page.getByRole("tab", { name: "CHAT", exact: true }) });
    await expect(chat).toBeVisible();

    const unlock = bar.getByRole("button", { name: "🔓 Unlock" });
    // A trial click fails if any other element would receive it: nothing covers Unlock.
    await expect(async () => {
      await unlock.click({ trial: true, timeout: 1000 });
    }).toPass({ timeout: 5000 });
    const [barBox, chatBox] = [await bar.boundingBox(), await chat.boundingBox()];
    expect(barBox && chatBox && barBox.x + barBox.width <= chatBox.x).toBe(true);
    // Still under the windows: a bar above them covered their ✕ (3fd6c945).
    expect(await bar.evaluate((node) => getComputedStyle(node).zIndex)).toBe("1000");
  });
});

// At 922 px the centred bar was laid out in half the viewport and wrapped; moved aside it
// unwrapped and grew, and flipped between placements every frame ("element is not stable").
test.describe("the DM's selection bar beside Chat & Rolls, narrow (922 px)", () => {
  test.use({ viewport: { width: 922, height: 549 } });

  test("🔓 Unlock holds still and takes the click at 922 px, where the centred bar used to wrap", async ({
    page,
  }) => {
    await joinDefaultRoomAsDM(page);
    const tokenId = await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.tokens?.find((token) => token.owner === data.uid)?.id ?? false;
    });
    const sceneId = `token:${await tokenId.jsonValue()}`;
    await page.evaluate((id) => {
      const data = window.__HERO_BYTE_E2E__;
      data?.sendMessage?.({
        t: "select-multiple",
        uid: data.uid,
        objectIds: [id],
        mode: "replace",
      });
    }, sceneId);

    const bar = page.getByTestId("selection-bar");
    await expect(bar).toBeVisible();
    await openChat(page);
    // On a computer Chat & Rolls is a floating window (DraggableWindow), not a dialog.
    const chat = page
      .locator("[data-floating-window]")
      .filter({ has: page.getByRole("tab", { name: "CHAT", exact: true }) });
    await expect(chat).toBeVisible();

    const unlock = bar.getByRole("button", { name: "🔓 Unlock" });
    // A trial click fails if any other element would receive it: nothing covers Unlock.
    await expect(async () => {
      await unlock.click({ trial: true, timeout: 1000 });
    }).toPass({ timeout: 5000 });
    const [barBox, chatBox] = [await bar.boundingBox(), await chat.boundingBox()];
    expect(barBox && chatBox && barBox.x + barBox.width <= chatBox.x).toBe(true);
    // Still under the windows: a bar above them covered their ✕ (3fd6c945).
    expect(await bar.evaluate((node) => getComputedStyle(node).zIndex)).toBe("1000");
  });
});
