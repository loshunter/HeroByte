/**
 * The kicked-in door on a phone (K3): dock DM → 🚪 Kick in a door → the screen's
 * controls clear the 44px floor in both orientations → ROLL → the table stands
 * in the new node, and a phone player's world map says so.
 *
 * The physics are atlasKick.contract.test.ts's job; what only THIS spec proves
 * is that every one of those controls is reachable by finger, and that the
 * surface machine (not a desktop panel) is what opens and closes the screen.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable, undersizedControls } from "./mobile.helpers";

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

async function openKickScreen(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: /Mobile actions/i })
    .getByRole("button", { name: /^DM$/i })
    .click();
  const dmScreen = page.getByRole("dialog", { name: "DM Menu" });
  await expect(dmScreen).toBeVisible();
  await dmScreen.getByRole("button", { name: /🚪 Kick in a door/i }).click();
  await expect(page.getByRole("dialog", { name: "Kick in a door" })).toBeVisible();
  // The DM screen yielded: one surface at a time.
  await expect(dmScreen).toBeHidden();
}

test.describe("mobile — the kicked-in door", () => {
  test("a phone DM kicks in a door by finger; a phone player's world map lands on it", async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const dmContext = await browser.newContext({ viewport: PORTRAIT });
    const playerContext = await browser.newContext({ viewport: PORTRAIT });
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();

    try {
      await joinMobileTable(dm);
      await elevateToDM(dm);
      await joinMobileTable(player);

      // A live map to kick out of: the DM screen's first verb → START LIVE MAP.
      await dm.getByRole("button", { name: /^DM$/i }).click();
      await dm.getByRole("button", { name: /Edit the live map/i }).click();
      const editDock = dm.getByRole("navigation", { name: /Map edit actions/i });
      await expect(editDock).toBeVisible();
      await editDock.getByRole("button", { name: /^Tool$/i }).click();
      await dm.getByRole("button", { name: /Start live map/i }).click();
      await dm.waitForFunction(
        () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId),
        undefined,
        { timeout: 30_000 },
      );
      // EXIT the mode, not just its sheet: map-edit REPLACES the player dock,
      // and the kick screen is reached from the player dock's DM button. (The
      // sheet's own ✕ says "Close tools" and leaves the mode armed.)
      await editDock.getByRole("button", { name: /^Exit$/i }).click();
      await expect(dm.getByRole("navigation", { name: /Mobile actions/i })).toBeVisible();

      // The screen's controls clear the touch floor in BOTH orientations.
      await openKickScreen(dm);
      expect(await undersizedControls(dm, "[data-mobile-surface='kick']")).toEqual([]);
      await dm.setViewportSize(LANDSCAPE);
      await dm.waitForTimeout(300);
      expect(await undersizedControls(dm, "[data-mobile-surface='kick']")).toEqual([]);
      await dm.setViewportSize(PORTRAIT);

      const screen = dm.getByRole("dialog", { name: "Kick in a door" });
      await screen.getByLabel("Name").fill("Cellar");
      await screen.getByLabel("Size").selectOption("small");
      await screen.getByRole("button", { name: "🚪 ROLL" }).click();
      // ROLL left the surface.
      await expect(screen).toBeHidden();

      await dm.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          const here = data?.snapshot?.atlasNodes?.find(
            (node) => node.id === data.snapshot?.currentAtlasNodeId,
          );
          return here?.name === "Cellar" && Boolean(here.parentId);
        },
        undefined,
        { timeout: 30_000 },
      );

      // The player's world map: Tools → World → you are here: Cellar.
      await player.getByRole("button", { name: /Tools/i }).click();
      await player.getByRole("button", { name: /^World$/i }).click();
      const world = player.getByRole("dialog", { name: /World Map/i });
      await expect(world).toBeVisible();
      await expect(world.getByText(/Cellar/)).toBeVisible({ timeout: 15_000 });
      await expect(world.getByText(/you are here/i)).toBeVisible();
    } finally {
      await dm
        .evaluate(() => {
          const data = window.__HERO_BYTE_E2E__;
          if (!data?.snapshot) return;
          for (const link of data.snapshot.atlasLinks ?? []) {
            data.sendMessage!({ t: "atlas-delete-link", linkId: link.id });
          }
          for (const node of data.snapshot.atlasNodes ?? []) {
            const documentId = (node as { mapDocumentId?: string }).mapDocumentId;
            data.sendMessage!({ t: "atlas-delete-node", nodeId: node.id });
            if (documentId) {
              data.sendMessage!({ t: "map-studio-delete", documentId });
            }
          }
        })
        .catch(() => undefined);
      await dmContext.close();
      await playerContext.close();
    }
  });
});
