import { chooseBuildTool } from "./build-palette.helpers";
import { expect, test } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";
import {
  boardBox,
  closeTopWindow,
  computeGenRegion,
  dragBoard,
  dragPath,
  ensureImgDir,
  focusOwnToken,
  hideEntitiesPanel,
  makeSteps,
  revealInPalette,
  selectDMTab,
  setStagingZone,
  shotPage,
  startLiveMap,
  waitBake,
  waitSnap,
} from "./docs-shots.helpers";

// Documentation screenshots — live map authoring (the map editor guide).
// Split from docs-screenshots.dm.ts for the 350-line guard; unchanged.
// Run via `pnpm docs:screenshots`; images land in docs/user-guide/img/.

test.describe("docs screenshots: DM", () => {
  test("live map authoring walkthrough", async ({ page, browser }) => {
    test.setTimeout(300_000);
    // Tall, like the DM tour: the palette keeps map history, Select/Sample and
    // Layers above its scrolling settings, and at 720px that scroller was ~200px
    // — the brush deck, wall ring and asset picker these captures document all
    // fell below it. The palette's height cap follows the viewport.
    await page.setViewportSize({ width: 1280, height: 1000 });
    ensureImgDir();
    const { step, failures } = makeSteps();

    await step(
      "elevate + start live map",
      async () => {
        await joinDefaultRoomAsDM(page);
        await page.getByTitle("Reset camera to center of map").click();
        await hideEntitiesPanel(page);
        await startLiveMap(page);
        // The pointer is left where START LIVE MAP was, which is now Cancel
        // placement — hovered, it reads as armed. The elevation toast is 4s.
        await page.mouse.move(1000, 10);
        await expect(page.getByText(/DM elevation successful/)).toBeHidden({ timeout: 10_000 });
        await shotPage(page, "mapedit-start");
      },
      { required: true },
    );

    // Geometry: camera is at origin/1x, so world cells = (screen - box.origin)
    // / 50. Keep drags right of the floating palette (~320px since the tools
    // were grouped) and inside the canvas strip.
    const box = await boardBox(page);
    const grid = 50;
    const room = {
      x1: box.x + 420,
      y1: box.y + 140,
      x2: box.x + 820,
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
        await chooseBuildTool(page, "room");
        // Room's settings outgrow the scroller: end on the wall ring, so the
        // capture holds it and the brush deck above it.
        await revealInPalette(page.getByText("Wall ring:", { exact: true }).locator(".."), "end");
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
      await chooseBuildTool(page, "door");
      await dragBoard(page, { x: room.x2, y: doorY - 50 }, { x: room.x2, y: doorY + 50 });
      await waitSnap(
        page,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.length ?? 0) > 0,
      );
      await waitBake(page);
      await shotPage(page, "mapedit-door");
    });

    await step("hallway east from the door", async () => {
      await chooseBuildTool(page, "hallway");
      await dragBoard(
        page,
        { x: room.x2 + 30, y: doorY },
        { x: Math.min(room.x2 + 340, box.x + box.width - 40), y: doorY },
      );
      await waitBake(page);
      await shotPage(page, "mapedit-hall");
    });

    await step("torch pools + night ambient", async () => {
      await chooseBuildTool(page, "light");
      await page.mouse.click(room.x1 + 90, room.y1 + 80);
      await page.waitForTimeout(400);
      await page.mouse.click(room.x2 - 90, room.y2 - 80);
      await waitSnap(
        page,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.lights?.length ?? 0) >= 2,
      );
      await page.getByRole("button", { name: /🗂 Layers/ }).click();
      await page.getByRole("region", { name: "Layers" }).getByLabel("Ambient light").fill("0.55");
      await waitBake(page, 1_800);
      await shotPage(page, "mapedit-night-lights");
      await page.getByRole("button", { name: /🗂 Layers/ }).click();
    });

    await step("paint water with the brush deck", async () => {
      await chooseBuildTool(page, "terrain");
      // Pin the armed material so the capture has a ★ Pinned shelf, and start
      // the scroller at the deck's category picker rather than the brush size.
      await page.getByTestId("build-settings").getByRole("button", { name: /^Pin / }).click();
      await revealInPalette(page.getByLabel("Material category").locator(".."), "start");
      await shotPage(page, "mapedit-brush-deck");
      await page.getByLabel("Search brushes").fill("water");
      await page.getByTitle("Water", { exact: true }).first().click();
      // Clear of the room's south wall band, which sits outside the drag.
      const waterY = Math.min(room.y2 + 150, box.y + box.height - 60);
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
      await chooseBuildTool(page, "place");
      await page.getByRole("button", { name: /▸ / }).click();
      // From the Asset label down: Selected object, categories, search, cards.
      await revealInPalette(page.getByText("Asset:", { exact: true }), "start");
      await shotPage(page, "mapedit-asset-picker");
      const objects = page.getByRole("group", { name: "Objects", exact: true });
      await objects.getByRole("button", { name: "Table", exact: true }).click();
      await page.mouse.click(room.x1 + 170, room.y1 + 150);
      await page.waitForTimeout(300);
      await objects.getByRole("button", { name: "Crate", exact: true }).click();
      await page.mouse.click(room.x1 + 250, room.y1 + 100);
      await waitBake(page);
    });

    await step("populate the hallway", async () => {
      // Decoration lives in the Room/Hallway settings now, and the button names
      // its target, so re-arm the hallway tool. Bounded: the control renders
      // disabled until the target is live, and an unbounded click on it spends
      // the whole test timeout, which loses every capture after this one.
      await chooseBuildTool(page, "hallway");
      const decorate = page.getByRole("region", { name: "Decorate the last placed area" });
      // High density: at medium a two-cell hallway rolls about one stamp.
      await decorate.getByRole("button", { name: "high", exact: true }).click({ timeout: 15_000 });
      await decorate
        .getByRole("button", { name: /Decorate last hallway/ })
        .click({ timeout: 15_000 });
      await waitBake(page, 1_500);
      await shotPage(page, "mapedit-populated");
    });

    await step("generate a dungeon wing", async () => {
      // Zoom out until a ≥20×20-cell region of positive world cells (clear of
      // the authored room/hall) fits on screen, verified via the live camera.
      // clearCols follows the room: it starts two cells further east than the
      // helper's default assumes.
      const region = await computeGenRegion(page, box, { clearCols: 18 });
      await chooseBuildTool(page, "generate");
      // Arming and aiming are separate failures and used to report as one: the
      // region badge never appearing reads as "the drag did not take" whether
      // the tool armed or not. The idle prompt is the Generate panel saying it
      // IS armed and waiting.
      await expect(page.getByText("Drag a region on the map…")).toBeVisible();
      await dragBoard(page, region.from, region.to);
      await expect(page.getByText(/Region: \d+ × \d+ cells/)).toBeVisible();
      const wallsBefore = await page.evaluate(
        () => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0,
      );
      await page.getByRole("button", { name: "🎲 Generate in this area", exact: true }).click();
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
      await selectDMTab(page, "Maps");
      await page.getByRole("button", { name: /FOG/ }).click();
      await waitSnap(page, () => window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled === true);
      await closeTopWindow(page, "Dungeon Master Tools");

      const playerContext = await browser.newContext();
      const player = await playerContext.newPage();
      try {
        await joinDefaultRoom(player);
        await waitSnap(player, () => window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled === true);
        await focusOwnToken(player);
        await hideEntitiesPanel(player);
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
      await selectDMTab(page, "Maps");
      await page.getByRole("button", { name: /FOG/ }).click();
      await waitSnap(page, () => window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled === false);
      await closeTopWindow(page, "Dungeon Master Tools");
      // The Gen tool is still armed and its panel replaces the Layers block —
      // arm a neutral tool first.
      await page.getByRole("button", { name: /👆 Select/ }).click();
      await page.getByRole("button", { name: /🗂 Layers/ }).click();
      await page.getByRole("region", { name: "Layers" }).getByLabel("Ambient light").fill("0.75");
      await waitBake(page, 1_500);
      await closeTopWindow(page, "MAP TOOLS");
      // The README hero stays 16:9; only the authoring captures needed height.
      await page.setViewportSize({ width: 1280, height: 720 });
      await page
        .getByTitle("See the table exactly as players do (fog, secret doors, no DM overlays)")
        .click();
      await page.getByTitle("Reset camera to center of map").click();
      await page.mouse.move(box.x + 720, box.y + 200);
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
