import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

// S7 end-to-end. Two things only a real browser can prove:
//
//   1. A sight RADIUS shrinks what a player's SOCKET receives, not merely what
//      their screen draws. The unit tests assert this against the room service;
//      this drives it through a real WebSocket to a real second client.
//   2. EXPLORED FOG actually accumulates. Its whole implementation is a 2D
//      canvas context, and jsdom has none — `getContext("2d")` returns null
//      there, so every unit test of it runs against a stub. Until this ran in
//      Chromium, nothing had executed the real rasterisation even once.
//
// Uses the same rails as dungeon-generate.smoke.spec.ts: the DM starts a live
// map and generates real wall geometry rather than dragging the canvas.

const REGION = { x: 3, y: 3, cols: 24, rows: 20 };

async function waitForSnap(page: Page, predicate: () => boolean, timeout = 20_000) {
  await page.waitForFunction(predicate, undefined, { timeout });
}

async function startLiveMap(page: Page) {
  await joinDefaultRoomAsDM(page);
  await page.getByTitle("Author the live map on the table").click();
  await page.getByRole("button", { name: /START LIVE MAP/i }).click();
  await waitForSnap(page, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId));
}

async function generate(page: Page, commandId: string) {
  await page.evaluate(
    ([id, region]) => {
      const data = window.__HERO_BYTE_E2E__!;
      data.sendMessage!({
        t: "map-studio-generate",
        documentId: data.snapshot!.liveMapDocumentId!,
        commandId: id as string,
        recipe: "dungeon",
        seed: 20260715,
        bounds: region as { x: number; y: number; cols: number; rows: number },
        params: { theme: "stone", density: "medium" },
      });
    },
    [commandId, REGION] as const,
  );
}

test.describe("Vision radius and explored fog (S7)", () => {
  test("a radius shrinks the player's payload, and what they saw is remembered", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    // Separate contexts → isolated storage → distinct session UIDs, AND
    // isolated localStorage, which explored fog depends on.
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const page = await dmContext.newPage();
    const player = await playerContext.newPage();

    try {
      await startLiveMap(page);
      await generate(page, "s7-vision-radius");
      await waitForSnap(page, () => {
        const scene = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene;
        return (scene?.walls?.length ?? 0) > 4;
      });

      await joinDefaultRoom(player);
      await waitForSnap(player, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene));

      // Park the player's token and a DM marker in the same open area, far
      // enough apart that a 10 ft radius cannot reach.
      const playerUid = await player.evaluate(() => window.__HERO_BYTE_E2E__!.uid ?? "");
      const playerTokenId = await page.evaluate((uid) => {
        const tokens = window.__HERO_BYTE_E2E__!.snapshot!.tokens ?? [];
        return tokens.find((token) => token.owner === uid)?.id ?? "";
      }, playerUid);
      expect(playerTokenId).not.toBe("");

      await page.evaluate((tokenId) => {
        window.__HERO_BYTE_E2E__!.sendMessage!({ t: "move", id: tokenId, x: 8, y: 8 });
      }, playerTokenId);

      const dmTokenId = await page.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const uid = data.uid ?? "";
        const token = (data.snapshot!.tokens ?? []).find((t) => t.owner === uid);
        if (token) data.sendMessage!({ t: "move", id: token.id, x: 12, y: 8 });
        return token?.id ?? "";
      });
      expect(dmTokenId).not.toBe("");

      // Fog on. The player can still see the DM's token four squares away.
      await page.evaluate(() => {
        window.__HERO_BYTE_E2E__!.sendMessage!({ t: "set-fog-enabled", enabled: true });
      });
      await waitForSnap(player, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled));
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).length >= 2,
        20_000,
      );

      // 10 ft = 2 squares at the default grid. The DM's token is 4 squares
      // away, so it must leave the player's payload entirely.
      await page.evaluate((tokenId) => {
        window.__HERO_BYTE_E2E__!.sendMessage!({
          t: "set-token-vision-radius",
          tokenId,
          radius: 10,
        });
      }, playerTokenId);

      await waitForSnap(
        player,
        () => {
          const tokens = window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? [];
          return tokens.length === 1;
        },
        20_000,
      );

      const remaining = await player.evaluate(() =>
        (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).map((t) => t.id),
      );
      expect(remaining).toEqual([playerTokenId]);

      // Widening it brings the token back — proving the vision cache is not
      // serving a stale polygon.
      await page.evaluate((tokenId) => {
        window.__HERO_BYTE_E2E__!.sendMessage!({
          t: "set-token-vision-radius",
          tokenId,
          radius: 200,
        });
      }, playerTokenId);
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).length === 2,
        20_000,
      );

      // EXPLORED FOG. The canvas rasterisation only exists in a real browser.
      // Wait past the store's debounce, then read the mask back out.
      const explored = await player.evaluate(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // The store's own LRU index is "…:v1:index", which matches that prefix
        // too, and localStorage does NOT enumerate in insertion order.
        const key = Object.keys(localStorage).find(
          (k) =>
            k.startsWith("herobyte:fog-explored:v1:") && k !== "herobyte:fog-explored:v1:index",
        );
        if (!key) return { key: null as string | null, exploredCells: 0, totalCells: 0 };
        const record = JSON.parse(localStorage.getItem(key)!) as {
          cols: number;
          rows: number;
          bits: string;
        };
        const binary = atob(record.bits);
        let exploredCells = 0;
        for (let index = 0; index < record.cols * record.rows; index += 1) {
          if ((binary.charCodeAt(index >> 3) >> (index & 7)) & 1) exploredCells += 1;
        }
        return { key, exploredCells, totalCells: record.cols * record.rows };
      });

      expect(explored.key).not.toBeNull();
      // Something was remembered...
      expect(explored.exploredCells).toBeGreaterThan(0);
      // ...but not the whole map, or "explored" would mean nothing.
      expect(explored.exploredCells).toBeLessThan(explored.totalCells);

      // The memory is the PLAYER's. The DM's own key is a different key, so a
      // DM watching through the lens can never write into it.
      expect(explored.key).toContain(playerUid);
    } finally {
      await playerContext.close();
      await dmContext.close();
    }
  });
});
