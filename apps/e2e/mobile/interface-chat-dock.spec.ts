import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

for (const viewport of [
  { width: 375, height: 812 },
  { width: 812, height: 375 },
]) {
  test(`Freehand stays readable inside its touch target at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await joinMobileTable(page);
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: "Tools", exact: true })
      .tap();
    await page.getByRole("button", { name: "Draw", exact: true }).tap();
    const freehand = page.getByRole("button", { name: "Freehand", exact: true });
    await expect(freehand).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const fit = await freehand.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const range = document.createRange();
      range.selectNodeContents(button);
      const label = range.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        labelLeft: label.left,
        labelRight: label.right,
        contentLeft: rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        contentRight:
          rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        lines: range.getClientRects().length,
      };
    });
    expect(fit.width).toBeGreaterThanOrEqual(44);
    expect(fit.height).toBeGreaterThanOrEqual(44);
    expect(fit.lines).toBe(1);
    expect(fit.labelLeft).toBeGreaterThanOrEqual(fit.contentLeft - 0.5);
    expect(fit.labelRight).toBeLessThanOrEqual(fit.contentRight + 0.5);
  });
}

test("the 375px Chat dock fits and opens chat before remembering the Rolls tab", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await joinMobileTable(page);

  const dock = page.getByRole("navigation", { name: /Mobile actions/i });
  await expect(dock.getByRole("button")).toHaveCount(5);
  const chat = dock.getByRole("button", { name: "Chat", exact: true });
  await expect(chat).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const geometry = await chat.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const textNode = [...button.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === "Chat",
    );
    if (!textNode) return null;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const label = range.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      labelLeft: label.left,
      labelRight: label.right,
      labelTop: label.top,
      labelBottom: label.bottom,
      top: rect.top,
      bottom: rect.bottom,
      lines: range.getClientRects().length,
      clipped:
        button.scrollWidth > button.clientWidth + 1 ||
        button.scrollHeight > button.clientHeight + 1,
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.width).toBeGreaterThanOrEqual(44);
  expect(geometry!.height).toBeGreaterThanOrEqual(44);
  expect(geometry!.left).toBeGreaterThanOrEqual(0);
  expect(geometry!.right).toBeLessThanOrEqual(375);
  expect(geometry!.labelLeft).toBeGreaterThanOrEqual(geometry!.left);
  expect(geometry!.labelRight).toBeLessThanOrEqual(geometry!.right);
  expect(geometry!.labelTop).toBeGreaterThanOrEqual(geometry!.top);
  expect(geometry!.labelBottom).toBeLessThanOrEqual(geometry!.bottom);
  expect(geometry!.lines).toBe(1);
  expect(geometry!.clipped).toBe(false);
  await testInfo.attach("375px-five-slot-chat-dock", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  // Locator.tap uses trusted touchStart/touchEnd in the mobile project.
  await chat.tap();
  const screen = page.getByRole("dialog", { name: "Chat & Rolls", exact: true });
  await expect(screen).toBeVisible();
  await expect(screen).toHaveCount(1);
  const tabs = screen.getByRole("tablist", { name: "Chat & Rolls", exact: true });
  await expect(tabs).toHaveAttribute("aria-orientation", "horizontal");
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  const expectPanel = async (name: "CHAT" | "ROLLS") => {
    const selected = tabs.getByRole("tab", { name, exact: true, selected: true });
    await expect(selected).toHaveAttribute("tabindex", "0");
    await expect(tabs.getByRole("tab", { selected: false })).toHaveAttribute("tabindex", "-1");
    const panel = screen.getByRole("tabpanel", { name, exact: true });
    await expect(panel).toBeVisible();
    await expect(screen.getByRole("tabpanel")).toHaveCount(1);
    const tabId = await selected.getAttribute("id");
    const panelId = await panel.getAttribute("id");
    expect(tabId).toBeTruthy();
    expect(panelId).toBeTruthy();
    await expect(selected).toHaveAttribute("aria-controls", panelId!);
    await expect(panel).toHaveAttribute("aria-labelledby", tabId!);
  };
  for (const name of ["CHAT", "ROLLS"]) {
    const tab = tabs.getByRole("tab", { name, exact: true });
    await expect(tab).toBeVisible();
    const rect = await tab.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.width, `${name} tab width`).toBeGreaterThanOrEqual(44);
    expect(rect!.height, `${name} tab height`).toBeGreaterThanOrEqual(44);
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(375);
  }
  await expectPanel("CHAT");
  await expect(screen.getByLabel("Chat message", { exact: true })).toBeVisible();
  const close = screen.getByRole("button", { name: "Close Chat & Rolls" });
  const closeBox = await close.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  // A visible title can still be painted over by the connection badge: it
  // ignores pointer events, so hit-testing the heading misses that overlap.
  const title = screen.getByRole("heading", { name: "Chat & Rolls", exact: true });
  const titleBox = await title.boundingBox();
  const connection = page.getByText("ONLINE", { exact: true }).locator("..");
  await expect(connection).toBeVisible();
  const connectionBox = await connection.boundingBox();
  expect(titleBox).not.toBeNull();
  expect(connectionBox).not.toBeNull();
  expect(connectionBox!.y + connectionBox!.height).toBeLessThanOrEqual(titleBox!.y);
  expect(connectionBox!.y + connectionBox!.height).toBeLessThanOrEqual(closeBox!.y);
  expect(await title.evaluate((heading) => heading.scrollWidth <= heading.clientWidth)).toBe(true);
  await testInfo.attach("375px-chat-first-entry", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await screen.getByRole("tab", { name: "ROLLS", exact: true }).tap();
  await expectPanel("ROLLS");
  await expect(screen.getByLabel("Chat message", { exact: true })).toHaveCount(0);
  await expect(screen.getByText("No rolls yet...", { exact: true })).toBeVisible();
  await close.tap();
  await expect(screen).toHaveCount(0);
  await chat.tap();
  await expect(screen).toHaveCount(1);
  await expectPanel("ROLLS");
  await expect(screen.getByText("No rolls yet...", { exact: true })).toBeVisible();
  await expect(screen.getByLabel("Chat message", { exact: true })).toHaveCount(0);
  await screen.getByRole("tab", { name: "CHAT", exact: true }).tap();
  await expectPanel("CHAT");
  await expect(screen.getByLabel("Chat message", { exact: true })).toBeVisible();
  await close.tap();
  await expect(dock.getByRole("button")).toHaveCount(5);
});
