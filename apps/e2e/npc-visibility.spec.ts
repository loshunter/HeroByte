/**
 * E2E tests for NPC visibility toggle feature
 *
 * Tests DM's ability to hide/reveal NPCs from players (for ambush scenarios).
 * Verifies server-side filtering ensures hidden NPCs never reach non-DM clients.
 */

import { expect, test } from "@playwright/test";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

test.describe("NPC visibility toggle", () => {
  test("DM can hide NPC from player, then reveal it", async ({ browser }) => {
    // Create two browser contexts: one for DM, one for player
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const dmPage = await dmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // DM joins as DM, player joins as player
      await joinDefaultRoomAsDM(dmPage);
      await joinDefaultRoom(playerPage);

      // Wait for player to be connected
      await playerPage.waitForFunction(() => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot && data.uid);
      });

      // DM creates an NPC
      const initialNPCCount = await dmPage.evaluate(() => {
        return window.__HERO_BYTE_E2E__?.snapshot?.characters?.length ?? 0;
      });

      await dmPage.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "create-npc",
          name: "Hidden Goblin",
          maxHp: 30,
          hp: 30,
          portrait: "",
        });
      });

      // Wait for NPC to be created and synced to both clients
      await Promise.all([
        dmPage.waitForFunction(
          (prevCount) => {
            const data = window.__HERO_BYTE_E2E__;
            return (data?.snapshot?.characters?.length ?? 0) > prevCount;
          },
          initialNPCCount,
          { timeout: 5000 },
        ),
        playerPage.waitForFunction(
          (prevCount) => {
            const data = window.__HERO_BYTE_E2E__;
            return (data?.snapshot?.characters?.length ?? 0) > prevCount;
          },
          initialNPCCount,
          { timeout: 5000 },
        ),
      ]);

      // Get NPC ID
      const npcId = await dmPage.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__;
        const npcs = data?.snapshot?.characters?.filter((c) => c.type === "npc") ?? [];
        return npcs[0]?.id ?? null;
      });

      expect(npcId).not.toBeNull();

      // Verify both DM and player can see the NPC initially
      const dmSeesNPC = await dmPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcId);

      const playerSeesNPC = await playerPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcId);

      expect(dmSeesNPC).toBe(true);
      expect(playerSeesNPC).toBe(true);

      // DM hides the NPC
      await dmPage.evaluate((id) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "toggle-npc-visibility",
          id: id!,
          visible: false,
        });
      }, npcId);

      // Wait for visibility update to sync
      await dmPage.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__;
          const npc = data?.snapshot?.characters?.find((c) => c.id === id);
          return npc?.visibleToPlayers === false;
        },
        npcId,
        { timeout: 5000 },
      );

      // Small delay to ensure player snapshot update
      await playerPage.waitForTimeout(500);

      // Verify DM still sees the NPC
      const dmStillSeesNPC = await dmPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcId);

      expect(dmStillSeesNPC).toBe(true);

      // Verify player no longer sees the NPC
      const playerNoLongerSeesNPC = await playerPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcId);

      expect(playerNoLongerSeesNPC).toBe(false);

      // DM reveals the NPC
      await dmPage.evaluate((id) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "toggle-npc-visibility",
          id: id!,
          visible: true,
        });
      }, npcId);

      // Wait for visibility update to sync
      await dmPage.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__;
          const npc = data?.snapshot?.characters?.find((c) => c.id === id);
          return npc?.visibleToPlayers === true;
        },
        npcId,
        { timeout: 5000 },
      );

      // Wait for player to receive the updated snapshot
      await playerPage.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__;
          return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
        },
        npcId,
        { timeout: 5000 },
      );

      // Verify both DM and player can see the NPC again
      const dmSeesRevealedNPC = await dmPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcId);

      const playerSeesRevealedNPC = await playerPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcId);

      expect(dmSeesRevealedNPC).toBe(true);
      expect(playerSeesRevealedNPC).toBe(true);
    } finally {
      await dmPage.close();
      await playerPage.close();
      await dmContext.close();
      await playerContext.close();
    }
  });

  test("hidden NPC token is not visible to player", async ({ browser }) => {
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const dmPage = await dmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await joinDefaultRoomAsDM(dmPage);
      await joinDefaultRoom(playerPage);

      await playerPage.waitForFunction(() => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot && data.uid);
      });

      // Create NPC with token
      await dmPage.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "create-npc",
          name: "Assassin",
          maxHp: 40,
          hp: 40,
          portrait: "",
          tokenImage: "https://example.com/assassin.png",
        });
      });

      // Wait for NPC to be created
      const npcId = await dmPage.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          const npcs = data?.snapshot?.characters?.filter((c) => c.type === "npc") ?? [];
          return npcs.length > 0 ? npcs[0]?.id : null;
        },
        { timeout: 5000 },
      );

      const npcIdValue = await npcId.jsonValue();
      expect(npcIdValue).not.toBeNull();

      // Place token for NPC
      await dmPage.evaluate((id) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "place-npc-token",
          id: id!,
        });
      }, npcIdValue);

      // Wait for token to be created and synced
      const tokenId = await dmPage.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__;
          const npc = data?.snapshot?.characters?.find((c) => c.id === id);
          return npc?.tokenId ?? null;
        },
        npcIdValue,
        { timeout: 5000 },
      );

      const tokenIdValue = await tokenId.jsonValue();
      expect(tokenIdValue).not.toBeNull();

      // Wait for player to see the token initially
      await playerPage.waitForFunction(
        (tId) => {
          const data = window.__HERO_BYTE_E2E__;
          return data?.snapshot?.tokens?.some((t) => t.id === tId) ?? false;
        },
        tokenIdValue,
        { timeout: 5000 },
      );

      // Hide the NPC
      await dmPage.evaluate((id) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "toggle-npc-visibility",
          id: id!,
          visible: false,
        });
      }, npcIdValue);

      // Wait for visibility update
      await dmPage.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__;
          const npc = data?.snapshot?.characters?.find((c) => c.id === id);
          return npc?.visibleToPlayers === false;
        },
        npcIdValue,
        { timeout: 5000 },
      );

      // Small delay for player snapshot update
      await playerPage.waitForTimeout(500);

      // Verify DM still sees the token
      const dmSeesToken = await dmPage.evaluate((tId) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.tokens?.some((t) => t.id === tId) ?? false;
      }, tokenIdValue);

      expect(dmSeesToken).toBe(true);

      // Verify player no longer sees the token
      const playerSeesToken = await playerPage.evaluate((tId) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.tokens?.some((t) => t.id === tId) ?? false;
      }, tokenIdValue);

      expect(playerSeesToken).toBe(false);
    } finally {
      await dmPage.close();
      await playerPage.close();
      await dmContext.close();
      await playerContext.close();
    }
  });

  test("player cannot toggle NPC visibility", async ({ browser }) => {
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const dmPage = await dmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await joinDefaultRoomAsDM(dmPage);
      await joinDefaultRoom(playerPage);

      await playerPage.waitForFunction(() => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot && data.uid);
      });

      // DM creates an NPC
      await dmPage.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "create-npc",
          name: "Guard",
          maxHp: 25,
          hp: 25,
          portrait: "",
        });
      });

      // Get NPC ID
      const npcId = await dmPage.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          const npcs = data?.snapshot?.characters?.filter((c) => c.type === "npc") ?? [];
          return npcs.length > 0 ? npcs[0]?.id : null;
        },
        { timeout: 5000 },
      );

      const npcIdValue = await npcId.jsonValue();
      expect(npcIdValue).not.toBeNull();

      // Wait for player to see the NPC
      await playerPage.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__;
          return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
        },
        npcIdValue,
        { timeout: 5000 },
      );

      // Player attempts to hide the NPC (should be rejected by server)
      await playerPage.evaluate((id) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "toggle-npc-visibility",
          id: id!,
          visible: false,
        });
      }, npcIdValue);

      // Wait a bit to ensure any message would have been processed
      await playerPage.waitForTimeout(1000);

      // Verify NPC visibility is still undefined (visible)
      const npcVisibility = await dmPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        const npc = data?.snapshot?.characters?.find((c) => c.id === id);
        return npc?.visibleToPlayers;
      }, npcIdValue);

      // Should still be undefined (visible) since player's request was rejected
      expect(npcVisibility).toBeUndefined();

      // Both DM and player should still see the NPC
      const dmSeesNPC = await dmPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcIdValue);

      const playerSeesNPC = await playerPage.evaluate((id) => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.characters?.some((c) => c.id === id) ?? false;
      }, npcIdValue);

      expect(dmSeesNPC).toBe(true);
      expect(playerSeesNPC).toBe(true);
    } finally {
      await dmPage.close();
      await playerPage.close();
      await dmContext.close();
      await playerContext.close();
    }
  });
});
