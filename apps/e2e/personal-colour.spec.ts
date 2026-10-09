/**
 * Personal colour (C1), two clients: a player picks a free colour in the settings
 * window and the other player's screen gets it; a colour sent into another player's
 * zone is moved to the nearest free one, the sender alone is told, and the owner of
 * the zone keeps their colour. The wire colour (SnapshotCharacter.color) is what the
 * other client reads, so this also proves it arrives.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";
import { openOwnCharacterSettings } from "./party.helpers";

/** A player's PC colour and name as this page's snapshot holds them. */
function pcOf(page: Page, uid: string) {
  return page.evaluate((owner) => {
    const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
    const pc = snapshot?.characters.find(
      (character) => character.ownedByPlayerUID === owner && character.type === "pc",
    );
    return pc ? { color: pc.color ?? null, name: pc.name, tokenId: pc.tokenId ?? null } : null;
  }, uid);
}

const uidOf = (page: Page) => page.evaluate(() => window.__HERO_BYTE_E2E__!.uid);

test.describe("personal colour across two clients", () => {
  test("a suggested colour reaches the other player, and their picker shows it as taken", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();
    try {
      await joinDefaultRoom(alice);
      await joinDefaultRoom(bob);
      const bobUid = await uidOf(bob);
      await expect.poll(async () => (await pcOf(alice, bobUid))?.color).toMatch(/^#[0-9a-f]{6}$/);
      const before = (await pcOf(alice, bobUid))!.color;

      const settings = await openOwnCharacterSettings(bob);
      await expect(settings.getByRole("slider", { name: /'s colour$/ })).toBeVisible();
      await settings.getByRole("button", { name: "Suggested colour 1" }).click();

      await expect.poll(async () => (await pcOf(alice, bobUid))?.color).not.toBe(before);
      const after = (await pcOf(alice, bobUid))!.color!;
      await expect(settings.getByLabel("Colour code")).toHaveText(after);

      const bobName = (await pcOf(alice, bobUid))!.name;
      const aliceSettings = await openOwnCharacterSettings(alice);
      await expect(
        aliceSettings.locator(`.color-picker__taken[title="${bobName}'s colour"]`),
      ).toHaveCSS("background-color", hexToRgb(after));
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test("a colour sent into another player's zone is moved, and only the sender is told", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();
    try {
      await joinDefaultRoom(alice);
      await joinDefaultRoom(bob);
      const aliceUid = await uidOf(alice);
      const bobUid = await uidOf(bob);
      await expect.poll(async () => (await pcOf(bob, aliceUid))?.color).toMatch(/^#/);
      const aliceBefore = (await pcOf(bob, aliceUid))!;
      const bobToken = (await pcOf(bob, bobUid))!.tokenId!;

      // A crafted frame: the picker would never send it, the server must still refuse it.
      await bob.evaluate(
        ({ tokenId, color }) =>
          window.__HERO_BYTE_E2E__!.sendMessage({ t: "set-token-color", tokenId, color }),
        { tokenId: bobToken, color: aliceBefore.color! },
      );

      await expect(
        bob.getByText(`Moved to the nearest free colour: too close to ${aliceBefore.name}'s.`),
      ).toBeVisible();
      await expect.poll(async () => (await pcOf(bob, bobUid))?.color).not.toBe(aliceBefore.color);
      expect((await pcOf(alice, aliceUid))?.color).toBe(aliceBefore.color);
      await expect(alice.getByText(/Moved to the nearest free colour/)).toHaveCount(0);
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });
});

function hexToRgb(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}
