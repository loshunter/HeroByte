import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

// The table-level default sight radius, end to end. Three things only a real
// browser and a real second client can prove:
//
//   1. The DM's Map-tab CONTROL sends what the server expects. Every layer is
//      unit-tested on its own; nothing until here drives the actual input.
//   2. Setting a room-level value shrinks a player's SOCKET payload without
//      any token having moved — the visionSignature cache landmine.
//   3. A player who loses their only token and RECONNECTS is still clipped.
//      That is the gap S7 documented and this slice closes, and it needs a
//      real reconnect through AuthenticationHandler to exercise at all.
//
// Rails are vision-radius.smoke.spec.ts's: the DM starts a live map and
// generates real wall geometry rather than dragging the canvas.

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

/** Drive the REAL control on the Map tab — an empty value clears the default. */
async function setDefaultFromMapTab(page: Page, feet: string) {
  const heading = page.getByText("Dungeon Master Tools");
  if (!(await heading.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /DM MENU/i }).click();
    await expect(heading).toBeVisible();
  }
  await page.getByRole("button", { name: "Map Setup" }).click();
  const input = page.getByLabel("Default sight radius in feet");
  await input.fill(feet);
  await input.press("Enter");
}

function playerTokenIds(page: Page) {
  return page.evaluate(() =>
    (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).map((token) => token.id),
  );
}

test.describe("Table default sight radius", () => {
  test("darkens the table from the Map tab, and survives a player respawn", async ({ browser }) => {
    test.setTimeout(180_000);

    // Separate contexts → isolated storage → distinct session UIDs.
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const page = await dmContext.newPage();
    let player = await playerContext.newPage();

    try {
      await startLiveMap(page);
      await generate(page, "table-default-vision");
      await waitForSnap(page, () => {
        const scene = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene;
        return (scene?.walls?.length ?? 0) > 4;
      });

      await joinDefaultRoom(player);
      await waitForSnap(player, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene));

      // Park the player's token and a DM marker in the same open area, four
      // squares apart — in plain sight, but past a 10 ft radius.
      const playerUid = await player.evaluate(() => window.__HERO_BYTE_E2E__!.uid ?? "");
      const firstTokenId = await page.evaluate((uid) => {
        const tokens = window.__HERO_BYTE_E2E__!.snapshot!.tokens ?? [];
        return tokens.find((token) => token.owner === uid)?.id ?? "";
      }, playerUid);
      expect(firstTokenId).not.toBe("");

      await page.evaluate((tokenId) => {
        window.__HERO_BYTE_E2E__!.sendMessage!({ t: "move", id: tokenId, x: 8, y: 8 });
      }, firstTokenId);

      const dmTokenId = await page.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const token = (data.snapshot!.tokens ?? []).find((t) => t.owner === (data.uid ?? ""));
        if (token) data.sendMessage!({ t: "move", id: token.id, x: 12, y: 8 });
        return token?.id ?? "";
      });
      expect(dmTokenId).not.toBe("");

      await page.evaluate(() => {
        window.__HERO_BYTE_E2E__!.sendMessage!({ t: "set-fog-enabled", enabled: true });
      });
      await waitForSnap(player, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled));
      // Unlimited sight: the DM's marker is in the player's payload.
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).length >= 2,
      );

      // THE CONTROL. 10 ft = 2 squares; the marker is 4 squares away. Nothing
      // moves — only a room setting changes — so a visionSignature that
      // omitted the default would serve a stale filter and this would hang.
      await setDefaultFromMapTab(page, "10");
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).length === 1,
      );
      expect(await playerTokenIds(player)).toEqual([firstTokenId]);
      // And the player really was told the table rule, not just starved of data.
      expect(
        await player.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.defaultVisionRadius),
      ).toBe(10);

      // Clearing it gives the sight back.
      await setDefaultFromMapTab(page, "");
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).length === 2,
      );

      // THE RESPAWN GAP. Set the table dark, delete the player's only token,
      // and reconnect them: AuthenticationHandler spawns a fresh one with
      // nothing to inherit a radius from. Before this slice that token saw
      // everything, and neither the player nor the DM got any signal.
      await setDefaultFromMapTab(page, "10");
      await page.evaluate((tokenId) => {
        window.__HERO_BYTE_E2E__!.sendMessage!({ t: "delete-token", id: tokenId });
      }, firstTokenId);

      await player.close();
      player = await playerContext.newPage();
      await joinDefaultRoom(player);
      await waitForSnap(player, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene));

      const respawnedId = await player.evaluate((uid) => {
        const tokens = window.__HERO_BYTE_E2E__!.snapshot!.tokens ?? [];
        return tokens.find((token) => token.owner === uid)?.id ?? "";
      }, playerUid);
      expect(respawnedId).not.toBe("");
      expect(respawnedId).not.toBe(firstTokenId);

      // Put the new token exactly where the old one stood, so the marker is
      // once again four squares away in plain sight.
      await page.evaluate((tokenId) => {
        window.__HERO_BYTE_E2E__!.sendMessage!({ t: "move", id: tokenId, x: 8, y: 8 });
      }, respawnedId);
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).length === 1,
      );
      expect(await playerTokenIds(player)).toEqual([respawnedId]);

      // NON-VACUITY: that line of sight is genuinely open, so the marker
      // returns the moment the table default is lifted. Without this, the
      // assertion above would pass just as well if a wall were in the way.
      await setDefaultFromMapTab(page, "");
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).length === 2,
      );
    } finally {
      // Leave the shared table as it was found — the default persists.
      await page
        .evaluate(() => {
          window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "set-default-vision-radius", radius: null });
          window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "set-fog-enabled", enabled: false });
        })
        .catch(() => {});
      await playerContext.close();
      await dmContext.close();
    }
  });
});
