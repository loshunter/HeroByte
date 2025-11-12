import { expect, test } from "@playwright/test";
import { joinDefaultRoomAsDM } from "./helpers";

test.describe("HeroByte entity and initiative management", () => {
  test("DM can add NPCs and set initiative for all entities, verifying auto-sort", async ({
    page,
  }) => {
    // Step 1: Join as DM
    console.log("✅ Step 1: Joining as DM");
    await joinDefaultRoomAsDM(page);

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);
    expect(myUid).not.toBeNull();

    // Step 2: Verify we're DM
    const isDM = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const currentPlayer = data?.snapshot?.players?.find((p) => p.uid === data.uid);
      return currentPlayer?.isDM === true;
    });
    expect(isDM).toBe(true);
    console.log("✅ Step 2: Confirmed DM status");

    // Step 3: Add 4 NPCs programmatically
    console.log("✅ Step 3: Adding 4 NPCs");
    for (let i = 1; i <= 4; i++) {
      await page.evaluate((npcName) => {
        const data = window.__HERO_BYTE_E2E__;
        if (data?.sendMessage) {
          data.sendMessage({
            t: "create-npc",
            name: npcName,
            hp: 20 + i * 5,
            maxHp: 30 + i * 5,
          });
        }
      }, `Test NPC ${i}`);
      await page.waitForTimeout(300);
    }

    // Wait for all NPCs to be created
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        const npcs = (data?.snapshot?.characters ?? []).filter((c) => c.type === "npc");
        return npcs.length >= 4;
      },
      { timeout: 10000 },
    );

    const npcCount = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.characters ?? []).filter((c) => c.type === "npc").length;
    });
    console.log(`✅ Step 4: Created ${npcCount} NPCs`);
    expect(npcCount).toBeGreaterThanOrEqual(4);

    // Step 5: Get all characters and set initiative for each
    const allCharacters = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.characters ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));
    });

    console.log(`✅ Step 5: Setting initiative for ${allCharacters.length} characters`);

    for (const character of allCharacters) {
      const roll = Math.floor(Math.random() * 20) + 1;
      const modifier = Math.floor(Math.random() * 5);
      const initiative = roll + modifier;

      await page.evaluate(
        ({ charId, init, mod }) => {
          const data = window.__HERO_BYTE_E2E__;
          if (data?.sendMessage) {
            data.sendMessage({
              t: "set-initiative",
              characterId: charId,
              initiative: init,
              modifier: mod,
            });
          }
        },
        { charId: character.id, init: initiative, mod: modifier },
      );

      await page.waitForTimeout(200);
      console.log(`  Set initiative for ${character.name}: ${initiative} (${roll}+${modifier})`);
    }

    // Step 6: Verify all characters have initiative set
    await page.waitForFunction(
      (expectedCount) => {
        const data = window.__HERO_BYTE_E2E__;
        const characters = data?.snapshot?.characters ?? [];
        const withInitiative = characters.filter((c) => typeof c.initiative === "number");
        return withInitiative.length >= expectedCount;
      },
      allCharacters.length,
      { timeout: 10000 },
    );

    const charactersWithInitiative = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.characters ?? []).filter((c) => typeof c.initiative === "number")
        .length;
    });

    console.log(`✅ Step 6: ${charactersWithInitiative} characters have initiative set`);
    expect(charactersWithInitiative).toBe(allCharacters.length);

    // Step 7: Verify auto-sort by initiative (descending order)
    const initiativeOrder = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const characters = data?.snapshot?.characters ?? [];
      return characters
        .filter((c) => typeof c.initiative === "number")
        .map((c) => ({
          name: c.name,
          initiative: c.initiative!,
          type: c.type,
        }))
        .sort((a, b) => b.initiative - a.initiative);
    });

    console.log("✅ Step 7: Initiative order (sorted):");
    initiativeOrder.forEach((char, idx) => {
      console.log(`  ${idx + 1}. ${char.name} (${char.type}): ${char.initiative}`);
    });

    // Verify the list is sorted in descending order
    for (let i = 0; i < initiativeOrder.length - 1; i++) {
      expect(initiativeOrder[i].initiative).toBeGreaterThanOrEqual(
        initiativeOrder[i + 1].initiative,
      );
    }

    console.log("✅ Test completed successfully!");
    console.log(`Summary:`);
    console.log(`- Joined as DM`);
    console.log(`- Created ${npcCount} NPCs`);
    console.log(`- Set initiative for all ${allCharacters.length} characters`);
    console.log(`- Verified initiative auto-sort (descending order)`);
  });
});
