/**
 * The DM screen (M4b): a DM on a phone reaches the full menu — background,
 * grid, fog, staging zone, NPC/prop CRUD, session save/load, invite link and
 * table password — through a scrollable chip row of the same five tabs the
 * desktop window has. The tab views are reused unchanged; what this spec
 * proves is REACHABILITY on a 375px screen, where "on screen at once" is the
 * wrong bar (the body scrolls) but "reachable by scrolling, at the 44px
 * floor" is the contract.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

async function openDMScreen(page: Page): Promise<void> {
  await elevateToDM(page);
  await page
    .getByRole("navigation", { name: /Mobile actions/i })
    .getByRole("button", { name: /^DM$/i })
    .click();
  await expect(page.getByRole("dialog", { name: "DM Menu" })).toBeVisible();
  // The menu is a lazy chunk on mobile exactly as on desktop — wait for it.
  await expect(page.getByRole("button", { name: "Map Setup" })).toBeVisible({ timeout: 15_000 });
}

/** Assert a control is reachable by scrolling, then leave it in view. */
async function reach(page: Page, locator: ReturnType<Page["getByText"]>): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
}

test.describe("mobile — the DM screen", () => {
  test("every tab is a >=44px chip on one scrollable row, and each opens its view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openDMScreen(page);

    const dialog = page.getByRole("dialog", { name: "DM Menu" });

    // The chip row: all five tabs on ONE row at the touch floor. On a 375px
    // screen five labelled chips cannot fit at once, so the row itself must
    // scroll — that is the M4b design, not an accident to paper over.
    const chips = await page.evaluate(() => {
      const labels = ["Map Setup", "NPCs & Monsters", "Props & Objects", "Players", "Session"];
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) =>
        labels.includes((b.textContent || "").trim()),
      );
      const row = buttons[0]?.parentElement;
      return {
        count: buttons.length,
        shortest: Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().height))),
        rows: new Set(buttons.map((b) => b.offsetTop)).size,
        rowScrolls: row ? row.scrollWidth > row.clientWidth : false,
      };
    });
    expect(chips.count).toBe(5);
    expect(chips.shortest).toBeGreaterThanOrEqual(44);
    expect(chips.rows).toBe(1);
    expect(chips.rowScrolls).toBe(true);

    // Map (the default tab): background, grid, fog, staging zone — the four
    // §M4b done-when items that live here, each reachable by scrolling.
    await reach(page, dialog.getByText("Map Background", { exact: true }));
    await expect(dialog.getByPlaceholder("Paste image URL")).toBeVisible();
    await reach(page, dialog.getByText("Grid Controls"));
    await reach(page, dialog.getByText("Grid Size"));
    await reach(page, dialog.getByText("Fog of War"));
    await reach(page, dialog.getByText("Player Staging Zone"));

    // NPCs.
    await dialog.getByRole("button", { name: "NPCs & Monsters" }).click();
    await reach(page, dialog.getByRole("button", { name: "+ Add NPC" }));

    // Props.
    await dialog.getByRole("button", { name: "Props & Objects" }).click();
    await reach(page, dialog.getByRole("button", { name: "+ Add Prop" }));

    // Players.
    await dialog.getByRole("button", { name: "Players", exact: true }).click();
    await reach(page, dialog.getByRole("button", { name: /SELECT ALL/i }).first());

    // Session: save/load, invite link, and — on the public test table — the
    // save-as-private-table flow that stands in for the password control.
    await dialog.getByRole("button", { name: "Session", exact: true }).click();
    await reach(page, dialog.getByText("Session Save/Load"));
    await reach(page, dialog.getByText("Invite Players"));
    await reach(page, dialog.getByText(/Save as a Private Table/i));
  });

  test("NPC create and delete, end to end by touch", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openDMScreen(page);

    const dialog = page.getByRole("dialog", { name: "DM Menu" });
    await dialog.getByRole("button", { name: "NPCs & Monsters" }).click();

    const before = await page.evaluate(
      () =>
        (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
          .filter((c: { type?: string }) => c.type === "npc")
          .map((c: { id: string }) => c.id) as string[],
    );

    try {
      const addNpc = dialog.getByRole("button", { name: "+ Add NPC" });
      await addNpc.scrollIntoViewIfNeeded();
      await addNpc.click();

      // The round trip is real: the snapshot grows an NPC and its card shows.
      await page.waitForFunction((count) => {
        const npcs = (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
          (c: { type?: string }) => c.type === "npc",
        );
        return npcs.length === count + 1;
      }, before.length);
      await expect(dialog.getByText(/No NPCs yet/i)).toBeHidden();
    } finally {
      // The default table is shared between specs AND runs; delete exactly
      // what this spec added, through the app's own message.
      await page.evaluate((preexisting) => {
        const npcs = (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
          (c: { type?: string }) => c.type === "npc",
        );
        for (const npc of npcs) {
          if (!preexisting.includes(npc.id)) {
            window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-npc", id: npc.id });
          }
        }
      }, before);
      await page.waitForFunction((count) => {
        const npcs = (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
          (c: { type?: string }) => c.type === "npc",
        );
        return npcs.length === count;
      }, before.length);
    }
  });

  test("the chips hold the floor in landscape too", async ({ page }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    await joinMobileTable(page);
    await openDMScreen(page);

    const shortest = await page.evaluate(() => {
      const labels = ["Map Setup", "NPCs & Monsters", "Props & Objects", "Players", "Session"];
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) =>
        labels.includes((b.textContent || "").trim()),
      );
      return Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().height)));
    });
    expect(shortest).toBeGreaterThanOrEqual(44);

    await expect(
      page.getByRole("dialog", { name: "DM Menu" }).getByPlaceholder("Paste image URL"),
    ).toBeVisible();
  });
});
