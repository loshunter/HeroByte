/**
 * The Atlas on a phone (A7's mobile journey leg): a mobile DM reaches the
 * Atlas chip in the DM screen, cashes a promise with the generate panel, and
 * TRAVELs the table — while a mobile player opens the world map from the
 * tool sheet and finds "you are here" waiting. The full loop's physics are
 * atlas-journey.smoke.spec.ts's job; what only THIS spec proves is that
 * every one of those controls is reachable by finger.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

const VIEWPORT = { width: 375, height: 812 };

async function openAtlasChip(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: /Mobile actions/i })
    .getByRole("button", { name: /^DM$/i })
    .click();
  const dialog = page.getByRole("dialog", { name: "DM Menu" });
  await expect(dialog).toBeVisible();
  const atlasChip = dialog.getByRole("button", { name: "Atlas" });
  await atlasChip.scrollIntoViewIfNeeded();
  await atlasChip.click();
  await expect(dialog.getByLabel("New node name")).toBeVisible({ timeout: 15_000 });
}

test.describe("mobile — the atlas", () => {
  test("a phone DM cashes a promise and travels; a phone player opens the world map", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const dmContext = await browser.newContext({ viewport: VIEWPORT });
    const playerContext = await browser.newContext({ viewport: VIEWPORT });
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    dm.on("dialog", (dialog) => void dialog.accept());

    try {
      await joinMobileTable(dm);
      await elevateToDM(dm);
      await openAtlasChip(dm);
      const dialog = dm.getByRole("dialog", { name: "DM Menu" });

      // Create the promise and cash it through the generate panel, by finger.
      await dialog.getByLabel("New node name").fill("Waystone");
      await dialog.getByRole("button", { name: "+ CREATE NODE" }).click();
      const generateOpen = dialog.getByRole("button", { name: "🎲 Generate…" });
      await generateOpen.scrollIntoViewIfNeeded();
      await generateOpen.click();
      await dialog.getByLabel("Size for Waystone").selectOption("small");
      await dialog
        .getByTestId("atlas-generate-panel")
        .getByRole("button", { name: "🎲 GENERATE" })
        .click();
      await dm.waitForFunction(
        () =>
          Boolean(
            window.__HERO_BYTE_E2E__?.snapshot?.atlasNodes?.find(
              (node) =>
                node.name === "Waystone" && (node as { mapDocumentId?: string }).mapDocumentId,
            ),
          ),
        undefined,
        { timeout: 30_000 },
      );

      // TRAVEL from the same sheet; the confirm is a native dialog.
      const travel = dialog.getByRole("button", { name: "🚩 TRAVEL" });
      await travel.scrollIntoViewIfNeeded();
      await travel.click();
      await dm.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          const here = data?.snapshot?.atlasNodes?.find(
            (node) => node.id === data.snapshot?.currentAtlasNodeId,
          );
          return here?.name === "Waystone";
        },
        undefined,
        { timeout: 30_000 },
      );

      // The phone player: the scene followed, and the world map is one tile
      // away — Tools → World → the atlas surface, with the here-marker.
      await joinMobileTable(player);
      await player.waitForFunction(
        () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length),
        undefined,
        { timeout: 30_000 },
      );
      await player.getByRole("button", { name: /Tools/i }).click();
      await player.getByRole("button", { name: /^World$/i }).click();
      const worldMap = player.getByRole("dialog", { name: "World Map" });
      await expect(worldMap).toBeVisible();
      await expect(worldMap.getByLabel("you are here: Waystone")).toBeVisible();
    } finally {
      await dm
        .evaluate(() => {
          const data = window.__HERO_BYTE_E2E__;
          if (!data?.snapshot) return;
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
