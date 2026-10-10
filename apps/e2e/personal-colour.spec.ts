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
      // The window keeps its 2.6:1 shape (a flex item's content minimum once stretched it).
      const box = (await settings.locator(".color-picker__canvas").boundingBox())!;
      expect(box.width / box.height).toBeCloseTo(2.6, 1);
      const spot = settings.getByRole("button", { name: /^Suggested colour 1, #[0-9a-f]{6}$/ });
      const spotHex = (await spot.getAttribute("aria-label"))!.split(", ")[1]!;
      // A spot is always somewhere new, so the click must change the colour.
      expect(spotHex).not.toBe(before);
      await spot.click();

      // The spot lands as offered (a free colour: kept exactly, no notice).
      await expect.poll(async () => (await pcOf(alice, bobUid))?.color).toBe(spotHex);
      const after = spotHex;
      await expect(settings.getByLabel("Colour code")).toHaveText(after);
      expect(await bob.getByText(/so it moved to the nearest free one/).count()).toBe(0);

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
      const bobBefore = (await pcOf(bob, bobUid))!.color;

      // A crafted frame: the picker would never send it, the server must still move it.
      await bob.evaluate(
        ({ tokenId, color }) =>
          window.__HERO_BYTE_E2E__!.sendMessage({ t: "set-token-color", tokenId, color }),
        { tokenId: bobToken, color: aliceBefore.color! },
      );

      const bobName = (await pcOf(bob, bobUid))!.name;
      await expect(
        bob.getByText(
          `${bobName}'s colour was too close to ${aliceBefore.name}'s, so it moved to the nearest free one.`,
        ),
      ).toBeVisible();
      // Wait for Bob's OWN colour to change (the toast arrives before the broadcast).
      await expect.poll(async () => (await pcOf(bob, bobUid))?.color).not.toBe(bobBefore);
      const bobAfter = (await pcOf(bob, bobUid))!.color;
      expect(bobAfter).not.toBe(aliceBefore.color);
      // Alice has the broadcast that carried Bob's move, and her own colour is untouched...
      await expect.poll(async () => (await pcOf(alice, bobUid))?.color).toBe(bobAfter);
      expect((await pcOf(alice, aliceUid))?.color).toBe(aliceBefore.color);
      // ...and, checked once while Bob's toast is still up (a retrying check would
      // outlast the toast and pass on a notice wrongly sent to her), no notice.
      await expect(bob.getByText(/so it moved to the nearest free one/)).toBeVisible();
      expect(await alice.getByText(/so it moved to the nearest free one/).count()).toBe(0);
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
