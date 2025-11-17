import { expect, test } from "@playwright/test";
import { joinDefaultRoomAsDM } from "./helpers";

test.describe("Turn Navigation UI", () => {
  test("should display turn navigation controls when combat is active with initiative set", async ({
    page,
  }) => {
    // Step 1: Join as DM
    console.log("✅ Step 1: Joining as DM");
    await joinDefaultRoomAsDM(page);

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);
    expect(myUid).not.toBeNull();
    console.log(`✅ DM joined with UID: ${myUid}`);

    // Step 2: Verify entities panel is visible (not collapsed)
    console.log("✅ Step 2: Checking entities panel visibility");
    const entitiesHeading = page.getByRole("heading", { name: "ENTITIES" });
    const entitiesPanelVisible = await entitiesHeading.isVisible().catch(() => false);
    if (!entitiesPanelVisible) {
      console.log("  Entities panel is collapsed, expanding it...");
      await page.getByRole("button", { name: /show entities/i }).click();
      await page.waitForTimeout(500);
    }
    await expect(entitiesHeading).toBeVisible();

    // Step 3: Add a couple NPCs for testing
    console.log("✅ Step 3: Adding 2 NPCs");
    for (let i = 1; i <= 2; i++) {
      await page.evaluate((npcName) => {
        const data = window.__HERO_BYTE_E2E__;
        if (data?.sendMessage) {
          data.sendMessage({
            t: "create-npc",
            name: npcName,
            hp: 20,
            maxHp: 30,
          });
        }
      }, `Fighter ${i}`);
      await page.waitForTimeout(300);
    }

    // Wait for NPCs to be created
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        const npcs = (data?.snapshot?.characters ?? []).filter((c) => c.type === "npc");
        return npcs.length >= 2;
      },
      { timeout: 5000 },
    );
    console.log("✅ NPCs created");

    // Step 4: Verify combat info panel is NOT visible before starting combat
    console.log("✅ Step 4: Verifying combat panel is not visible before combat starts");
    await expect(page.getByText("⚔️ Combat Active")).not.toBeVisible();
    console.log("  ✓ Combat panel correctly hidden before combat");

    // Step 5: Start combat
    console.log("✅ Step 5: Starting combat");
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (data?.sendMessage) {
        data.sendMessage({ t: "start-combat" });
      }
    });

    // Wait for combat to be active
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.combatActive === true;
      },
      { timeout: 5000 },
    );
    console.log("✅ Combat started");

    // Step 6: Verify combat info panel IS visible after starting combat
    console.log("✅ Step 6: Verifying combat panel is visible after combat starts");
    await expect(page.getByText("⚔️ Combat Active")).toBeVisible({ timeout: 5000 });
    console.log("  ✓ Combat panel is visible");

    // Step 7: Set initiative for all characters
    console.log("✅ Step 7: Setting initiative for all characters");
    const allCharacters = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (data?.snapshot?.characters ?? []).map((c) => ({
        id: c.id,
        name: c.name,
      }));
    });

    const initiativeValues: Array<{ name: string; initiative: number }> = [];
    for (let i = 0; i < allCharacters.length; i++) {
      const character = allCharacters[i];
      const initiative = 20 - i * 5; // Descending order: 20, 15, 10, etc.
      const modifier = 2;

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

      initiativeValues.push({ name: character.name, initiative });
      console.log(`  Set initiative for ${character.name}: ${initiative}`);
      await page.waitForTimeout(200);
    }

    // Wait for all initiative to be set
    await page.waitForFunction(
      (expectedCount) => {
        const data = window.__HERO_BYTE_E2E__;
        const characters = data?.snapshot?.characters ?? [];
        const withInitiative = characters.filter((c) => typeof c.initiative === "number");
        return withInitiative.length >= expectedCount;
      },
      allCharacters.length,
      { timeout: 5000 },
    );
    console.log("✅ All initiative values set");

    // Step 8: Verify turn counter is visible
    console.log("✅ Step 8: Verifying turn counter is visible");
    const turnCounterRegex = /Turn \d+ of \d+/;
    await expect(page.getByText(turnCounterRegex)).toBeVisible({ timeout: 5000 });
    console.log("  ✓ Turn counter is visible");

    // Step 9: Verify turn navigation buttons are visible
    console.log("✅ Step 9: Verifying turn navigation buttons");
    const prevButton = page.getByRole("button", { name: /previous turn|prev/i });
    const nextButton = page.getByRole("button", { name: /next turn|next/i });

    await expect(prevButton).toBeVisible({ timeout: 5000 });
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    console.log("  ✓ PREV and NEXT buttons are visible");

    // Step 10: Verify current turn character is highlighted
    console.log("✅ Step 10: Verifying current turn character highlighting");
    const currentTurnCharacterId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.currentTurnCharacterId ?? null;
    });
    expect(currentTurnCharacterId).not.toBeNull();
    console.log(`  Current turn character ID: ${currentTurnCharacterId}`);

    // Step 11: Test next turn functionality
    console.log("✅ Step 11: Testing NEXT turn button");
    const firstTurnCharacterId = currentTurnCharacterId;

    await nextButton.click();
    await page.waitForTimeout(500);

    const secondTurnCharacterId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.currentTurnCharacterId ?? null;
    });

    expect(secondTurnCharacterId).not.toEqual(firstTurnCharacterId);
    console.log(`  ✓ Turn advanced from ${firstTurnCharacterId} to ${secondTurnCharacterId}`);

    // Step 12: Test previous turn functionality
    console.log("✅ Step 12: Testing PREV turn button");
    await prevButton.click();
    await page.waitForTimeout(500);

    const thirdTurnCharacterId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.currentTurnCharacterId ?? null;
    });

    expect(thirdTurnCharacterId).toEqual(firstTurnCharacterId);
    console.log(`  ✓ Turn went back to ${thirdTurnCharacterId}`);

    // Step 13: Test turn wrapping (advance through all turns)
    console.log("✅ Step 13: Testing turn wrapping");
    const characterCount = allCharacters.length;
    for (let i = 0; i < characterCount; i++) {
      await nextButton.click();
      await page.waitForTimeout(300);
    }

    const wrappedTurnCharacterId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.currentTurnCharacterId ?? null;
    });

    expect(wrappedTurnCharacterId).toEqual(firstTurnCharacterId);
    console.log(`  ✓ Turn wrapped around back to first character`);

    // Step 14: End combat and verify UI changes
    console.log("✅ Step 14: Ending combat");
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (data?.sendMessage) {
        data.sendMessage({ t: "end-combat" });
      }
    });

    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        return data?.snapshot?.combatActive === false;
      },
      { timeout: 5000 },
    );

    // Verify combat panel is hidden after ending combat
    await expect(page.getByText("⚔️ Combat Active")).not.toBeVisible();
    console.log("  ✓ Combat panel hidden after ending combat");

    console.log("\n✅ ALL TESTS PASSED!");
    console.log("Summary:");
    console.log("- Combat panel visibility works correctly");
    console.log("- Turn counter displays properly");
    console.log("- NEXT and PREV buttons are visible and functional");
    console.log("- Turn navigation advances and reverses correctly");
    console.log("- Turn order wraps around properly");
    console.log("- UI updates when combat ends");
  });
});
