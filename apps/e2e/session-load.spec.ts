import { expect, test } from "@playwright/test";
import { joinDefaultRoomAsDM } from "./helpers";
import type { RoomSnapshot } from "@shared";

test.describe("HeroByte session load", () => {
  test("can load a session snapshot with tokens, characters, and scene objects", async ({
    page,
  }) => {
    await joinDefaultRoomAsDM(page);

    // Create a sample session snapshot
    const sampleSnapshot: RoomSnapshot = {
      users: ["player-1", "player-2"],
      tokens: [
        {
          id: "token-1",
          x: 5,
          y: 5,
          owner: "player-1",
          color: "hsl(120, 70%, 50%)",
          imageUrl: undefined,
        },
        {
          id: "token-2",
          x: 8,
          y: 8,
          owner: "player-2",
          color: "hsl(240, 70%, 50%)",
          imageUrl: undefined,
        },
      ],
      players: [
        {
          uid: "player-1",
          name: "Hero",
          hp: 80,
          maxHp: 100,
          isDM: false,
        },
        {
          uid: "player-2",
          name: "Wizard",
          hp: 45,
          maxHp: 60,
          isDM: false,
        },
      ],
      characters: [
        {
          id: "char-1",
          name: "Gandalf",
          type: "pc",
          ownedByPlayerUID: "player-2",
          hp: 45,
          maxHp: 60,
        },
        {
          id: "char-2",
          name: "Goblin",
          type: "npc",
          ownedByPlayerUID: "dm-1",
          hp: 15,
          maxHp: 20,
        },
      ],
      props: [
        {
          id: "prop-1",
          label: "Treasure Chest",
          imageUrl:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23cd853f' width='100' height='100'/%3E%3C/svg%3E",
          owner: null,
          size: "large",
          x: 12,
          y: 15,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
        {
          id: "prop-2",
          label: "Barrel",
          imageUrl:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle fill='%238b4513' cx='50' cy='50' r='40'/%3E%3C/svg%3E",
          owner: "player-1",
          size: "medium",
          x: 20,
          y: 18,
          scaleX: 1.2,
          scaleY: 0.9,
          rotation: 45,
        },
      ],
      drawings: [
        {
          id: "drawing-1",
          type: "freehand",
          points: [
            { x: 100, y: 100 },
            { x: 150, y: 120 },
            { x: 200, y: 100 },
          ],
          color: "#ff0000",
          width: 2,
          opacity: 1,
          owner: "player-1",
        },
        {
          id: "drawing-2",
          type: "rect",
          points: [
            { x: 300, y: 300 },
            { x: 400, y: 400 },
          ],
          color: "#00ff00",
          width: 3,
          opacity: 0.8,
          filled: true,
          owner: "player-1",
        },
      ],
      sceneObjects: [
        {
          id: "scene-token-1",
          type: "token",
          sourceId: "token-1",
          transform: {
            x: 250,
            y: 250,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          locked: false,
          owner: "player-1",
        },
        {
          id: "scene-drawing-1",
          type: "drawing",
          sourceId: "drawing-1",
          transform: {
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          locked: false,
          owner: "player-1",
        },
        {
          id: "scene-prop-1",
          type: "prop",
          sourceId: "prop-1",
          transform: {
            x: 600,
            y: 750,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          locked: false,
          owner: null,
        },
        {
          id: "scene-prop-2",
          type: "prop",
          sourceId: "prop-2",
          transform: {
            x: 1000,
            y: 900,
            rotation: 45,
            scaleX: 1.2,
            scaleY: 0.9,
          },
          locked: false,
          owner: "player-1",
        },
      ],
      pointers: [],
      diceRolls: [
        {
          id: "roll-1",
          playerUid: "player-1",
          playerName: "Hero",
          timestamp: Date.now(),
          formula: "1d20+5",
          results: [15],
          total: 20,
        },
      ],
      gridSize: 50,
      gridSquareSize: 5,
      mapBackground: undefined,
    };

    // Load the session via the __HERO_BYTE_E2E__ interface
    const loadSuccess = await page.evaluate((snapshot) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return false;

      data.sendMessage({
        t: "load-session",
        snapshot,
      });
      return true;
    }, sampleSnapshot);

    expect(loadSuccess).toBe(true);

    // Wait for the session to load
    await page.waitForTimeout(1000);

    // Verify tokens were loaded
    const tokensLoaded = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const tokens = data?.snapshot?.tokens ?? [];
      return {
        count: tokens.length,
        token1: tokens.find((t) => t.id === "token-1"),
        token2: tokens.find((t) => t.id === "token-2"),
      };
    });

    expect(tokensLoaded.count).toBeGreaterThanOrEqual(2);
    expect(tokensLoaded.token1).toBeTruthy();
    expect(tokensLoaded.token1?.x).toBe(5);
    expect(tokensLoaded.token1?.y).toBe(5);
    expect(tokensLoaded.token2).toBeTruthy();

    // Verify characters were loaded
    const charactersLoaded = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const characters = data?.snapshot?.characters ?? [];
      return {
        count: characters.length,
        gandalf: characters.find((c) => c.name === "Gandalf"),
        goblin: characters.find((c) => c.name === "Goblin"),
      };
    });

    expect(charactersLoaded.count).toBeGreaterThanOrEqual(2);
    expect(charactersLoaded.gandalf).toBeTruthy();
    expect(charactersLoaded.gandalf?.hp).toBe(45);
    expect(charactersLoaded.gandalf?.maxHp).toBe(60);
    expect(charactersLoaded.goblin).toBeTruthy();
    expect(charactersLoaded.goblin?.type).toBe("npc");

    // Verify props were loaded
    const propsLoaded = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const props = data?.snapshot?.props ?? [];
      return {
        count: props.length,
        chest: props.find((p) => p.id === "prop-1"),
        barrel: props.find((p) => p.id === "prop-2"),
      };
    });

    expect(propsLoaded.count).toBeGreaterThanOrEqual(2);
    expect(propsLoaded.chest).toBeTruthy();
    expect(propsLoaded.chest?.label).toBe("Treasure Chest");
    expect(propsLoaded.chest?.x).toBe(12);
    expect(propsLoaded.chest?.y).toBe(15);
    expect(propsLoaded.chest?.size).toBe("large");
    expect(propsLoaded.barrel).toBeTruthy();
    expect(propsLoaded.barrel?.label).toBe("Barrel");
    expect(propsLoaded.barrel?.rotation).toBe(45);

    // Verify drawings were loaded
    const drawingsLoaded = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const drawings = data?.snapshot?.drawings ?? [];
      return {
        count: drawings.length,
        drawing1: drawings.find((d) => d.id === "drawing-1"),
        drawing2: drawings.find((d) => d.id === "drawing-2"),
      };
    });

    expect(drawingsLoaded.count).toBeGreaterThanOrEqual(2);
    expect(drawingsLoaded.drawing1).toBeTruthy();
    expect(drawingsLoaded.drawing1?.type).toBe("freehand");
    expect(drawingsLoaded.drawing1?.points?.length).toBe(3);
    expect(drawingsLoaded.drawing2).toBeTruthy();
    expect(drawingsLoaded.drawing2?.type).toBe("rect");

    // Verify scene objects were loaded
    const sceneObjectsLoaded = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const sceneObjects = data?.snapshot?.sceneObjects ?? [];
      return {
        count: sceneObjects.length,
        tokenScene: sceneObjects.find((s) => s.type === "token"),
        drawingScene: sceneObjects.find((s) => s.type === "drawing"),
      };
    });

    expect(sceneObjectsLoaded.count).toBeGreaterThanOrEqual(2);
    expect(sceneObjectsLoaded.tokenScene).toBeTruthy();
    expect(sceneObjectsLoaded.tokenScene?.sourceId).toBe("token-1");
    expect(sceneObjectsLoaded.drawingScene).toBeTruthy();

    // Verify dice rolls were loaded
    const diceRollsLoaded = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const diceRolls = data?.snapshot?.diceRolls ?? [];
      return {
        count: diceRolls.length,
        firstRoll: diceRolls.find((r) => r.id === "roll-1"),
      };
    });

    expect(diceRollsLoaded.count).toBeGreaterThanOrEqual(1);
    expect(diceRollsLoaded.firstRoll).toBeTruthy();
    expect(diceRollsLoaded.firstRoll?.formula).toBe("1d20+5");
    expect(diceRollsLoaded.firstRoll?.total).toBe(20);

    // Verify grid settings were loaded
    const gridSettings = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return {
        gridSize: data?.snapshot?.gridSize,
        gridSquareSize: data?.snapshot?.gridSquareSize,
      };
    });

    expect(gridSettings.gridSize).toBe(50);
    expect(gridSettings.gridSquareSize).toBe(5);
  });

  test("loads session and preserves current player connections", async ({ page }) => {
    await joinDefaultRoomAsDM(page);

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);
    expect(myUid).not.toBeNull();

    // Create a snapshot without the current player
    const sampleSnapshot: RoomSnapshot = {
      users: ["other-player"],
      tokens: [],
      players: [
        {
          uid: "other-player",
          name: "Other Player",
          hp: 100,
          maxHp: 100,
        },
      ],
      characters: [],
      props: [],
      drawings: [],
      sceneObjects: [],
      pointers: [],
      diceRolls: [],
      gridSize: 50,
    };

    // Load the session
    await page.evaluate((snapshot) => {
      const data = window.__HERO_BYTE_E2E__;
      if (data?.sendMessage) {
        data.sendMessage({
          t: "load-session",
          snapshot,
        });
      }
    }, sampleSnapshot);

    await page.waitForTimeout(1000);

    // Verify current player is still in the players list
    const currentPlayerStillExists = await page.evaluate((uid) => {
      const data = window.__HERO_BYTE_E2E__;
      const players = data?.snapshot?.players ?? [];
      return players.some((p) => p.uid === uid);
    }, myUid);

    expect(currentPlayerStillExists).toBe(true);
  });

  test("handles session load with missing optional fields gracefully", async ({ page }) => {
    await joinDefaultRoomAsDM(page);

    // Minimal snapshot with only required fields
    const minimalSnapshot: Partial<RoomSnapshot> = {
      tokens: [],
      players: [],
      characters: [],
      drawings: [],
      gridSize: 50,
      pointers: [],
      diceRolls: [],
      users: [],
    };

    const loadSuccess = await page.evaluate((snapshot) => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return false;

      try {
        data.sendMessage({
          t: "load-session",
          snapshot: snapshot as RoomSnapshot,
        });
        return true;
      } catch (e) {
        console.error("Load failed:", e);
        return false;
      }
    }, minimalSnapshot);

    expect(loadSuccess).toBe(true);

    await page.waitForTimeout(500);

    // Verify no crash and basic arrays exist
    const snapshotValid = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return {
        hasTokens: Array.isArray(data?.snapshot?.tokens),
        hasPlayers: Array.isArray(data?.snapshot?.players),
        hasDrawings: Array.isArray(data?.snapshot?.drawings),
        gridSize: data?.snapshot?.gridSize,
      };
    });

    expect(snapshotValid.hasTokens).toBe(true);
    expect(snapshotValid.hasPlayers).toBe(true);
    expect(snapshotValid.hasDrawings).toBe(true);
    expect(snapshotValid.gridSize).toBe(50);
  });
});
