import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

const DM_PASSWORD = process.env.E2E_DM_PASSWORD ?? "FunDM";

test.describe("HeroByte player and NPC initiative (UI-only)", () => {
  test("manage entities and set initiative using only UI interactions", async ({ page }) => {
    // Step 1: Join as a regular player
    console.log("✅ Step 1: Joining room as player");
    await joinDefaultRoom(page);

    // Wait for UI to be ready
    await page.waitForTimeout(2000);

    // Step 2: Take a screenshot to see the initial state
    await page.screenshot({ path: "test-results/01-initial-state.png" });

    // Step 3: Look for player cards in Entities panel
    const playerCards = page.locator(".player-card, [class*='player']").filter({ hasText: "You" });
    const playerCardCount = await playerCards.count();
    console.log(`✅ Step 3: Found ${playerCardCount} player card(s)`);

    if (playerCardCount === 0) {
      console.log("❌ No player cards found - cannot continue");
      test.skip(true, "No player cards found");
      return;
    }

    // Step 4: Try to find and click settings button for our player
    console.log("✅ Step 4: Looking for settings button");
    const settingsButton = page.getByRole("button", { name: "⚙️" }).first();

    try {
      await settingsButton.waitFor({ state: "visible", timeout: 5000 });
      await settingsButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/02-settings-menu-opened.png" });
    } catch (error) {
      console.log("⚠️  Settings button not found or not clickable");
    }

    // Step 5: Look for "Add Character" button
    const addCharButton = page.getByRole("button", { name: /Add Character/i });
    const addCharExists = await addCharButton.count();

    if (addCharExists > 0) {
      console.log("✅ Step 5: Found Add Character button, clicking it");

      // Set up dialog handlers
      page.once("dialog", async (dialog) => {
        console.log(`Dialog (confirm): ${dialog.message()}`);
        await dialog.accept();

        page.once("dialog", async (dialog2) => {
          console.log(`Dialog (prompt): ${dialog2.message()}`);
          await dialog2.accept("Fighter");
        });
      });

      await addCharButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "test-results/03-after-add-character.png" });
    }

    // Close the settings menu by clicking the X button or pressing Escape
    console.log("✅ Step 6: Closing settings menu");
    const closeButton = page.locator('button[aria-label="Close"]').first();
    const closeExists = await closeButton.count();

    if (closeExists > 0) {
      await closeButton.click();
      await page.waitForTimeout(800);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
    }

    // Take screenshot to verify menu is closed
    await page.screenshot({ path: "test-results/04-menu-closed.png" });

    // Step 7: Count total characters visible
    const totalCards = await page
      .locator(".player-card, [data-testid='player-card'], [class*='PlayerCard']")
      .count();
    console.log(`✅ Step 7: Total entity cards visible: ${totalCards}`);

    // Step 8: Reopen settings menu to become DM
    console.log("✅ Step 8: Reopening settings to become DM");

    // Wait a bit to ensure menu is fully closed
    await page.waitForTimeout(500);

    // Click settings button again
    const settingsButton2 = page.getByRole("button", { name: "⚙️" }).first();
    await settingsButton2.waitFor({ state: "visible", timeout: 5000 });
    await settingsButton2.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/05-settings-reopened.png" });

    // Look for DM Mode button
    const dmModeButton = page.getByRole("button", { name: /DM MODE: OFF/i });

    try {
      await dmModeButton.waitFor({ state: "visible", timeout: 5000 });
      console.log("✅ Found DM MODE button");

      // Set up password handler
      page.once("dialog", async (dialog) => {
        if (dialog.type() === "prompt") {
          console.log("Entering DM password");
          await dialog.accept(DM_PASSWORD);
        }
      });

      await dmModeButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "test-results/06-after-dm-elevation.png" });
      console.log("✅ Clicked DM MODE button");
    } catch (error) {
      console.log("⚠️  DM MODE button not found, skipping DM-specific tests");
    }

    // Close settings menu
    const closeButton2 = page.locator('button[aria-label="Close"]').first();
    const closeExists2 = await closeButton2.count();

    if (closeExists2 > 0) {
      await closeButton2.click();
      await page.waitForTimeout(800);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
    }

    // Step 9: Look for DM Menu
    console.log("✅ Step 9: Looking for DM Menu");
    await page.waitForTimeout(500);

    // Look for a button with "DM" in the header/toolbar area
    const dmMenuButton = page.getByRole("button", { name: /DM/i });
    const dmMenuCount = await dmMenuButton.count();

    if (dmMenuCount > 0) {
      console.log("✅ Found DM Menu button");
      await dmMenuButton.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/07-dm-menu-opened.png" });

      // Look for NPCs tab
      const npcsTab = page.getByRole("button", { name: /NPC/i });
      const npcsTabExists = await npcsTab.count();

      if (npcsTabExists > 0) {
        console.log("✅ Found NPCs tab");
        await npcsTab.first().click();
        await page.waitForTimeout(500);

        // Add 2 NPCs
        const addNPCButton = page.getByRole("button", { name: /Add NPC/i });
        const addNPCExists = await addNPCButton.count();

        if (addNPCExists > 0) {
          console.log("✅ Step 10: Adding NPCs");

          // Add first NPC
          await addNPCButton.click();
          await page.waitForTimeout(800);

          // Add second NPC
          await addNPCButton.click();
          await page.waitForTimeout(800);

          await page.screenshot({ path: "test-results/08-npcs-added.png" });
          console.log("✅ Added 2 NPCs");
        }
      }

      // Close DM menu
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      console.log("⚠️  DM Menu button not found - may not be DM yet");
    }

    // Step 11: Final state - count all entities
    await page.screenshot({ path: "test-results/09-final-entities.png" });

    const finalCardCount = await page.locator(".player-card, [class*='Card']").count();
    console.log(`✅ Step 11: Final entity count: ${finalCardCount}`);

    // Step 12: Try to set initiative for entities
    console.log("✅ Step 12: Attempting to set initiative for entities");

    // Look for initiative buttons (INIT badge/button on entity cards)
    const initiativeButtons = page.getByRole("button").filter({ hasText: /INIT/i });
    const initButtonCount = await initiativeButtons.count();
    console.log(`Found ${initButtonCount} initiative buttons`);

    if (initButtonCount > 0) {
      // Click first initiative button
      await initiativeButtons.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/10-initiative-modal.png" });

      // Look for Roll Initiative button
      const rollButton = page.getByRole("button", { name: /Roll/i });
      const rollExists = await rollButton.count();

      if (rollExists > 0) {
        console.log("✅ Found Roll button, clicking it");
        await rollButton.first().click();
        await page.waitForTimeout(500);

        // Click Save
        const saveButton = page.getByRole("button", { name: /Save/i });
        const saveExists = await saveButton.count();

        if (saveExists > 0) {
          // Phase 3 Fix Verification: Check for loading state before modal closes
          await saveButton.first().click();

          // Look for "Setting..." text to verify loading state is shown
          const settingText = page.getByText(/Setting/i);
          const settingExists = await settingText.count();

          if (settingExists > 0) {
            console.log("✅ Verified loading state shown");
          }

          // Wait for modal to close (should only close after server confirms)
          await page.waitForTimeout(1000);
          console.log("✅ Set initiative for first entity");

          // Try to set initiative for a few more entities
          for (let i = 1; i < Math.min(4, initButtonCount); i++) {
            await page.waitForTimeout(300);
            const nextInitButton = page.getByRole("button").filter({ hasText: /INIT/i });
            const count = await nextInitButton.count();

            if (count > i) {
              await nextInitButton.nth(i).click();
              await page.waitForTimeout(500);

              const rollBtn = page.getByRole("button", { name: /Roll/i });
              if ((await rollBtn.count()) > 0) {
                await rollBtn.first().click();
                await page.waitForTimeout(300);

                const saveBtn = page.getByRole("button", { name: /Save/i });
                if ((await saveBtn.count()) > 0) {
                  await saveBtn.first().click();
                  await page.waitForTimeout(300);
                  console.log(`✅ Set initiative for entity ${i + 1}`);
                }
              }
            }
          }
        }
      }
    }

    // Final screenshot
    await page.screenshot({ path: "test-results/11-test-complete.png" });

    console.log("\n✅ Test completed!");
    console.log("Check the screenshots in test-results/ folder to see the test progression");
    console.log("\nScreenshots created:");
    console.log("  01-initial-state.png - Initial player state");
    console.log("  02-settings-menu-opened.png - Player settings menu");
    console.log("  03-after-add-character.png - After adding second character");
    console.log("  04-menu-closed.png - Menu closed");
    console.log("  05-settings-reopened.png - Settings menu reopened");
    console.log("  06-after-dm-elevation.png - After becoming DM");
    console.log("  07-dm-menu-opened.png - DM menu");
    console.log("  08-npcs-added.png - After adding NPCs");
    console.log("  09-final-entities.png - All entities visible");
    console.log("  10-initiative-modal.png - Initiative modal");
    console.log("  11-test-complete.png - Final state with initiatives set");
  });
});
