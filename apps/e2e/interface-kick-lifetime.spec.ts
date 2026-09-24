import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";
import { readState } from "./chat-journey.helpers";
import { createAndJoin, mapContent, observeWire, publicBarrier } from "./u2-cancel.helpers";

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const panel = (page: Page) => page.getByTestId("kick-panel");
const draft = {
  Name: "Crossing Ω local draft",
  Theme: "wood",
  Density: "high",
  Size: "large",
  Seed: "4242",
  "Door type": "stair",
};

async function fillDraft(page: Page) {
  for (const [name, value] of Object.entries(draft)) {
    const field = panel(page).getByLabel(name, { exact: true });
    if (name === "Name" || name === "Seed") await field.fill(value);
    else await field.selectOption(value);
  }
}

async function expectDraft(page: Page, mobile: boolean) {
  await expect(panel(page)).toHaveCount(1);
  await expect(panel(page)).toBeVisible();
  for (const [name, value] of Object.entries(draft)) {
    await expect(panel(page).getByLabel(name, { exact: true })).toHaveValue(value);
  }
  if (mobile) {
    await expect(page.locator("[data-mobile-surface]")).toHaveCount(1);
    await expect(page.locator('[data-mobile-surface="kick"]')).toBeVisible();
  }
  await expect(panel(page).getByLabel("Name", { exact: true })).toBeFocused();
  expect(
    await panel(page)
      .getByLabel("Name", { exact: true })
      .evaluate((input) => {
        const box = input.getBoundingClientRect();
        return input.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
    "focus must be in the visible form after the layout swap",
  ).toBe(true);
}

async function phoneOpen(page: Page) {
  await page
    .getByRole("navigation", { name: "Mobile actions" })
    .getByRole("button", { name: "DM", exact: true })
    .tap();
  await page.getByRole("button", { name: "🚪 Kick in a door", exact: true }).tap();
  await expect(panel(page)).toBeVisible();
}

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 80; step += 1) {
    if (await target.evaluate((node) => document.activeElement === node)) break;
    await page.keyboard.press("Shift+Tab");
  }
  await expect(target).toBeFocused();
}

async function content(page: Page) {
  const { snapshot } = await readState(page);
  return {
    map: await mapContent(page),
    atlasNodes: snapshot.atlasNodes,
    atlasLinks: snapshot.atlasLinks,
    currentAtlasNodeId: snapshot.currentAtlasNodeId,
  };
}

test("U2 Kick keeps its draft across phone/desktop and G respects foreground windows", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180_000);
  const dmContext = await browser.newContext({
    baseURL,
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });
  const peerContext = await browser.newContext({ baseURL, viewport: DESKTOP });
  const dm = await dmContext.newPage();
  const peer = await peerContext.newPage();
  const dmWire = observeWire(dm);
  const peerWire = observeWire(peer);
  const pages = [dm, peer];
  try {
    await createAndJoin(dm, peer, true, "U2 Kick layout and keyboard");
    const before = await Promise.all(pages.map(content));
    const mutations = () =>
      [...dmWire.sent, ...peerWire.sent].filter(
        ({ t }) =>
          t.startsWith("atlas-") ||
          t.includes("drawing") ||
          (t.startsWith("map-studio-") && t !== "map-studio-list" && t !== "map-studio-get"),
      );
    const sent = mutations().length;

    for (const mobile of [true, false]) {
      await dm.setViewportSize(mobile ? PHONE : DESKTOP);
      if (mobile) await phoneOpen(dm);
      else {
        await dm.keyboard.press("g");
        await expect(panel(dm)).toBeVisible();
      }
      await fillDraft(dm);
      await dm.setViewportSize(mobile ? DESKTOP : PHONE);
      await expectDraft(dm, !mobile);
      await info.attach(`draft-from-${mobile ? "phone" : "desktop"}.png`, {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await dm.setViewportSize(mobile ? PHONE : DESKTOP);
      await expectDraft(dm, mobile);
      await panel(dm).getByRole("button", { name: "CANCEL", exact: true }).click();
      await expect(panel(dm)).toHaveCount(0);
      await dm.setViewportSize(mobile ? DESKTOP : PHONE);
      await expect(panel(dm)).toHaveCount(0);
    }

    // A hardware key on phone must open the actual phone surface, not merely
    // set a hidden desktop flag that appears at a later breakpoint.
    await dm.setViewportSize(PHONE);
    await dm.keyboard.press("g");
    await expect(dm.locator('[data-mobile-surface="kick"]')).toBeVisible();
    await expect(panel(dm).getByLabel("Name", { exact: true })).toBeFocused();
    await panel(dm).getByRole("button", { name: "CANCEL", exact: true }).tap();
    await expect(panel(dm)).toHaveCount(0);
    await dm.setViewportSize(DESKTOP);
    await expect(panel(dm)).toHaveCount(0);

    // Reach a non-editable Character button with real keyboard traversal.
    // Focusing Name instead would let the old editable-target guard hide the bug.
    await dm
      .locator(".player-card")
      .filter({ has: dm.getByText("You", { exact: true }) })
      .getByTitle("Open player settings")
      .click();
    const character = dm.locator('[data-mobile-surface="settings"]');
    const closeCharacter = character.getByRole("button", { name: /^Close / });
    await expect(closeCharacter).toBeVisible();
    await tabTo(dm, closeCharacter);
    await dm.keyboard.press("g");
    await expect(panel(dm)).toHaveCount(0);
    await expect(closeCharacter).toBeFocused();
    await expect(character).toBeVisible();
    await info.attach("character-keeps-focus-after-G.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
    await dm.keyboard.press("Escape");
    await expect(character).toHaveCount(0);

    await dm.getByRole("button", { name: "Help", exact: true }).click();
    const help = dm.getByRole("dialog", { name: "HeroByte help", exact: true });
    const topic = help.getByRole("button").first();
    await topic.click();
    await expect(topic).toBeFocused();
    await dm.keyboard.press("g");
    await expect(panel(dm)).toHaveCount(0);
    await expect(topic).toBeFocused();
    await expect(help).toBeVisible();
    await info.attach("help-keeps-focus-after-G.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
    await dm.keyboard.press("Escape");
    await expect(help).toHaveCount(0);

    // Positive shortcut control after the foreground owner is gone.
    await dm.keyboard.press("g");
    await expect(panel(dm)).toBeVisible();
    await expect(panel(dm).getByLabel("Name", { exact: true })).toBeFocused();
    await dm.keyboard.press("Escape");
    await expect(panel(dm)).toHaveCount(0);
    await publicBarrier(peer, pages, "Kick-layout-and-foreground");
    expect(mutations()).toHaveLength(sent);
    expect(await Promise.all(pages.map(content))).toEqual(before);
    await expect(peer.getByTestId("kick-panel")).toHaveCount(0);
  } finally {
    await dmContext.close();
    await peerContext.close();
  }
});
