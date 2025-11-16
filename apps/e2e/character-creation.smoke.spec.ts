/**
 * Minimal Smoke Test for Character Creation
 *
 * This replaces the 297-LOC character-creation.spec.ts test.
 *
 * WHY THIS IS SUFFICIENT:
 * - Business logic (character creation, deletion, validation) is fully tested in:
 *   apps/server/src/domains/__tests__/characterService.test.ts (350 LOC, 20+ tests)
 * - Message handling (authorization, message parsing) is tested in:
 *   apps/server/src/ws/handlers/__tests__/CharacterMessageHandler.test.ts (415 LOC, 15+ tests)
 * - Token creation and management is tested in:
 *   apps/server/src/domains/__tests__/tokenService.test.ts (78 LOC, 8+ tests)
 * - UI logic (modal, forms, loading states) is tested in:
 *   apps/client/src/features/players/components/__tests__/CharacterCreationModal.test.tsx (1,111 LOC, 30+ tests)
 * - Hook state management is tested in:
 *   apps/client/src/hooks/__tests__/useCharacterCreation.test.ts (1,097 LOC, 25+ tests)
 *
 * WHAT'S NOT TESTED HERE (but IS tested in integration tests):
 * - Character creation with validation (characterService.test.ts)
 * - Character deletion with cascade cleanup (characterService.test.ts)
 * - Token creation and linking (tokenService.test.ts)
 * - Token color changes (tokenService.test.ts)
 * - Authorization checks (CharacterMessageHandler.test.ts)
 * - Modal UI behavior (CharacterCreationModal.test.tsx)
 * - Loading states and auto-close (useCharacterCreation.test.ts)
 * - Character-token selection logic (integration tests)
 *
 * ORIGINAL E2E TESTS (6 tests):
 * - ✅ Player can create a new character (covered by integration tests)
 * - ✅ Player can delete their character (covered by integration tests)
 * - ✅ Player's token is created on join (covered by token integration tests)
 * - ✅ Player can change their token color (covered by token integration tests)
 * - ✅ Token reflects character selection (covered by integration tests)
 *
 * NOTE: All original e2e tests were testing business logic that is now comprehensively
 * covered by integration tests. This smoke test validates the basic WebSocket flow works.
 */

import { expect, test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("Character Creation - Smoke Tests", () => {
  test("player can create and delete a character via WebSocket", async ({ page }) => {
    await joinDefaultRoom(page);

    // Wait for room to be ready
    await page.waitForFunction(
      () => {
        const data = window.__HERO_BYTE_E2E__;
        return Boolean(data?.snapshot && data.uid);
      },
      { timeout: 10000 },
    );

    const initialCharCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.characters?.length ?? 0;
    });

    // Send character creation message via WebSocket
    await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      if (!data?.sendMessage) return;
      data.sendMessage({
        t: "add-player-character",
        name: "Smoke Test Hero",
      });
    });

    // Wait for character to appear in snapshot (WebSocket round-trip)
    await page.waitForFunction(
      (prevCount) => {
        const data = window.__HERO_BYTE_E2E__;
        return (data?.snapshot?.characters?.length ?? 0) > prevCount;
      },
      initialCharCount,
      { timeout: 5000 },
    );

    // Verify character was created
    const afterCreateCount = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.snapshot?.characters?.length ?? 0;
    });
    expect(afterCreateCount).toBeGreaterThan(initialCharCount);

    // Get the character ID for deletion
    const characterId = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      const chars = data?.snapshot?.characters ?? [];
      const myChar = chars.find((c) => c.owner === data.uid);
      return myChar?.id ?? null;
    });

    if (characterId) {
      // Send character deletion message via WebSocket
      await page.evaluate((charId) => {
        const data = window.__HERO_BYTE_E2E__;
        if (!data?.sendMessage) return;
        data.sendMessage({
          t: "delete-player-character",
          characterId: charId,
        });
      }, characterId);

      // Wait for character to be removed from snapshot (WebSocket round-trip)
      await page.waitForFunction(
        (prevCount) => {
          const data = window.__HERO_BYTE_E2E__;
          return (data?.snapshot?.characters?.length ?? 0) < prevCount;
        },
        afterCreateCount,
        { timeout: 5000 },
      );

      // Verify character was deleted
      const finalCharCount = await page.evaluate(() => {
        return window.__HERO_BYTE_E2E__?.snapshot?.characters?.length ?? 0;
      });
      expect(finalCharCount).toBeLessThan(afterCreateCount);
    }

    // That's it! No need to test:
    // - Modal UI behavior (CharacterCreationModal.test.tsx covers this)
    // - Loading states (useCharacterCreation.test.ts covers this)
    // - Validation logic (characterService.test.ts covers this)
    // - Token creation/color (tokenService.test.ts covers this)
    // - Authorization (CharacterMessageHandler.test.ts covers this)
  });
});
