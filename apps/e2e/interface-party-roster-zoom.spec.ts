// U7 — the Party at 200% browser zoom reflows without clipping. What 200%
// becomes depends on the screen:
//  - 1920x1080 stays desktop (960x540 CSS px): the Party bar and rows reflow,
//    and no empty-portrait instruction spills out of its frame (IA-20);
//  - 1366x768 and 1440x900 become 683x384 and 720x450, short landscape
//    viewports that isMobileLayout gives the phone shell (height <= 520 and
//    width <= 900). 720x450 is checked here as a zoomed DESKTOP — no touch
//    emulation, no ?mobile flag — since 683 px is already a phone by width
//    alone (the phone journey covers it).

import { expect, test } from "./fixtures";
import {
  openCharacterDetails,
  ownRosterRow,
  partyInspector,
  showPartyCards,
} from "./party.helpers";
import {
  createTableAsDM,
  joinTable,
  ownCharacters,
  send,
  takesItsOwnClick,
} from "./u7-party.helpers";

test.describe("U7 — the Party at 200% zoom", () => {
  test("1920x1080 -> 960x540 stays desktop: the Party bar and rows reflow without clipping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await createTableAsDM(page, "u7-zoom");
    await send(page, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7, count: 5 });
    await expect(page.locator(".party-roster__entry")).toHaveCount(6);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      960,
    );
    for (const button of await page.locator(".party-bar button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(960);
    }
    // Rows past the edge scroll into reach inside the roster; none is cut off.
    const last = page.locator(".party-roster__entry").last();
    await takesItsOwnClick(last.locator(".party-roster__select"));
    await openCharacterDetails(page, ownRosterRow(page));
    await takesItsOwnClick(partyInspector(page).getByRole("button", { name: /^Close / }));

    // The narrowest cards: the current turn's ring. No empty-portrait
    // instruction spills out of its frame (IA-20).
    const [mine] = await ownCharacters(page);
    await send(page, { t: "set-initiative", characterId: mine.id, initiative: 12 });
    await showPartyCards(page);
    await expect(page.locator(".player-card-shell--current-turn")).toHaveCount(1);
    const placeholders = page.getByTestId("portrait-placeholder");
    expect(await placeholders.count()).toBeGreaterThan(1);
    let narrow = 0;
    for (const placeholder of await placeholders.all()) {
      await placeholder.scrollIntoViewIfNeeded();
      // Neither down nor sideways: a word too long for the frame is wrapped.
      expect(await placeholder.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      expect(await placeholder.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      // The portrait frame is the container its instruction sizes by: in a
      // frame 72 px wide or less the hint gives way, and only the title shows.
      const frameWidth = await placeholder.evaluate(
        (el) => el.closest(".jrpg-portrait-frame")?.clientWidth ?? Infinity,
      );
      if (frameWidth <= 72) {
        narrow += 1;
        await expect(placeholder.locator(".portrait-placeholder__hint")).toBeHidden();
      }
    }
    // The case the container query exists for occurs here, so the check above ran.
    expect(narrow).toBeGreaterThan(0);
  });

  test("1440x900 -> 720x450 is the phone shell without touch: seats reachable, no overflow", async ({
    page: dm,
    browser,
  }) => {
    const roomUrl = await createTableAsDM(dm, "u7-zoom-720");
    const zoomed = await browser.newContext({ viewport: { width: 720, height: 450 } });
    const player = await zoomed.newPage();
    try {
      await joinTable(player, roomUrl);
      const actions = player.getByRole("navigation", { name: "Mobile actions" });
      await expect(actions).toBeVisible();
      expect(await player.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        720,
      );

      // Two characters on this seat push the DM's seat below the fold: every
      // row's Focus is reached by scrolling the screen as a person would.
      await send(player, { t: "add-player-character", name: "Companion", maxHp: 100 });
      await expect.poll(async () => (await ownCharacters(player)).length).toBe(2);
      await actions.getByRole("button", { name: "Party", exact: true }).click();
      const mySeat = player.getByRole("region", { name: /^Seat: .* \(you\)$/ });
      await expect(mySeat.getByTestId("mobile-player-row")).toHaveCount(2);
      const focus = player
        .getByRole("dialog", { name: "Party Members" })
        .getByRole("button", { name: /^Focus / });
      await expect(focus).toHaveCount(3);
      for (const control of await focus.all()) await takesItsOwnClick(control);
      expect(await player.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        720,
      );
    } finally {
      await zoomed.close();
    }
  });
});
