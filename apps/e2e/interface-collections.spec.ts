import { expect, test, type Page } from "./fixtures";
import { hideParty } from "./party.helpers";
import { activate, armGrass, createAndJoin, mapContent } from "./u2-cancel.helpers";
import { observeGeneration } from "./u3a-generate.helpers";
import { closeBuildTools, openBuildTools } from "./u3b-palette.helpers";
import { chooseBuildTool } from "./build-palette.helpers";
import { armedSizeFits, canvasHit, targetCell, terrainReach } from "./u4b-terrain.helpers";

const npcs = (page: Page) =>
  page.evaluate(() =>
    (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
      .filter((c) => c.type === "npc")
      .map((c) => ({ id: c.id, name: c.name, tokenImage: c.tokenImage })),
  );

for (const mobile of [false, true]) {
  test(`U4c ${mobile ? "phone" : "desktop"} named collection picks preserve selection and reach the player`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      baseURL,
      viewport: mobile ? { width: 375, height: 812 } : { width: 1280, height: 720 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const observer = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const dm = await context.newPage(),
      player = await observer.newPage();
    dm.setDefaultTimeout(12_000);
    const wire = observeGeneration(dm);
    const commands = () => wire.sent.filter((m) => m.t === "map-studio-command");
    try {
      await createAndJoin(dm, player, mobile, `U4c ${mobile ? "phone" : "desktop"}`);
      if (!mobile) await hideParty(dm);
      await armGrass(dm, mobile, true);
      await openBuildTools(dm, mobile);
      if (!mobile)
        await dm.getByRole("combobox", { name: "Material category" }).selectOption("wood");
      await dm.getByRole("searchbox", { name: "Search brushes" }).fill("oak");
      const oak = dm.getByRole("button", { name: "Oak Floor", exact: true });
      await expect(oak).toHaveText("Oak Floor");
      await activate(oak, mobile);
      await expect(dm.getByRole("group", { name: "Selected material" })).toContainText("Oak Floor");
      if (!mobile) await armedSizeFits(dm, 1);
      await terrainReach(
        dm,
        [oak, dm.getByRole("button", { name: /Pin Oak Floor/ })],
        info,
        "material-reach.json",
      );
      await dm.getByRole("group", { name: "Selected material" }).scrollIntoViewIfNeeded();
      await info.attach("material-selection.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      const before = commands().length;
      await chooseBuildTool(dm, "place", mobile);
      if (!mobile) await dm.getByRole("button", { name: "▸ Crate", exact: true }).click();
      const search = dm.getByRole("searchbox", { name: "Search objects" });
      await search.fill("TABLE");
      const table = dm.getByRole("button", { name: "Table", exact: true });
      await expect(table).toHaveText("Table");
      await expect(dm.getByRole("group", { name: "Selected object" })).toContainText("Crate");
      if (mobile) await table.tap();
      else {
        await search.press("Tab");
        await expect(table).toBeFocused();
        await table.press("Enter");
      }
      const preview = dm.getByRole("group", { name: "Selected object" });
      await expect(preview).toContainText("Table");
      await expect(preview).toContainText("2 × 1 cells");
      await activate(dm.getByRole("button", { name: "Structures", exact: true }), mobile);
      await expect(preview).toContainText("Table");
      await expect(dm.getByText(/No objects match/)).toBeVisible();
      await activate(dm.getByRole("button", { name: "Objects", exact: true }), mobile);
      await expect(table).toHaveAttribute("aria-pressed", "true");
      await terrainReach(
        dm,
        [table, dm.getByRole("button", { name: "My uploads", exact: true })],
        info,
        "object-reach.json",
      );
      await preview.scrollIntoViewIfNeeded();
      await info.attach("object-selection.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      expect(commands()).toHaveLength(before);
      expect(wire.document().elements).toHaveLength(0);
      expect(
        (await mapContent(player)).elements?.layers.flatMap((layer) => layer.elements) ?? [],
      ).toHaveLength(0);
      if (mobile) {
        await dm.setViewportSize({ width: 667, height: 375 });
        await terrainReach(dm, [table], info, "landscape-object-reach.json");
        await info.attach("landscape-object.png", {
          body: await dm.screenshot(),
          contentType: "image/png",
        });
        await dm.setViewportSize({ width: 375, height: 812 });
      }
      await closeBuildTools(dm, mobile);
      const target = await targetCell(dm, wire.document(), mobile);
      await canvasHit(dm, target.from);
      if (mobile) await dm.touchscreen.tap(target.from.x, target.from.y);
      else await dm.mouse.click(target.from.x, target.from.y);
      await expect.poll(() => wire.document().elements.length).toBe(1);
      expect(wire.document().elements[0]).toMatchObject({ data: { assetId: "objects:table" } });
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(wire.document().revision);
      await expect
        .poll(async () =>
          (await mapContent(player)).elements?.layers.flatMap((layer) => layer.elements),
        )
        .toEqual([
          expect.objectContaining({ data: expect.objectContaining({ assetId: "objects:table" }) }),
        ]);
      await expect
        .poll(async () => (await mapContent(player)).elements)
        .toEqual((await mapContent(dm)).elements);
      expect(commands()).toHaveLength(before + 1);

      await openBuildTools(dm, mobile);
      await activate(dm.getByRole("button", { name: "Done building", exact: true }), mobile);
      const dmMenu = mobile
        ? dm
            .getByRole("navigation", { name: "Mobile actions" })
            .getByRole("button", { name: "DM", exact: true })
        : dm.getByRole("button", { name: /DM MENU/i });
      await activate(dmMenu, mobile);
      await activate(dm.getByRole("button", { name: "NPCs & Monsters", exact: true }), mobile);
      await activate(dm.getByRole("button", { name: "📖 Library", exact: true }), mobile);
      const library = dm.getByTestId("token-library");
      const tokenSearch = library.getByRole("searchbox", { name: "Search", exact: true });
      await tokenSearch.fill("goblin club brute");
      const goblin = library.getByRole("button", { name: "Goblin club brute", exact: true });
      await expect(goblin).toHaveText("Goblin club brute");
      await goblin.scrollIntoViewIfNeeded();
      const tokenBefore = await goblin.boundingBox();
      expect(await npcs(dm)).toEqual([]);
      if (mobile) await goblin.tap();
      else {
        await tokenSearch.press("Tab");
        await expect(goblin).toBeFocused();
        // Inspecting by keyboard must not move the target under a subsequent pointer press.
        expect((await goblin.boundingBox())!.y).toBeCloseTo(tokenBefore!.y, 1);
        expect(await npcs(dm)).toEqual([]);
        await goblin.press("Enter");
      }
      await expect.poll(async () => (await npcs(dm)).length).toBe(1);
      await terrainReach(
        dm,
        [goblin, library.getByRole("button", { name: "Townsfolk", exact: true })],
        info,
        "token-reach.json",
      );
      await expect(library.getByRole("group", { name: "Token preview" })).toContainText(
        "Goblin club brute",
      );
      await activate(library.getByRole("button", { name: "Townsfolk", exact: true }), mobile);
      await expect(library.getByRole("group", { name: "Token preview" })).toContainText(
        "Goblin club brute",
      );
      expect(await npcs(dm)).toHaveLength(1);
      const tokenPreview = library.getByRole("group", { name: "Token preview" });
      await tokenPreview.scrollIntoViewIfNeeded();
      await expect(tokenPreview.getByRole("img")).toHaveJSProperty("naturalWidth", 336);
      await info.attach("token-preview.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await expect.poll(() => npcs(player)).toEqual(await npcs(dm));
      const placement = dm.getByRole("button", { name: /place on map/i });
      await activate(placement, mobile);
      await expect
        .poll(() =>
          player.evaluate(
            () =>
              (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).filter((t) =>
                t.imageUrl?.endsWith("/Goblins/goblinClub.png"),
              ).length,
          ),
        )
        .toBe(1);
      await info.attach("player-result.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
    } finally {
      await context.close();
      await observer.close();
    }
  });
}
