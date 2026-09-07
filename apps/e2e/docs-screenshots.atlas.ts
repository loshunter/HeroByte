import { expect, test } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";
import {
  closeTopWindow,
  ensureImgDir,
  hideEntitiesPanel,
  makeSteps,
  selectDMTab,
  shotPage,
  startLiveMap,
  waitBake,
  waitSnap,
} from "./docs-shots.helpers";

// Documentation screenshots — the Atlas and the Kicked-In Door.
// Run via `pnpm docs:screenshots`; images land in docs/user-guide/img/.
//
// Its own file rather than more of docs-screenshots.dm.ts, which is at 341 of
// the 350 structural ceiling. The walkthrough is the guide's order: the Atlas
// tab, the kick panel, what the table looks like a second later, and the
// player's world map.

test.describe("docs screenshots: the Atlas and the Kicked-In Door", () => {
  test("atlas tab, kick panel, arrival, world map", async ({ browser }) => {
    test.setTimeout(180_000);
    ensureImgDir();
    const { step, failures } = makeSteps();

    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    dm.on("dialog", (dialog) => void dialog.accept());

    try {
      await step(
        "a DM on a live map, with a player at the table",
        async () => {
          await joinDefaultRoomAsDM(dm);
          await startLiveMap(dm);
          await closeTopWindow(dm);
          await hideEntitiesPanel(dm);
          await joinDefaultRoom(player);
          await waitSnap(player, () =>
            Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId),
          );
        },
        { required: true },
      );

      await step("the Atlas tab", async () => {
        await selectDMTab(dm, "Atlas");
        await expect(dm.getByLabel("New node name")).toBeVisible({ timeout: 15_000 });
        await shotPage(dm, "dm-atlas-tab");
        await closeTopWindow(dm);
      });

      await step(
        "the kick panel, opened with G",
        async () => {
          await dm.locator(".konvajs-content").click({ position: { x: 40, y: 40 } });
          await dm.keyboard.press("g");
          const panel = dm.getByRole("dialog", { name: "Kick in a door" });
          await expect(panel).toBeVisible({ timeout: 15_000 });
          await panel.getByLabel("Recipe").selectOption("building");
          await panel.getByLabel("Kind").selectOption("tavern");
          await panel.getByLabel("Size").selectOption("small");
          await panel.getByLabel("Name").fill("The Salt Hound");
          await shotPage(dm, "dm-kick-panel");
        },
        { required: true },
      );

      await step(
        "the table, a second after ROLL",
        async () => {
          await dm.getByRole("button", { name: "🚪 ROLL" }).click();
          await waitSnap(
            dm,
            () => {
              const data = window.__HERO_BYTE_E2E__;
              const here = data?.snapshot?.atlasNodes?.find(
                (node) => node.id === data.snapshot?.currentAtlasNodeId,
              );
              return here?.name === "The Salt Hound";
            },
            40_000,
          );
          // Frame the building rather than wherever the arrival camera landed.
          await dm.evaluate(() => {
            const data = window.__HERO_BYTE_E2E__!;
            const scene = data.snapshot!.compiledScene!;
            const board = document.querySelector('[data-testid="map-board"]')!;
            const box = board.getBoundingClientRect();
            const scale = Math.min(box.width / scene.width, box.height / scene.height) * 0.9;
            data.setCam!({
              x: box.width / 2 - (scene.width / 2) * scale,
              y: box.height / 2 - (scene.height / 2) * scale,
              scale,
            });
          });
          // The terrain bakes asynchronously; without this the shot catches
          // "Painting terrain… 0%" and a washed-out floor.
          await waitBake(dm, 2_000);
          await shotPage(dm, "dm-kick-arrival");
        },
        { required: true },
      );

      await step("the player's world map", async () => {
        await waitSnap(player, () =>
          Boolean(
            window.__HERO_BYTE_E2E__?.snapshot?.atlasNodes?.some(
              (node) => node.name === "The Salt Hound",
            ),
          ),
        );
        await player.getByRole("button", { name: "🗺 WORLD" }).click();
        await expect(player.getByLabel("you are here: The Salt Hound")).toBeVisible();
        await shotPage(player, "player-world-map");
      });

      expect(failures, `screenshot steps failed:\n${failures.join("\n")}`).toEqual([]);
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
