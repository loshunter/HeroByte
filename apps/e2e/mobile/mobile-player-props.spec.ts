/**
 * E2E (mobile): the player props surface — Tools sheet tile → full-height
 * Props screen → add a prop by finger-sized clicks.
 *
 * The tile only exists while the table's toggle is on and the viewer is NOT
 * the DM (a DM's prop editor is the DM menu's Props tab), so the spec runs
 * two contexts. The project's default `page` IS the mobile device in this
 * project, so the mobile player uses it; the DM drives a separate
 * desktop-sized context, because the desktop join helper waits on the
 * desktop header (mobile.helpers.ts:3-7 documents exactly this trap).
 */

import { expect, test } from "../fixtures";
import { joinDefaultRoomAsDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

test("a mobile player reaches Props through the Tools sheet and adds one", async ({
  browser,
  page,
}) => {
  const dmContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dmPage = await dmContext.newPage();
  const created: string[] = [];
  try {
    await joinDefaultRoomAsDM(dmPage);
    await joinMobileTable(page);

    // Toggle OFF: the sheet offers no Props tile.
    await page.getByRole("button", { name: "Tools" }).click();
    await expect(page.getByRole("button", { name: "Props" })).toHaveCount(0);
    await page.getByRole("button", { name: "Close tools" }).click();

    await dmPage.evaluate(() =>
      window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "set-player-props-enabled", enabled: true }),
    );

    // Toggle ON: tile appears, opens the full-height screen.
    await page.getByRole("button", { name: "Tools" }).click();
    const tile = page.getByRole("button", { name: "Props" });
    await expect(tile).toBeVisible();
    await tile.click();
    // The form field, not getByText("Add a Prop") — that string substring-
    // matches the empty-state copy ("Add a prop above…") and trips strict mode.
    await expect(page.getByPlaceholder("Treasure Chest")).toBeVisible();

    const label = `Lantern${Date.now().toString(36)}`;
    await page.getByPlaceholder("Treasure Chest").fill(label);
    await page.getByRole("button", { name: "+ Add Prop" }).click();

    await expect
      .poll(() =>
        dmPage.evaluate(
          (label) =>
            (window.__HERO_BYTE_E2E__?.snapshot?.props ?? []).filter((p) => p.label === label)
              .length,
          label,
        ),
      )
      .toBe(1);
    const mine = await dmPage.evaluate(
      (label) => (window.__HERO_BYTE_E2E__?.snapshot?.props ?? []).find((p) => p.label === label),
      label,
    );
    created.push(mine!.id);

    // Owned by the mobile player, not the DM who flipped the switch.
    const mobileUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid);
    expect(mine!.owner).toBe(mobileUid);
  } finally {
    await dmPage.evaluate((ids) => {
      for (const id of ids) {
        window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-prop", id });
      }
      window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "set-player-props-enabled", enabled: false });
    }, created);
    await dmContext.close();
  }
});
