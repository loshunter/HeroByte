// Voice everywhere — the table's voice call, as simple as a Discord call: Join, Mute,
// Leave, and you hear everyone in it. Real browsers, a real server relaying the
// signals, Chromium's fake microphone (a steady tone) granted without a prompt.
//
// "Hears" here means: the browser holds one playing (not paused) <audio> per other person,
// fed by a live remote track, and its voice control counts the connection as up. Whether
// sound actually flows is not measured. The first journey is the one the old voice code
// lost: two people pressing Join at the same moment; the one-caller rule that fixes it is
// pinned in VoiceMesh.test.ts (this journey cannot tell one caller from two, see below).
// The last: a reload comes back into the call by itself, in the state it left.

import { expect, test, type Page } from "./fixtures";
import type { Browser, BrowserContext } from "@playwright/test";
import { createTable, dismissNextSteps, joinWithLink, seated } from "./table-role.helpers";
import { showPartyCards } from "./party.helpers";
import { expectHearing, expectHearingHolds, hearing } from "./voice.helpers";

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

const voiceGroup = (page: Page) => page.getByRole("group", { name: "Voice chat" }).first();

async function newPlayer(browser: Browser, contexts: BrowserContext[]): Promise<Page> {
  const context = await browser.newContext({ permissions: ["microphone"] });
  contexts.push(context);
  return context.newPage();
}

async function pressJoin(page: Page): Promise<void> {
  await voiceGroup(page)
    .getByRole("button", { name: /Join voice/ })
    .click();
}

async function inCallState(page: Page, state: "live" | "muted" | "off"): Promise<void> {
  await expect(voiceGroup(page)).toHaveAttribute("data-voice-state", state, { timeout: 15_000 });
}

test.describe("Voice everywhere — join, mute, leave", () => {
  test("two people pressing Join together end up hearing each other", async ({ page, browser }) => {
    const contexts: BrowserContext[] = [];
    try {
      const host = await newPlayer(browser, contexts);
      const link = await createTable(host, "voice-same-moment");
      await dismissNextSteps(host);
      await joinWithLink(page, link);
      await dismissNextSteps(page);

      await Promise.all([pressJoin(host), pressJoin(page)]);
      await inCallState(host, "live");
      await inCallState(page, "live");
      // This journey cannot tell one caller from two on its own: with a real server between
      // two browsers on one machine, a mutant where both sides call still connected (the
      // redial heals a collision within seconds). The one-caller rule is pinned where it can
      // fail deterministically: VoiceMesh.test.ts's relay tests.
      await expectHearing(host, 1);
      await expectHearing(page, 1);
      // And it stays up for two seconds, checked every 100 ms on both sides.
      await Promise.all([expectHearingHolds(host, 1), expectHearingHolds(page, 1)]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });

  test("a late joiner hears everyone; muting keeps you hearing; leaving hangs up", async ({
    page,
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    try {
      const host = await newPlayer(browser, contexts);
      const link = await createTable(host, "voice-late-join");
      await dismissNextSteps(host);
      await joinWithLink(page, link);
      await dismissNextSteps(page);

      // Before joining, the call is visible: the host is in it.
      await pressJoin(host);
      await inCallState(host, "live");
      await expect(voiceGroup(page)).toContainText("1 in call");

      // Join a call already running.
      await pressJoin(page);
      await inCallState(page, "live");
      await expectHearing(host, 1);
      await expectHearing(page, 1);

      // Mute: the state says muted, the connection stays, the others see it.
      await voiceGroup(page).getByRole("button", { name: /Mute/ }).click();
      await inCallState(page, "muted");
      await showPartyCards(host);
      await expect(host.getByRole("img", { name: "In voice, muted" })).toHaveCount(1);
      await Promise.all([expectHearingHolds(page, 1, 1_500), expectHearingHolds(host, 1, 1_500)]);
      await voiceGroup(page)
        .getByRole("button", { name: /Unmute/ })
        .click();
      await inCallState(page, "live");

      // A third person, later still, reaches both.
      const third = await newPlayer(browser, contexts);
      await joinWithLink(third, link);
      await dismissNextSteps(third);
      await pressJoin(third);
      await inCallState(third, "live");
      await expectHearing(third, 2);
      await expectHearing(host, 2);
      await expectHearing(page, 2);

      // Leave: that browser hangs up; the other two keep talking.
      await voiceGroup(page).getByRole("button", { name: "Leave voice" }).click();
      await inCallState(page, "off");
      await expectHearing(page, 0);
      await expectHearing(host, 1);
      await expectHearing(third, 1);
      await expect(voiceGroup(page)).toContainText("2 in call");
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });

  test("a reload rejoins the call by itself, in the same state, and both hear each other again", async ({
    page,
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    try {
      const host = await newPlayer(browser, contexts);
      const link = await createTable(host, "voice-reload");
      await dismissNextSteps(host);
      await joinWithLink(page, link);
      await dismissNextSteps(page);

      await pressJoin(host);
      await pressJoin(page);
      await inCallState(host, "live");
      await inCallState(page, "live");
      // Muted before the reload, so coming back "in the same state" is something to check.
      await voiceGroup(page).getByRole("button", { name: /Mute/ }).click();
      await inCallState(page, "muted");
      await expectHearing(host, 1);
      await expectHearing(page, 1);

      // Reload: the tab's table password lets it back in, and the call memory (written as
      // the old page went away) rejoins it with no press of Join voice.
      await page.reload();
      await seated(page);
      await inCallState(page, "muted");
      await expect(voiceGroup(page).getByRole("button", { name: /Unmute/ })).toBeVisible();
      await expect(voiceGroup(page)).toContainText("2 in call");
      await showPartyCards(host);
      await expect(host.getByRole("img", { name: "In voice, muted" })).toHaveCount(1);

      // A call rejoined without a tap may have its voices paused by the browser's autoplay
      // rule; then the person taps "Tap to hear voice", as the control asks.
      const tapToHear = voiceGroup(page).getByRole("button", { name: /Tap to hear voice/ });
      await expect
        .poll(async () => (await hearing(page)) === 1 || (await tapToHear.isVisible()), {
          timeout: 20_000,
        })
        .toBe(true);
      if (await tapToHear.isVisible()) await tapToHear.click();

      await expectHearing(page, 1);
      await expectHearing(host, 1);
      await Promise.all([expectHearingHolds(host, 1), expectHearingHolds(page, 1)]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
