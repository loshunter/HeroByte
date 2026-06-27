import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

const SESSION_NAMES = ["DM Session", "Aria", "Borin", "Cira"] as const;
const CHARACTER_NAMES = ["DM Guide", "Aria Swift", "Borin Stone", "Cira Vale"] as const;
const MAP_DATA =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#1f2937"/><path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="#94a3b8" stroke-width="2"/></svg>',
  ).toString("base64");

type Session = {
  context: BrowserContext;
  page: Page;
  uid: string;
};

async function waitForSnapshot(page: Page) {
  await page.waitForFunction(
    () => Boolean(window.__HERO_BYTE_E2E__?.snapshot && window.__HERO_BYTE_E2E__?.uid),
    undefined,
    { timeout: 15_000 },
  );
}

async function send(page: Page, message: Record<string, unknown>) {
  await page.evaluate((payload) => window.__HERO_BYTE_E2E__?.sendMessage?.(payload), message);
}

test.describe("four-session split-screen synchronization", () => {
  test("DM and three players converge after rename, move, map transform, and grid alignment", async ({
    browser,
  }) => {
    test.setTimeout(75_000);

    const contexts: BrowserContext[] = [];
    const pageErrors: string[] = [];

    try {
      const sessions: Session[] = await Promise.all(
        Array.from({ length: 4 }, async () => {
          const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
          contexts.push(context);
          const page = await context.newPage();
          page.on("pageerror", (error) => pageErrors.push(error.message));
          await joinDefaultRoom(page);
          await waitForSnapshot(page);
          const uid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? "");
          return { context, page, uid };
        }),
      );

      const pages = sessions.map((session) => session.page);
      const uids = sessions.map((session) => session.uid);
      expect(new Set(uids).size).toBe(4);

      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(() => {
            const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
            return (snapshot?.players?.length ?? 0) === 4 && (snapshot?.tokens?.length ?? 0) === 4;
          }),
        ),
      );

      await send(pages[0], { t: "elevate-to-dm", dmPassword: "FunDM" });
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction((dmUid) => {
            const players = window.__HERO_BYTE_E2E__?.snapshot?.players ?? [];
            return players.find((player) => player.uid === dmUid)?.isDM === true;
          }, uids[0]),
        ),
      );

      const renameStartedAt = Date.now();
      await Promise.all(
        pages.map((page, index) => send(page, { t: "rename", name: SESSION_NAMES[index] })),
      );

      const ownedCharacterIds = await Promise.all(
        pages.map((page, index) =>
          page.evaluate((uid) => {
            const characters = window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [];
            return characters.find((character) => character.ownedByPlayerUID === uid)?.id ?? "";
          }, uids[index]),
        ),
      );
      expect(ownedCharacterIds.every(Boolean)).toBe(true);

      await Promise.all(
        pages.map((page, index) =>
          send(page, {
            t: "update-character-name",
            characterId: ownedCharacterIds[index],
            name: CHARACTER_NAMES[index],
          }),
        ),
      );

      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(
            ({ expectedPlayers, expectedCharacters }) => {
              const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
              const playerNames = new Set((snapshot?.players ?? []).map((player) => player.name));
              const characterNames = new Set(
                (snapshot?.characters ?? []).map((character) => character.name),
              );
              return (
                expectedPlayers.every((name) => playerNames.has(name)) &&
                expectedCharacters.every((name) => characterNames.has(name))
              );
            },
            { expectedPlayers: SESSION_NAMES, expectedCharacters: CHARACTER_NAMES },
          ),
        ),
      );
      const renameConvergenceMs = Date.now() - renameStartedAt;

      await send(pages[0], { t: "map-background", data: MAP_DATA });
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction((expected) => {
            const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
            return (
              snapshot?.mapBackground === expected &&
              snapshot.sceneObjects?.some((object) => object.id === "map" && object.type === "map")
            );
          }, MAP_DATA),
        ),
      );

      const initialMapTransform = { x: 37, y: 23, scale: { x: 0.85, y: 0.85 }, rotation: 7 };
      await send(pages[0], {
        t: "transform-object",
        id: "map",
        position: { x: initialMapTransform.x, y: initialMapTransform.y },
        scale: initialMapTransform.scale,
        rotation: initialMapTransform.rotation,
        locked: false,
      });

      await send(pages[0], { t: "grid-size", size: 64 });

      // This is the transform produced by matching a 50px source square to a 64px table square.
      const alignedMap = { x: 128, y: 64, scaleX: 1.28, scaleY: 1.28, rotation: 0 };
      const alignmentStartedAt = Date.now();
      await send(pages[0], {
        t: "transform-object",
        id: "map",
        position: { x: alignedMap.x, y: alignedMap.y },
        scale: { x: alignedMap.scaleX, y: alignedMap.scaleY },
        rotation: alignedMap.rotation,
      });

      await Promise.all(
        pages.map((page) =>
          page.waitForFunction((expected) => {
            const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
            const map = snapshot?.sceneObjects?.find((object) => object.id === "map");
            return (
              snapshot?.gridSize === 64 &&
              map?.transform.x === expected.x &&
              map.transform.y === expected.y &&
              map.transform.scaleX === expected.scaleX &&
              map.transform.scaleY === expected.scaleY &&
              map.transform.rotation === expected.rotation
            );
          }, alignedMap),
        ),
      );
      const alignmentConvergenceMs = Date.now() - alignmentStartedAt;

      const tokenTargets = [
        { x: 2, y: 2 },
        { x: 4, y: 3 },
        { x: 6, y: 4 },
        { x: 8, y: 5 },
      ];
      const tokenIds = await Promise.all(
        pages.map((page, index) =>
          page.evaluate((uid) => {
            const tokens = window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? [];
            return tokens.find((token) => token.owner === uid)?.id ?? "";
          }, uids[index]),
        ),
      );
      expect(tokenIds.every(Boolean)).toBe(true);

      const moveStartedAt = Date.now();
      await Promise.all(
        pages.map((page, index) =>
          send(page, {
            t: "move",
            id: tokenIds[index],
            x: tokenTargets[index].x,
            y: tokenTargets[index].y,
          }),
        ),
      );

      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(
            ({ ids, targets }) => {
              const tokens = window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? [];
              return ids.every((id, index) => {
                const token = tokens.find((candidate) => candidate.id === id);
                return token?.x === targets[index].x && token?.y === targets[index].y;
              });
            },
            { ids: tokenIds, targets: tokenTargets },
          ),
        ),
      );
      const moveConvergenceMs = Date.now() - moveStartedAt;

      const reconnectUid = sessions[3].uid;
      await pages[3].reload();
      await waitForSnapshot(pages[3]);
      await pages[3].waitForFunction(
        ({ uid, expectedName }) => {
          const data = window.__HERO_BYTE_E2E__;
          return (
            data?.uid === uid &&
            data.snapshot?.players?.find((player) => player.uid === uid)?.name === expectedName &&
            data.snapshot?.sceneObjects?.find((object) => object.id === "map")?.transform.scaleX ===
              1.28
          );
        },
        { uid: reconnectUid, expectedName: SESSION_NAMES[3] },
      );

      const projections = await Promise.all(
        pages.map((page) =>
          page.evaluate(() => {
            const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
            const map = snapshot?.sceneObjects?.find((object) => object.id === "map");
            return {
              players: (snapshot?.players ?? [])
                .map(({ uid, name, isDM }) => ({ uid, name, isDM: Boolean(isDM) }))
                .sort((a, b) => a.uid.localeCompare(b.uid)),
              characters: (snapshot?.characters ?? [])
                .map(({ id, name, ownedByPlayerUID }) => ({ id, name, ownedByPlayerUID }))
                .sort((a, b) => a.id.localeCompare(b.id)),
              tokens: (snapshot?.tokens ?? [])
                .map(({ id, owner, x, y }) => ({ id, owner, x, y }))
                .sort((a, b) => a.id.localeCompare(b.id)),
              gridSize: snapshot?.gridSize,
              mapTransform: map?.transform,
            };
          }),
        ),
      );

      expect(projections[1]).toEqual(projections[0]);
      expect(projections[2]).toEqual(projections[0]);
      expect(projections[3]).toEqual(projections[0]);
      expect(renameConvergenceMs).toBeLessThan(3_000);
      expect(alignmentConvergenceMs).toBeLessThan(3_000);
      expect(moveConvergenceMs).toBeLessThan(3_000);
      expect(pageErrors).toEqual([]);

      console.log(
        `[four-session-sync] rename=${renameConvergenceMs}ms alignment=${alignmentConvergenceMs}ms move=${moveConvergenceMs}ms`,
      );

      test.info().annotations.push({
        type: "sync-latency",
        description: `rename=${renameConvergenceMs}ms alignment=${alignmentConvergenceMs}ms move=${moveConvergenceMs}ms`,
      });
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
