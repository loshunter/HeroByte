import { expect, test } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";
import {
  boardBox,
  closeTopWindow,
  computeGenRegion,
  dragBoard,
  dragPath,
  elevateViaUI,
  ensureImgDir,
  hideEntitiesPanel,
  makeSteps,
  selectDMTab,
  setStagingZone,
  shotPage,
  startLiveMap,
  waitBake,
  waitSnap,
} from "./docs-shots.helpers";

// Documentation screenshots — DM tools + live map authoring.
// Run via `pnpm docs:screenshots`; images land in docs/user-guide/img/.

test.describe("docs screenshots: DM", () => {
  test("DM elevation and menu tour", async ({ page }) => {
    test.setTimeout(150_000);
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

    await step("map setup tab + staging zone", async () => {
      await setStagingZone(page, { x: 8, y: 8, w: 4, h: 4 });
      await shotPage(page, "dm-menu-map-setup");
    });

    await step("npcs tab", async () => {
      await selectDMTab(page, "NPCs & Monsters");
      await page.getByRole("button", { name: "+ Add NPC" }).click();
      await page.getByRole("button", { name: /PLACE ON MAP/i }).click();
      await page.waitForTimeout(500);
      await shotPage(page, "dm-menu-npcs");
    });

    await step("props tab", async () => {
      await selectDMTab(page, "Props & Objects");
      await page.getByRole("button", { name: "+ Add Prop" }).click();
      await page.waitForTimeout(400);
      await shotPage(page, "dm-menu-props");
    });

    await step("players tab", async () => {
      await selectDMTab(page, "Players");
      await shotPage(page, "dm-menu-players");
    });

    await step("session tab", async () => {
      await selectDMTab(page, "Session");
      await shotPage(page, "dm-menu-session");
      await closeTopWindow(page, "Dungeon Master Tools");
    });

    await step("initiative modal + combat", async () => {
      await page.getByRole("button", { name: "Set Initiative" }).first().click();
      await expect(page.getByText(/Initiative:/).first()).toBeVisible();
      await shotPage(page, "initiative-modal");
      await page.getByRole("button", { name: "Roll Initiative" }).click();
      // Rolling is ONE press now. The server rolls, applies the value and the
      // modal closes itself, so the Save that used to follow this line no
      // longer exists on the roll path — Save belongs to manual entry only.
      // The first applied initiative auto-starts combat; the banner is public.
      await expect(page.getByText("Combat Active")).toBeVisible({ timeout: 10_000 });
      await shotPage(page, "combat-active");
      await selectDMTab(page, "Players");
      await page.getByRole("button", { name: /END COMBAT/i }).click();
      await closeTopWindow(page, "Dungeon Master Tools");
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("live map authoring walkthrough", async ({ page, browser }) => {
    test.setTimeout(300_000);
    ensureImgDir();
    const { step, failures } = makeSteps();

    await step(
      "elevate + start live map",
      async () => {
        await joinDefaultRoomAsDM(page);
        await page.getByTitle("Reset camera to center of map").click();
        await hideEntitiesPanel(page);
        await startLiveMap(page);
        await shotPage(page, "mapedit-start");
      },
      { required: true },
    );

    // Geometry: camera is at origin/1x, so world cells = (screen - box.origin)
    // / 50. Keep drags right of the floating palette (~270px) and inside the
    // canvas strip.
    const box = await boardBox(page);
    const grid = 50;
    const room = {
      x1: box.x + 320,
      y1: box.y + 140,
      x2: box.x + 720,
      y2: box.y + 490,
    };
    const roomCells = {
      cx: Math.round((room.x1 + room.x2) / 2 - box.x) / grid,
      cy: Math.round((room.y1 + room.y2) / 2 - box.y) / grid,
    };

    await step("staging zone inside the future room", async () => {
      await setStagingZone(page, {
        x: Math.round(roomCells.cx),
        y: Math.round(roomCells.cy),
        w: 3,
        h: 3,
      });
      await closeTopWindow(page, "Dungeon Master Tools");
    });

    await step(
      "room tool: options + drag",
      async () => {
        await page.getByRole("button", { name: /🏠 Room/ }).click();
        await shotPage(page, "mapedit-room-options");
        await dragBoard(page, { x: room.x1, y: room.y1 }, { x: room.x2, y: room.y2 });
        await waitSnap(page, () => {
          const s = window.__HERO_BYTE_E2E__?.snapshot;
          return (s?.compiledScene?.walls?.length ?? 0) > 0;
        });
        await waitBake(page);
        await shotPage(page, "mapedit-room-done");
      },
      { required: true },
    );

    const doorY = (room.y1 + room.y2) / 2;

    await step("door on the east wall", async () => {
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /🚪 Door/ }).click();
      await dragBoard(page, { x: room.x2, y: doorY - 50 }, { x: room.x2, y: doorY + 50 });
      await waitSnap(
        page,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.length ?? 0) > 0,
      );
      await waitBake(page);
      await shotPage(page, "mapedit-door");
    });

    await step("hallway east from the door", async () => {
      await page.getByRole("button", { name: /🚇 Hall/ }).click();
      await dragBoard(
        page,
        { x: room.x2 + 30, y: doorY },
        { x: Math.min(room.x2 + 340, box.x + box.width - 40), y: doorY },
      );
      await waitBake(page);
      await shotPage(page, "mapedit-hall");
    });

    await step("torch pools + night ambient", async () => {
      await page.getByRole("button", { name: /💡 Light/ }).click();
      await page.mouse.click(room.x1 + 90, room.y1 + 80);
      await page.waitForTimeout(400);
      await page.mouse.click(room.x2 - 90, room.y2 - 80);
      await waitSnap(
        page,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.lights?.length ?? 0) >= 2,
      );
      await page.getByRole("button", { name: /🗂 Layers/ }).click();
      await page.getByLabel("Lighting opacity").fill("0.55");
      await waitBake(page, 1_800);
      await shotPage(page, "mapedit-night-lights");
      await page.getByRole("button", { name: /🗂 Layers/ }).click();
    });

    await step("paint water with the brush deck", async () => {
      await page.getByRole("button", { name: /🖌️ Paint/ }).click();
      await shotPage(page, "mapedit-brush-deck");
      await page.getByLabel("Search brushes").fill("water");
      await page.getByTitle("Water", { exact: true }).first().click();
      const waterY = Math.min(room.y2 + 90, box.y + box.height - 60);
      await dragPath(page, [
        { x: room.x1 + 30, y: waterY },
        { x: room.x1 + 190, y: waterY + 30 },
        { x: room.x1 + 350, y: waterY - 20 },
        { x: room.x1 + 430, y: waterY + 40 },
      ]);
      await waitBake(page, 1_800);
      await shotPage(page, "mapedit-paint-water");
    });

    await step("place props from the asset picker", async () => {
      await page.getByRole("button", { name: /📦 Place/ }).click();
      await page.getByRole("button", { name: /▸ / }).click();
      await shotPage(page, "mapedit-asset-picker");
      await page.getByRole("option", { name: "Table", exact: true }).click();
      await page.mouse.click(room.x1 + 170, room.y1 + 150);
      await page.waitForTimeout(300);
      await page.getByRole("option", { name: "Crate", exact: true }).click();
      await page.mouse.click(room.x1 + 250, room.y1 + 100);
      await waitBake(page);
    });

    await step("populate the hallway", async () => {
      await page.getByTitle("Fill the last room or hallway you placed with set dressing").click();
      await waitBake(page, 1_500);
      await shotPage(page, "mapedit-populated");
    });

    await step("generate a dungeon wing", async () => {
      // Zoom out until a ≥20×20-cell region of positive world cells (clear of
      // the authored room/hall) fits on screen, verified via the live camera.
      const region = await computeGenRegion(page, box);
      await page.getByRole("button", { name: /🏰 Gen/ }).click();
      await dragBoard(page, region.from, region.to);
      await expect(page.getByText(/Region: \d+ × \d+ cells/)).toBeVisible();
      const wallsBefore = await page.evaluate(
        () => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0,
      );
      await page.getByRole("button", { name: /GENERATE/ }).click();
      await page.waitForFunction(
        (before) =>
          (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0) > before,
        wallsBefore,
        { timeout: 45_000 },
      );
      await waitBake(page, 2_500);
      await shotPage(page, "mapedit-generated-dungeon");
    });

    await step("quick wheel", async () => {
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.click(center.x - 100, center.y + 40, { button: "right" });
      await page.waitForTimeout(500);
      await shotPage(page, "mapedit-quick-wheel");
      await page.keyboard.press("Escape");
    });

    await step("player lens", async () => {
      await page
        .getByTitle("See the table exactly as players do (fog, secret doors, no DM overlays)")
        .click();
      await page.waitForTimeout(800);
      await shotPage(page, "dm-player-lens");
      await page
        .getByTitle("See the table exactly as players do (fog, secret doors, no DM overlays)")
        .click();
    });

    await step("enable fog + player view", async () => {
      await selectDMTab(page, "Map Setup");
      await page.getByRole("button", { name: /FOG/ }).click();
      await waitSnap(page, () => window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled === true);
      await closeTopWindow(page, "Dungeon Master Tools");

      const playerContext = await browser.newContext();
      const player = await playerContext.newPage();
      try {
        await joinDefaultRoom(player);
        await waitSnap(player, () => window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled === true);
        await player.getByTitle("Reset camera to center of map").click();
        await expect(player.getByText(/Painting terrain/)).toBeHidden({ timeout: 30_000 });
        await player.waitForTimeout(1_500);
        await shotPage(player, "player-fog-view");
      } finally {
        await playerContext.close();
      }
    });

    await step("hero shot with CRT", async () => {
      // Clean composition: fog back off (it has its own capture), evening
      // ambient rather than deep night, no palette window, no DM overlays
      // (player lens), CRT for the retro flavor, framed on the authored rooms.
      await selectDMTab(page, "Map Setup");
      await page.getByRole("button", { name: /FOG/ }).click();
      await waitSnap(page, () => window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled === false);
      await closeTopWindow(page, "Dungeon Master Tools");
      // The Gen tool is still armed and its panel replaces the Layers block —
      // arm a neutral tool first.
      await page.getByRole("button", { name: /👆 Select/ }).click();
      await page.getByRole("button", { name: /🗂 Layers/ }).click();
      await page.getByLabel("Lighting opacity").fill("0.75");
      await waitBake(page, 1_500);
      await closeTopWindow(page, "MAP TOOLS");
      await page
        .getByTitle("See the table exactly as players do (fog, secret doors, no DM overlays)")
        .click();
      await page.getByTitle("Reset camera to center of map").click();
      await page.mouse.move(box.x + 620, box.y + 300);
      for (let i = 0; i < 4; i += 1) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(80);
      }
      // Zooming kicks off another progressive bake — let the progress chip
      // clear before framing the shot.
      await expect(page.getByText(/Painting terrain/)).toBeHidden({ timeout: 30_000 });
      await page.getByTitle("Toggle retro CRT visual effect").click();
      await page.waitForTimeout(800);
      await shotPage(page, "hero-table");
      await page.getByTitle("Toggle retro CRT visual effect").click();
      await page
        .getByTitle("See the table exactly as players do (fog, secret doors, no DM overlays)")
        .click();
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
