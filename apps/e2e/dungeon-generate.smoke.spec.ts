import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

// End-to-end lock for M4 Phase 1 (the dungeon recipe): a DM generates a stocked
// dungeon onto the live table, a player who joins afterwards receives it and can
// operate its doors, and NONE of the DM-only content — spawn keys, braziers —
// reaches their socket. Serial-safe: the shared fixture resets the room and the
// map store, so no live map exists at the start.
//
// The generate itself goes through the harness rather than a canvas drag: the
// recipe's target must be at least 8x8 cells, which at the e2e viewport is a
// larger drag than the board reliably offers. The drag → panel → GENERATE path
// is covered by useGenerate/GeneratePanel unit tests; what only an e2e can prove
// is the whole socket round-trip, which is what this drives.

const REGION = { x: 3, y: 3, cols: 24, rows: 18 };

async function waitForSnap(page: Page, predicate: () => boolean, timeout = 20_000) {
  await page.waitForFunction(predicate, undefined, { timeout });
}

async function startLiveMap(page: Page) {
  await joinDefaultRoomAsDM(page);
  await page.getByTitle("Author the live map on the table").click();
  await page.getByRole("button", { name: /START LIVE MAP/i }).click();
  await waitForSnap(page, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId));
}

async function generate(page: Page, commandId: string, secretDoorChance: number) {
  await page.evaluate(
    ([id, chance, region]) => {
      const data = window.__HERO_BYTE_E2E__!;
      data.sendMessage!({
        t: "map-studio-generate",
        documentId: data.snapshot!.liveMapDocumentId!,
        commandId: id as string,
        recipe: "dungeon",
        seed: 20260715,
        bounds: region as { x: number; y: number; cols: number; rows: number },
        params: { theme: "stone", density: "medium", secretDoorChance: chance as number },
      });
    },
    [commandId, secretDoorChance, REGION] as const,
  );
}

test.describe("Dungeon generate smoke", () => {
  test("a DM generates a dungeon; a player gets it, works its doors, and sees no secrets", async ({
    browser,
  }) => {
    test.setTimeout(90_000);

    // Separate contexts → isolated storage → distinct session UIDs. A shared
    // context collides the DM's UID and triggers a connection conflict.
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const page = await dmContext.newPage();
    const player = await playerContext.newPage();

    try {
      await startLiveMap(page);

      // The GENERATE tool is on the palette and its panel opens (the UI surface;
      // its dials and drag→cells maths are unit-tested).
      await page.getByRole("button", { name: /🏰 Gen/ }).click();
      await expect(page.getByTestId("generate-panel")).toBeVisible();
      await expect(page.getByTestId("generate-seed")).not.toBeEmpty();

      // ---- DM: generate → a whole dungeon compiles onto the table ----
      await generate(page, "e2e-gen-1", 0.15);
      await waitForSnap(page, () => {
        const scene = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene;
        return (scene?.walls?.length ?? 0) > 4 && (scene?.doors?.length ?? 0) > 0;
      });
      await waitForSnap(page, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.mapTerrain));

      // The DM's dungeon is stocked: braziers compile in, and the spawn keys
      // ride the DM-only document channel.
      const dmLights = await page.evaluate(
        () => window.__HERO_BYTE_E2E__!.snapshot!.compiledScene!.lights.length,
      );
      expect(dmLights).toBeGreaterThan(0);

      // ---- Player: joins afterwards and instantly receives the dungeon ----
      await joinDefaultRoom(player);
      await waitForSnap(player, () => {
        const scene = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene;
        return (scene?.walls?.length ?? 0) > 4 && (scene?.doors?.length ?? 0) > 0;
      });

      // ---- The secrecy contract, at the wire ----
      const leak = await player.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const raw = JSON.stringify(data.snapshot);
        return {
          keys: /SPAWN|LOOT|EMPTY|TRAP/.test(raw),
          notesLayer: raw.includes('"notes"'),
          // Nothing renders lights at the table yet, so shipping their
          // coordinates would just map the rooms fog is hiding.
          lights: data.snapshot!.compiledScene!.lights.length,
        };
      });
      expect(leak).toEqual({ keys: false, notesLayer: false, lights: 0 });

      // ---- The generated doors are real toys: the player works one ----
      const doorBefore = await player.evaluate(
        () => window.__HERO_BYTE_E2E__!.snapshot!.compiledScene!.doors[0]!.state,
      );
      await player.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        data.sendMessage!({
          t: "toggle-door",
          doorId: data.snapshot!.compiledScene!.doors[0]!.id,
        });
      });
      for (const client of [player, page]) {
        await client.waitForFunction(
          (before) => {
            const door = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.[0];
            return Boolean(door) && door!.state !== before;
          },
          doorBefore,
          { timeout: 20_000 },
        );
      }

      // ---- ONE undo removes the whole dungeon, from every screen ----
      await page.getByRole("button", { name: /↶ Undo/ }).click();
      for (const client of [page, player]) {
        await waitForSnap(client, () => {
          const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
          return (
            (snapshot?.compiledScene?.walls?.length ?? 0) === 0 && !snapshot?.mapTerrain
          );
        });
      }
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
});
