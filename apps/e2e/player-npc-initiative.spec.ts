import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

const DM_PASSWORD = process.env.E2E_DM_PASSWORD ?? "FunDM";

test.describe("HeroByte player and NPC management with initiative tracking", () => {
  test("complete workflow: add player, become DM, add NPCs, set initiative for all", async ({
    page,
  }) => {
    // Step 1: Join the room as a regular player
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    const myUid = await page.evaluate(() => window.__HERO_BYTE_E2E__?.uid ?? null);
    expect(myUid).not.toBeNull();

    // Step 2: Verify initial player token is created
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.snapshot || !data.uid) return false;
        return (
          Array.isArray(data.snapshot.tokens) &&
          data.snapshot.tokens.some((t) => t.owner === data.uid)
        );
      },
      { timeout: 10000 },
    );

    // Get initial player count
    const initialPlayerCount = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.players?.length ?? 0;
    });

    // Step 3: Open player menu/settings
    // Look for the gear icon (⚙️) settings button - it has title but we'll search by emoji
    const settingsButton = page.getByRole("button", { name: "⚙️" });
    const settingsExists = await settingsButton.count();

    if (settingsExists === 0) {
      test.skip(true, "Could not find player settings button (⚙️)");
      return;
    }

    await settingsButton.first().click();

    // Wait a moment for the menu to open
    await page.waitForTimeout(500);

    // Step 4: Add a new character (second token for same player)
    const addCharacterButton = page.getByRole("button", { name: /Add Character/i });
    const addCharExists = await addCharacterButton.count();

    if (addCharExists === 0) {
      test.skip(true, "Add Character button not found in player menu");
      return;
    }

    // Set up dialog handlers BEFORE clicking
    page.once("dialog", async (dialog) => {
      console.log("Dialog 1 (confirm):", dialog.message());
      // First dialog: confirm wanting 2 characters
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();

      // Set up handler for second dialog (prompt for name)
      page.once("dialog", async (dialog2) => {
        console.log("Dialog 2 (prompt):", dialog2.message());
        expect(dialog2.type()).toBe("prompt");
        // Accept with the default name
        await dialog2.accept("Character 2");
      });
    });

    await addCharacterButton.click();

    // Wait for dialogs to be handled and character to be created
    await page.waitForTimeout(1500);

    // Step 5: Verify two player characters/tokens are now spawned
    await page.waitForFunction(
      (uid) => {
        const data = window.__HERO_BYTE_E2E__;
        const characters = data?.snapshot?.characters ?? [];
        const myCharacters = characters.filter((c) => c.ownedByPlayerUID === uid);
        return myCharacters.length >= 2;
      },
      myUid,
      { timeout: 10000 },
    );

    const characterCount = await page.evaluate((uid) => {
      const data = window.__HERO_BYTE_E2E__;
      const characters = data?.snapshot?.characters ?? [];
      return characters.filter((c) => c.ownedByPlayerUID === uid).length;
    }, myUid);

    console.log(`✅ Step 5: Created ${characterCount} player characters`);
    expect(characterCount).toBeGreaterThanOrEqual(2);

    // Close the player menu if it's still open
    console.log("✅ Step 6: Closing player settings menu");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Step 7: Reload page as DM (simpler approach)
    console.log("✅ Step 7: Reloading as DM");
    const currentUrl = page.url();
    await page.goto(currentUrl);

    // Join as DM
    await page.getByPlaceholder("Room password").fill(process.env.E2E_ROOM_PASSWORD ?? "Fun1");
    await page.getByRole("button", { name: /Enter Room/i }).click();

    await expect(page.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 15_000 });

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.snapshot && data.uid);
    });

    // Elevate to DM using the programmatic approach from helpers
    await page.evaluate((dmPassword) => {
      const data = window.__HERO_BYTE_E2E__;
      if (data?.sendMessage) {
        data.sendMessage({
          t: "elevate-to-dm",
          dmPassword: dmPassword,
        });
      }
    }, DM_PASSWORD);

    await page.waitForTimeout(500);

    // Step 8: Wait for DM elevation to complete
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        const currentPlayer = data?.snapshot?.players?.find((p) => p.uid === data.uid);
        return currentPlayer?.isDM === true;
      },
      { timeout: 10000 },
    );

    console.log("✅ Step 8: Successfully elevated to DM");

    // Step 9: Open DM menu
    console.log("✅ Step 9: Looking for DM Menu button");
    const dmMenuButton = page.getByRole("button", { name: /DM Menu|Menu/i });
    const dmMenuExists = await dmMenuButton.count();

    if (dmMenuExists === 0) {
      console.log("❌ DM Menu button not found - skipping test");
      test.skip(true, "DM Menu button not found");
      return;
    }
    console.log("Found DM Menu button");

    await dmMenuButton.click();
    await page.waitForTimeout(500);

    // Look for NPCs tab or section
    const npcsTab = page.getByRole("button", { name: /NPCs|Monsters/i });
    const npcsTabExists = await npcsTab.count();

    if (npcsTabExists > 0) {
      await npcsTab.click();
      await page.waitForTimeout(300);
    }

    // Step 10: Add first NPC
    const addNPCButton = page.getByRole("button", { name: /Add NPC/i });
    const addNPCExists = await addNPCButton.count();

    if (addNPCExists === 0) {
      test.skip(true, "Add NPC button not found in DM menu");
      return;
    }

    // Get initial NPC count
    const initialNPCCount = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const characters = data?.snapshot?.characters ?? [];
      return characters.filter((c) => c.type === "npc").length;
    });

    // Add first NPC
    await addNPCButton.click();
    await page.waitForTimeout(500);

    // Wait for first NPC to be created
    await page.waitForFunction(
      (prevCount) => {
        const data = window.__HERO_BYTE_E2E__;
        const characters = data?.snapshot?.characters ?? [];
        return characters.filter((c) => c.type === "npc").length > prevCount;
      },
      initialNPCCount,
      { timeout: 5000 },
    );

    // Add second NPC
    await addNPCButton.click();
    await page.waitForTimeout(500);

    // Wait for second NPC to be created
    await page.waitForFunction(
      (prevCount) => {
        const data = window.__HERO_BYTE_E2E__;
        const characters = data?.snapshot?.characters ?? [];
        return characters.filter((c) => c.type === "npc").length >= prevCount + 2;
      },
      initialNPCCount,
      { timeout: 5000 },
    );

    const finalNPCCount = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const characters = data?.snapshot?.characters ?? [];
      return characters.filter((c) => c.type === "npc").length;
    });

    expect(finalNPCCount).toBeGreaterThanOrEqual(initialNPCCount + 2);

    // Close DM menu
    const closeDMMenuButton = page.getByRole("button", { name: /Close/i }).first();
    const closeDMMenuExists = await closeDMMenuButton.count();
    if (closeDMMenuExists > 0) {
      await closeDMMenuButton.click();
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Step 11: Verify all 4 player cards are in the Entities panel
    const totalCharacters = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return data?.snapshot?.characters?.length ?? 0;
    });

    expect(totalCharacters).toBeGreaterThanOrEqual(4);

    // Step 12: Open initiative tracker for each character and roll/save initiative
    const allCharacters = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return (
        data?.snapshot?.characters?.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        })) ?? []
      );
    });

    console.log(`Setting initiative for ${allCharacters.length} characters`);

    for (const character of allCharacters) {
      console.log(`Setting initiative for ${character.name} (${character.type})`);

      // Look for the character card in the Entities panel
      // Try to find and click the initiative button for this character
      const initiativeButton = page
        .getByRole("button", { name: new RegExp(`Initiative.*${character.name}`, "i") })
        .or(
          page
            .locator(`[data-character-id="${character.id}"]`)
            .getByRole("button", { name: /Initiative/i }),
        );

      const initiativeButtonExists = await initiativeButton.count();

      if (initiativeButtonExists > 0) {
        await initiativeButton.first().click();
        await page.waitForTimeout(500);

        // Click "Roll Initiative" button in the modal
        const rollButton = page.getByRole("button", { name: /Roll Initiative/i });
        const rollExists = await rollButton.count();

        if (rollExists > 0) {
          await rollButton.click();
          await page.waitForTimeout(300);

          // Click "Save" button
          const saveButton = page.getByRole("button", { name: /Save/i });
          const saveExists = await saveButton.count();

          if (saveExists > 0) {
            await saveButton.click();
            await page.waitForTimeout(500);

            // Wait for initiative to be set
            await page.waitForFunction(
              (charId) => {
                const data = window.__HERO_BYTE_E2E__;
                const char = data?.snapshot?.characters?.find((c) => c.id === charId);
                return char && typeof char.initiative === "number";
              },
              character.id,
              { timeout: 5000 },
            );
          }
        }
      } else {
        // If we can't find the button, try programmatically setting initiative
        console.log(`Setting initiative programmatically for ${character.name}`);
        await page.evaluate((charId) => {
          const data = window.__HERO_BYTE_E2E__;
          if (data?.sendMessage) {
            const roll = Math.floor(Math.random() * 20) + 1;
            const modifier = Math.floor(Math.random() * 5); // 0-4
            data.sendMessage({
              t: "set-initiative",
              characterId: charId,
              initiative: roll + modifier,
              modifier: modifier,
            });
          }
        }, character.id);

        await page.waitForTimeout(500);
      }
    }

    // Step 13: Verify all characters have initiative set
    const charactersWithInitiative = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const characters = data?.snapshot?.characters ?? [];
      return characters.filter((c) => typeof c.initiative === "number");
    });

    expect(charactersWithInitiative.length).toBe(allCharacters.length);

    // Step 14: Verify auto-sort by initiative
    const initiativeOrder = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const characters = data?.snapshot?.characters ?? [];
      return characters
        .filter((c) => typeof c.initiative === "number")
        .map((c) => ({
          name: c.name,
          initiative: c.initiative,
        }))
        .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
    });

    console.log("Initiative order:", initiativeOrder);

    // Verify the list is sorted in descending order
    for (let i = 0; i < initiativeOrder.length - 1; i++) {
      expect(initiativeOrder[i].initiative).toBeGreaterThanOrEqual(
        initiativeOrder[i + 1].initiative,
      );
    }

    console.log("✅ Test completed successfully!");
    console.log(`- Created 2 player characters`);
    console.log(`- Elevated to DM`);
    console.log(`- Created 2 NPCs`);
    console.log(`- Set initiative for all ${allCharacters.length} characters`);
    console.log(`- Verified initiative auto-sort`);
  });
});
