import { expect, test } from "./fixtures";
import { openCharacterDetails, ownRosterRow } from "./party.helpers";
import { joinDefaultRoom } from "./helpers";
import {
  closeTopWindow,
  elevateViaUI,
  ensureImgDir,
  makeSteps,
  selectDMTab,
  setStagingZone,
  shotPage,
} from "./docs-shots.helpers";

// Documentation screenshots — DM elevation and the DM menu tour. The live map
// authoring walkthrough lives in docs-screenshots.authoring.ts.
// Run via `pnpm docs:screenshots`; images land in docs/user-guide/img/.

test.describe("docs screenshots: DM", () => {
  test("DM elevation and menu tour", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 1000 });
    ensureImgDir();
    const { step, failures } = makeSteps();

    await step(
      "join and elevate via UI",
      async () => {
        await joinDefaultRoom(page);
        await elevateViaUI(page, {
          onModal: async () => {
            await shotPage(page, "dm-elevate-modal");
          },
        });
      },
      { required: true },
    );

    // TWO shots: the Map tab is taller than the panel, and setStagingZone types
    // into its LAST control, so a single capture was always scrolled to the
    // bottom and silently lost everything above it — the Table Sight Default
    // included. Each scroll is anchored deliberately. getByRole for the
    // background field: the file input beside it is labelled "…URL upload" and
    // getByLabel is a SUBSTRING match, so the plain label matches both.
    await step("map setup tab + staging zone", async () => {
      await setStagingZone(page, { x: 8, y: 8, w: 4, h: 4 });

      await page.getByLabel("Default sight radius in feet").scrollIntoViewIfNeeded();
      await shotPage(page, "dm-menu-map-sight");

      await page.getByRole("textbox", { name: "Map Background URL" }).scrollIntoViewIfNeeded();
      await shotPage(page, "dm-menu-map-setup");
    });

    await step("npcs tab", async () => {
      await selectDMTab(page, "NPCs & Monsters");
      await page.getByRole("button", { name: "+ Add NPC" }).click();
      await page.getByRole("button", { name: /PLACE ON MAP/i }).click();
      // Settled, not mid-flight: the editor's banners clear once the server
      // confirms the new NPC and its token (it once shot "Updating..." and
      // "Placing token..." still up, 500 ms in).
      await expect(page.getByText("Placing token...")).toHaveCount(0, { timeout: 8_000 });
      await expect(page.getByText("Updating...")).toHaveCount(0, { timeout: 8_000 });
      await page.waitForTimeout(500);
      await shotPage(page, "dm-menu-npcs");
    });

    await step("props tab", async () => {
      await selectDMTab(page, "Props & Objects");
      await page.getByRole("button", { name: "+ Add Prop" }).click();
      await page.waitForTimeout(400);
      await shotPage(page, "dm-menu-props");
    });

    await step("table tab", async () => {
      // U9: Players and Session are ONE tab — the table's own settings.
      await selectDMTab(page, "Table");
      await shotPage(page, "dm-menu-table");
      await closeTopWindow(page, "Dungeon Master Tools");
    });

    await step("initiative modal + combat", async () => {
      // The initiative badge is on the card: the DM's own row's details (U7).
      await openCharacterDetails(page, ownRosterRow(page));
      await page.getByRole("button", { name: "Set Initiative" }).first().click();
      await expect(page.getByText(/Initiative:/).first()).toBeVisible();
      await shotPage(page, "initiative-modal");
      await page.getByRole("button", { name: "Roll d20 now" }).click();
      // Rolling is ONE press now. The server rolls, applies the value and the
      // modal closes itself, so the Save that used to follow this line no
      // longer exists on the roll path — Save belongs to manual entry only.
      // The first applied initiative auto-starts combat; the banner is public.
      await expect(page.getByText("Combat Active")).toBeVisible({ timeout: 10_000 });
      await shotPage(page, "combat-active");
      // U8: the fight is run from DM tools → Encounter.
      await selectDMTab(page, "Encounter");
      await expect(page.getByRole("heading", { name: "Run encounter" })).toBeVisible();
      await shotPage(page, "dm-menu-encounter");
      await page.getByRole("button", { name: /End combat/i }).click();
      await closeTopWindow(page, "Dungeon Master Tools");
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
