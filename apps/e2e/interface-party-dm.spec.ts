// U7 — what the owner added after review round 3, driven through real input on
// a disposable private table (the dev seam only sets the table up):
//  - a DM edits a player's HP from the card on desktop and from the row on a
//    phone, and the player sees it;
//  - the DM moves a player character to another seat from Token settings; its
//    token and the "You" tag follow, and a DM on a phone moves it back;
//  - a DM on a phone sets an NPC's conditions from the DM screen (the phone
//    Party lists no NPCs), and its Focus closes the screen to show the token.

import { expect, test, type Page } from "./fixtures";
import { openCharacterDetails, rosterRow } from "./party.helpers";
import {
  centredOn,
  createTableAsDM,
  elevateBySeam,
  joinTable,
  moveToken,
  ownCharacters,
  partyTable,
  placeNpcTokens,
  send,
  tokenOf,
  tokenOwner,
  uidOf,
} from "./u7-party.helpers";

const PHONE = { viewport: { width: 375, height: 812 }, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

/** A co-DM on a phone: the phone shell, elevated. */
async function joinAsPhoneDM(page: Page, roomUrl: string): Promise<void> {
  await joinTable(page, `${roomUrl}&mobile=true`);
  await elevateBySeam(page);
}

const phoneDock = (page: Page) => page.getByRole("navigation", { name: "Mobile actions" });

/** The select button's accessible name: it carries the row's "(You)" tag. */
const rowLabel = (page: Page, name: string) =>
  rosterRow(page, name).locator(".party-roster__select");

test.describe("U7 — a DM's Party powers", () => {
  // Up to four clients on one table: more than the default 30 s on a loaded run.
  test.describe.configure({ timeout: 90_000 });

  test("a DM edits a player's HP from the card, and from the row on a phone", async ({
    page: dm,
    browser,
  }) => {
    const desk = await browser.newContext(DESKTOP);
    const phone = await browser.newContext(PHONE);
    try {
      const player = await desk.newPage();
      const phoneDm = await phone.newPage();
      await dm.setViewportSize(DESKTOP.viewport);
      const roomUrl = await createTableAsDM(dm, "u7-dm-hp");
      await joinTable(player, roomUrl);
      await expect.poll(async () => (await ownCharacters(player)).length).toBe(1);
      const [hero] = await ownCharacters(player);
      await expect(rosterRow(player, hero.name)).toContainText(`HP ${hero.hp}/`);

      // Desktop: the player's card in the DM's inspector (current HP first).
      const inspector = await openCharacterDetails(dm, rosterRow(dm, hero.name));
      await inspector.getByText(String(hero.hp), { exact: true }).first().click();
      const hp = inspector.locator('input[type="number"]').first();
      await hp.fill("42");
      await hp.press("Enter");
      await expect(rosterRow(player, hero.name)).toContainText("HP 42/");

      // Phone: the player's row under their seat.
      await joinAsPhoneDM(phoneDm, roomUrl);
      await phoneDock(phoneDm).getByRole("button", { name: "Party", exact: true }).tap();
      const row = phoneDm.getByTestId("mobile-player-row").filter({ hasText: hero.name });
      await expect(row).toHaveCount(1);
      await row.getByText("42", { exact: true }).tap();
      const field = row.locator('input[type="number"]');
      await field.fill("17");
      await field.press("Enter");
      await expect(rosterRow(player, hero.name)).toContainText("HP 17/");
      await expect(rosterRow(dm, hero.name)).toContainText("HP 17/");
    } finally {
      await desk.close();
      await phone.close();
    }
  });

  test("the DM moves a player character to another seat; its token and the You tag follow", async ({
    page: dm,
    browser,
  }) => {
    // One context per person: pages in a context share the stored seat.
    const aliceContext = await browser.newContext(DESKTOP);
    const bobContext = await browser.newContext(DESKTOP);
    const phone = await browser.newContext(PHONE);
    try {
      const alice = await aliceContext.newPage();
      const bob = await bobContext.newPage();
      const phoneDm = await phone.newPage();
      await dm.setViewportSize(DESKTOP.viewport);
      const { roomUrl, second } = await partyTable(dm, alice, "u7-owner");
      await joinTable(bob, roomUrl);
      const [aliceUid, bobUid] = [await uidOf(alice), await uidOf(bob)];
      await expect(rowLabel(alice, "Companion")).toHaveAttribute(
        "aria-label",
        /^Companion \(You\)/,
      );
      await expect(rowLabel(bob, "Companion")).not.toHaveAttribute("aria-label", /\(You\)/);

      // Desktop: the character's settings window, Token settings, Owner.
      const inspector = await openCharacterDetails(dm, rosterRow(dm, "Companion"));
      await inspector.getByTitle("Open player settings", { exact: true }).click();
      await dm.getByRole("combobox", { name: "Owner" }).selectOption(bobUid!);

      await expect(rowLabel(bob, "Companion")).toHaveAttribute("aria-label", /^Companion \(You\)/);
      await expect(rowLabel(alice, "Companion")).not.toHaveAttribute("aria-label", /\(You\)/);
      // The token follows the character: its owner is who may move it.
      await expect.poll(() => tokenOwner(bob, second.tokenId!)).toBe(bobUid);
      expect((await ownCharacters(alice)).map((c) => c.name)).not.toContain("Companion");

      // Phone: a DM moves it back from the row's EDIT sheet.
      await joinAsPhoneDM(phoneDm, roomUrl);
      await phoneDock(phoneDm).getByRole("button", { name: "Party", exact: true }).tap();
      const row = phoneDm.getByTestId("mobile-player-row").filter({ hasText: "Companion" });
      await row.getByRole("button", { name: /EDIT/ }).tap();
      await phoneDm.getByRole("combobox", { name: "Owner" }).selectOption(aliceUid!);

      await expect(rowLabel(alice, "Companion")).toHaveAttribute(
        "aria-label",
        /^Companion \(You\)/,
      );
      await expect(rowLabel(bob, "Companion")).not.toHaveAttribute("aria-label", /\(You\)/);
      await expect.poll(() => tokenOwner(alice, second.tokenId!)).toBe(aliceUid);
    } finally {
      await aliceContext.close();
      await bobContext.close();
      await phone.close();
    }
  });

  test("a DM on a phone sets an NPC's conditions and focuses it from the DM screen", async ({
    page: dm,
    browser,
  }) => {
    const phone = await browser.newContext(PHONE);
    try {
      const phoneDm = await phone.newPage();
      await dm.setViewportSize(DESKTOP.viewport);
      const roomUrl = await createTableAsDM(dm, "u7-phone-npc");
      await joinAsPhoneDM(phoneDm, roomUrl);
      await send(dm, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7 });
      await placeNpcTokens(dm, 1);
      const tokenId = (await tokenOf(dm, "Goblin"))!;
      await moveToken(dm, tokenId, 6, 4);

      await phoneDock(phoneDm).getByRole("button", { name: /^DM$/i }).tap();
      const menu = phoneDm.getByRole("dialog", { name: "DM Menu" });
      // The menu is a lazy chunk: wait for its tabs.
      const npcs = menu.getByRole("button", { name: "NPCs & Monsters" });
      await expect(npcs).toBeVisible({ timeout: 15_000 });
      await npcs.tap();
      await menu.getByRole("button", { name: "No Effects" }).tap();
      await menu.getByRole("checkbox", { name: /Poisoned/ }).check();
      // Close the list, as a person would: it lies over the editor's buttons.
      await menu.getByRole("button", { name: "1 Active Effect" }).tap();
      await expect(
        rosterRow(dm, "Goblin").getByRole("img", { name: "Conditions: Poisoned" }),
      ).toBeVisible();

      expect(await centredOn(phoneDm, tokenId)).toBe(false);
      await menu.getByRole("button", { name: "Focus Goblin" }).tap();
      await expect(menu).toHaveCount(0);
      await expect.poll(() => centredOn(phoneDm, tokenId)).toBe(true);
    } finally {
      await phone.close();
    }
  });
});
