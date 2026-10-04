// U7 — Party is compact; a character is not a player seat. The plan's bars,
// driven through real input on a disposable private table:
//  - at 1366x768 the collapsed roster leaves at least 60% of the viewport to
//    the map, and the map's edge follows the panel as details open and close;
//  - two characters on one seat keep distinct HP, conditions and Focus, and
//    the DM's client agrees;
//  - at 1440x900 with NPC rows and player props on, every Party control takes
//    its own click and the launchers sit in the bar's dock, never over a row;
//  - on a 375px phone the Party lists characters under their seat, and Focus
//    shows the map on that character;
//  - 200% zoom lives in interface-party-roster-zoom.spec.ts.

import { expect, test } from "./fixtures";
import {
  ownRosterRow,
  partyInspector,
  rosterRow,
  openCharacterDetails,
  showPartyCards,
} from "./party.helpers";
import {
  centredOn,
  createTableAsDM,
  joinTable,
  mapBand,
  moveToken,
  placeNpcTokens,
  overlaps,
  ownCharacters,
  partyTable,
  send,
  takesItsOwnClick,
  tokenOf,
} from "./u7-party.helpers";

test.describe("U7 — the compact Party", () => {
  test("1366x768: the collapsed roster leaves 60% to the map, and the map follows the panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const roomUrl = await createTableAsDM(page, "u7-map-share");
    expect(roomUrl).toContain("room=");
    // A full table: more rows than fit across 1366 px, so a roster that grew
    // downward instead of scrolling sideways would eat the map.
    await send(page, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7, count: 8 });
    await expect(page.locator(".party-roster__entry")).toHaveCount(9);
    await expect(ownRosterRow(page)).toBeVisible();

    const collapsed = await mapBand(page);
    expect(collapsed.share).toBeGreaterThanOrEqual(0.6);
    expect(Math.abs(collapsed.boardBottom - collapsed.panelTop)).toBeLessThanOrEqual(1);

    // Details grow the panel; the canvas's bottom edge follows it both ways.
    await openCharacterDetails(page, ownRosterRow(page));
    await expect
      .poll(async () => {
        const band = await mapBand(page);
        return (
          band.panelTop < collapsed.panelTop && Math.abs(band.boardBottom - band.panelTop) <= 1
        );
      })
      .toBe(true);
    await partyInspector(page)
      .getByRole("button", { name: /^Close .* details$/ })
      .click();
    // Within a pixel: the panel's height is measured as a whole-pixel offsetHeight.
    await expect
      .poll(async () => Math.abs((await mapBand(page)).boardBottom - collapsed.panelTop) <= 1)
      .toBe(true);
  });

  test("two characters on one seat keep distinct HP, conditions and Focus — on both clients", async ({
    page: dm,
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const player = await context.newPage();
    try {
      await dm.setViewportSize({ width: 1440, height: 900 });
      const { first, second } = await partyTable(dm, player, "u7-two-characters");

      // HP: through the Companion's own card in the inspector.
      const inspector = await openCharacterDetails(player, rosterRow(player, "Companion"));
      // The current-HP number (the first exact "100"; the second is the maximum).
      await inspector.getByText("100", { exact: true }).first().click();
      const hp = inspector.locator('input[type="number"]').first();
      await hp.fill("42");
      await hp.press("Enter");
      await expect(rosterRow(player, "Companion")).toContainText("HP 42/100");
      await expect(rosterRow(player, first.name)).toContainText("HP 100/100");

      // Condition: the Companion's settings window, then its picker.
      await inspector.getByTitle("Open player settings", { exact: true }).click();
      const settings = player.locator('[data-mobile-surface="settings"]');
      await settings.getByRole("button", { name: "No Effects" }).click();
      await settings.getByRole("checkbox", { name: /Poisoned/ }).check();
      await settings.getByRole("button", { name: /^Close / }).click();
      await expect(
        rosterRow(player, "Companion").getByRole("img", { name: "Conditions: Poisoned" }),
      ).toBeVisible();
      await expect(rosterRow(player, first.name).getByRole("img")).toHaveCount(0);

      // The DM's client reads the same two rows, distinctly.
      await expect(rosterRow(dm, "Companion")).toContainText("HP 42/100");
      await expect(
        rosterRow(dm, "Companion").getByRole("img", { name: "Conditions: Poisoned" }),
      ).toBeVisible();
      // The row is there (a missing row would also have no condition).
      await expect(rosterRow(dm, first.name)).toContainText("HP 100/100");
      await expect(rosterRow(dm, first.name).getByRole("img")).toHaveCount(0);

      // Focus: each row centres its OWN token (the two are on different cells).
      expect(await centredOn(player, second.tokenId!)).toBe(false);
      await rosterRow(player, "Companion")
        .getByRole("button", { name: /^Focus / })
        .click();
      await expect.poll(() => centredOn(player, second.tokenId!)).toBe(true);
      expect(await centredOn(player, first.tokenId!)).toBe(false);
      await rosterRow(player, first.name)
        .getByRole("button", { name: /^Focus / })
        .click();
      await expect.poll(() => centredOn(player, first.tokenId!)).toBe(true);
      expect(await centredOn(player, second.tokenId!)).toBe(false);

      // Close details and resume play: Escape closes the inspector and returns
      // focus to the row whose details they were.
      await player.keyboard.press("Escape");
      await expect(partyInspector(player)).toHaveCount(0);
      await expect(rosterRow(player, "Companion").locator(".party-roster__select")).toBeFocused();
    } finally {
      await context.close();
    }
  });

  test("the DM's NPC equivalent: place, focus, HP and condition from the Party — the player sees it", async ({
    page: dm,
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const player = await context.newPage();
    try {
      await dm.setViewportSize({ width: 1440, height: 900 });
      const roomUrl = await createTableAsDM(dm, "u7-npc");
      await joinTable(player, roomUrl);
      await send(dm, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7 });
      const goblin = rosterRow(dm, "Goblin");
      await expect(goblin).toContainText("HP 7/7");

      // Place its token from its card's settings, then Focus it.
      const inspector = await openCharacterDetails(dm, goblin);
      await inspector.getByRole("button", { name: /^NPC settings/ }).click();
      await dm.getByRole("button", { name: "Place Token" }).click();
      await expect(goblin.getByRole("button", { name: "Focus Goblin" })).toBeVisible();
      // PLACE ON MAP drops it on the top-left cell, onto the DM's own token:
      // give it a cell of its own so Focus on one cannot pass for the other.
      const tokenId = (await tokenOf(dm, "Goblin"))!;
      const dmToken = (await ownCharacters(dm))[0]!.tokenId!;
      await moveToken(dm, tokenId, 6, 2);
      expect(await centredOn(dm, tokenId)).toBe(false);
      await goblin.getByRole("button", { name: "Focus Goblin" }).click();
      await expect.poll(() => centredOn(dm, tokenId)).toBe(true);
      expect(await centredOn(dm, dmToken)).toBe(false);

      // A condition from the same window, then HP from the card.
      await dm.getByRole("button", { name: "No Effects" }).click();
      await dm.getByRole("checkbox", { name: /Poisoned/ }).check();
      await expect(goblin.getByRole("img", { name: "Conditions: Poisoned" })).toBeVisible();
      await dm.getByRole("button", { name: "Close NPC Settings" }).click();
      await inspector.getByText("7", { exact: true }).first().click();
      const hp = inspector.locator('input[type="number"]').first();
      await hp.fill("3");
      await hp.press("Enter");
      await expect(goblin).toContainText("HP 3/7");

      // The player's Party shows the same NPC, wearing the condition.
      await expect(
        rosterRow(player, "Goblin").getByRole("img", { name: "Conditions: Poisoned" }),
      ).toBeVisible();

      // Close details and resume play.
      await inspector.getByRole("button", { name: "Close Goblin details" }).click();
      await expect(partyInspector(dm)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("1440x900 with NPC rows and player props: every Party control takes its own click", async ({
    page: dm,
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const player = await context.newPage();
    try {
      await dm.setViewportSize({ width: 1440, height: 900 });
      await partyTable(dm, player, "u7-reach");
      await send(dm, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7, count: 6 });
      await send(dm, { t: "set-player-props-enabled", enabled: true });
      await placeNpcTokens(dm, 6);
      await expect(player.locator(".party-roster__entry")).toHaveCount(9);

      for (const page of [player, dm]) {
        await expect(page.locator(".party-roster__entry")).toHaveCount(9);
        const dock = page.locator(".party-bar__dock");
        const launchers = dock.getByRole("button");
        await expect(launchers).toHaveCount(page === dm ? 1 : 2);
        // Docked in the bar's flow, not floated over the page.
        for (const docked of [dock, ...(await launchers.all())]) {
          expect(await docked.evaluate((el) => getComputedStyle(el).position)).not.toBe("fixed");
        }
        for (const launcher of await launchers.all()) {
          expect(await overlaps(launcher, page.locator(".party-roster"))).toBe(false);
        }
        // Every character has a token here, so every row has its Focus.
        await expect(
          page.locator(".party-roster__entry").getByRole("button", { name: /^Focus / }),
        ).toHaveCount(9);
        for (const entry of await page.locator(".party-roster__entry").all()) {
          await takesItsOwnClick(entry.locator(".party-roster__select"));
          await takesItsOwnClick(entry.getByRole("button", { name: /^Focus / }));
        }
      }

      // Each client's own details, then (the DM's) an NPC's: every card control takes its click.
      for (const page of [player, dm]) {
        const inspector = await openCharacterDetails(page, ownRosterRow(page));
        for (const name of ["Open player settings", "Set Initiative", "Focus camera on token"]) {
          await takesItsOwnClick(inspector.getByRole("button", { name }));
        }
        await takesItsOwnClick(inspector.locator(".jrpg-hp-bar"));
      }
      const npcInspector = await openCharacterDetails(dm, rosterRow(dm, "Goblin").first());
      await takesItsOwnClick(npcInspector.getByRole("button", { name: /^NPC settings/ }));
      await takesItsOwnClick(npcInspector.locator(".jrpg-hp-bar"));

      // The pre-U7 obstruction (IA-15): all cards open, launchers docked. Counted
      // per client, so a loop over nothing cannot pass: the player's gears are
      // their own two cards'; the DM's are every PC's and every NPC's.
      for (const [page, gears] of [
        [player, 2],
        [dm, 9],
      ] as const) {
        await showPartyCards(page);
        const cards = page.locator(".player-card");
        await expect(cards).toHaveCount(9);
        const focus = cards.getByRole("button", { name: "Focus camera on token" });
        const settings = cards.locator(
          'button[aria-label="Open player settings"], button[title="NPC settings"]',
        );
        const hpBars = cards.locator(".jrpg-hp-bar");
        await expect(focus).toHaveCount(9);
        await expect(settings).toHaveCount(gears);
        await expect(hpBars).toHaveCount(9);
        for (const control of [
          ...(await focus.all()),
          ...(await settings.all()),
          ...(await hpBars.all()),
        ]) {
          await takesItsOwnClick(control);
        }
      }
    } finally {
      await context.close();
    }
  });

  test("a 375px phone lists characters under their seat, and Focus shows that character", async ({
    page: dm,
    browser,
  }) => {
    const phone = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const player = await phone.newPage();
    try {
      const roomUrl = await createTableAsDM(dm, "u7-phone");
      await player.goto(`${roomUrl}&mobile=true`);
      await player.getByPlaceholder("Table password").fill("U7-local-table-password");
      await player.getByRole("button", { name: /Enter Table/i }).click();
      await expect(player.getByTestId("map-board").locator("canvas").first()).toBeVisible();
      await send(player, { t: "add-player-character", name: "Companion", maxHp: 100 });
      await expect.poll(async () => (await ownCharacters(player))[1]?.tokenId).toBeTruthy();
      const [first, companion] = await ownCharacters(player);
      await moveToken(player, companion.tokenId!, 4, 3);

      const actions = player.getByRole("navigation", { name: "Mobile actions" });
      await actions.getByRole("button", { name: "Party", exact: true }).tap();
      const mySeat = player.getByRole("region", { name: /^Seat: .* \(you\)$/ });
      await expect(mySeat.getByRole("heading")).toContainText("· 2 characters");
      await expect(mySeat.getByTestId("mobile-player-row")).toHaveCount(2);
      expect(await player.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        375,
      );
      // FOCUS and EDIT sit on their own line: neither name is cut short.
      for (const name of [first.name, "Companion"]) {
        const text = mySeat.getByTestId("mobile-player-row").getByText(name, { exact: true });
        expect(await text.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      }

      expect(await centredOn(player, companion.tokenId!)).toBe(false);
      await mySeat.getByRole("button", { name: "Focus Companion" }).tap();
      await expect(player.getByRole("dialog", { name: "Party Members" })).toHaveCount(0);
      await expect.poll(() => centredOn(player, companion.tokenId!)).toBe(true);
      expect(await centredOn(player, first.tokenId!)).toBe(false);
      // And the first row's Focus centres the first character, not the last one focused.
      await actions.getByRole("button", { name: "Party", exact: true }).tap();
      await mySeat.getByRole("button", { name: `Focus ${first.name}` }).tap();
      await expect.poll(() => centredOn(player, first.tokenId!)).toBe(true);
      expect(await centredOn(player, companion.tokenId!)).toBe(false);

      // 1366x768 at 200% zoom is this phone shell in landscape: the seats fit.
      await player.setViewportSize({ width: 683, height: 384 });
      await actions.getByRole("button", { name: "Party", exact: true }).tap();
      await expect(mySeat.getByTestId("mobile-player-row")).toHaveCount(2);
      expect(await player.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        683,
      );
      await mySeat.getByRole("button", { name: "Focus Companion" }).scrollIntoViewIfNeeded();
      await expect(mySeat.getByRole("button", { name: "Focus Companion" })).toBeInViewport();
    } finally {
      await phone.close();
    }
  });
});
