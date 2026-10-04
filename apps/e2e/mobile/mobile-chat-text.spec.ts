// U10b — the phone's chat: readable text, a composer that does not make iOS Safari
// zoom the page, and a composer row that still fits on one line at 320 px.
// iOS Safari zooms the whole page when a focused field's text is under 16 px, which
// on a map app moves the view every time someone starts typing. The 16 px is a
// standard browser behaviour; it has NOT been seen on a real phone here (this is a
// Chromium emulation), so the measure is of the computed size, not of the zoom.

import { expect, test } from "../fixtures";
import { composer, openChat, renderedMessage, sendButton } from "../chat-journey.helpers";
import { createTable, dismissNextSteps } from "../table-role.helpers";
import { joinMobileTable } from "./mobile.helpers";

for (const width of [375, 320]) {
  test(`the composer is 16 px, 44 px tall and shares a row with SEND at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await joinMobileTable(page);
    await openChat(page, true);

    const text = "A sentence worth reading on a phone";
    await composer(page).fill(text);
    await sendButton(page).tap();
    await expect(renderedMessage(page, text)).toBeVisible();

    const message = await renderedMessage(page, text).evaluate((node) => {
      const style = getComputedStyle(node);
      return { fontSize: style.fontSize, fontFamily: style.fontFamily };
    });
    expect(message.fontSize).toBe("13px");
    expect(message.fontFamily).not.toMatch(/Press Start/i);

    const input = await composer(page).evaluate((node) => getComputedStyle(node).fontSize);
    expect(input).toBe("16px");

    const [inputBox, sendBox] = await Promise.all([
      composer(page).boundingBox(),
      sendButton(page).boundingBox(),
    ]);
    expect(inputBox).not.toBeNull();
    expect(sendBox).not.toBeNull();
    expect(inputBox!.height).toBeGreaterThanOrEqual(44);
    expect(sendBox!.height).toBeGreaterThanOrEqual(44);
    // One row: SEND begins where the composer ends, and neither leaves the screen.
    expect(sendBox!.x).toBeGreaterThanOrEqual(inputBox!.x + inputBox!.width - 1);
    expect(sendBox!.y).toBeLessThan(inputBox!.y + inputBox!.height);
    expect(sendBox!.x + sendBox!.width).toBeLessThanOrEqual(width);
    expect(inputBox!.width).toBeGreaterThan(120);

    const send = await sendButton(page).evaluate((node) => getComputedStyle(node).fontSize);
    expect(send).toBe("11px");
  });
}

// A tablet: a coarse pointer wider than 1024 px takes the DESKTOP layout, so the chat sits
// outside any [data-mobile-surface]: the composer is 16 px from its own rule and 44 px tall
// because it shares a row with SEND, which carries the floor. Chromium emulation, not an iPad.
test("the composer is 44 px tall and 16 px on a tablet's desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await createTable(page, "u10b-tablet-chat");
  await dismissNextSteps(page);
  await expect(page.locator("[data-mobile-surface]")).toHaveCount(0);
  await openChat(page);

  const box = await composer(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await composer(page).evaluate((node) => getComputedStyle(node).fontSize)).toBe("16px");
});
