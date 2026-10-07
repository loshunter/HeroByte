// Voice everywhere on a phone — real touch on Pixel 7, a desktop host in the same call.
// The phone's top stack hands taps through to the map; the live evaluation found the
// voice chip's Join unreachable because of it (the canvas took the tap). Taps here go
// through real hit-testing, so a chip the map swallows fails this spec.

import { devices } from "@playwright/test";
import { expect, test, type Page } from "../fixtures";
import { createTable, dismissNextSteps, joinWithLink } from "../table-role.helpers";
import { undersizedControls } from "./mobile.helpers";
import { expectHearingHolds, hearing } from "../voice.helpers";

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

const voice = (page: Page) => page.getByRole("group", { name: "Voice chat" });
const dock = (page: Page) => page.getByRole("navigation", { name: "Mobile actions" });

test.describe("mobile — voice chat", () => {
  test.describe.configure({ timeout: 120_000 });

  test("a running call shows on the map; the phone joins with one tap, mutes, sees who is in it, leaves", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ["microphone"],
    });
    const phoneContext = await browser.newContext({
      ...devices["Pixel 7"],
      permissions: ["microphone"],
    });
    try {
      const host = await hostContext.newPage();
      const phone = await phoneContext.newPage();
      const link = await createTable(host, "mobile-voice");
      await dismissNextSteps(host);
      await joinWithLink(phone, `${link}&mobile=true`);

      // An idle table keeps its map clear: no chip until someone is in a call. (The phone
      // layout first, or a count of 0 would pass before anything rendered.)
      await expect(dock(phone)).toBeVisible();
      await expect(phone.locator(".mobile-top-stack")).toBeVisible();
      await expect(
        phone.locator(".mobile-top-stack").getByRole("group", { name: "Voice chat" }),
      ).toHaveCount(0);

      await voice(host)
        .getByRole("button", { name: /Join voice/ })
        .click();
      const chip = phone.locator(".mobile-top-stack").getByRole("group", { name: "Voice chat" });
      await expect(chip).toContainText("1 in call");
      expect(await undersizedControls(phone, ".mobile-top-stack .voice-control")).toEqual([]);

      // One tap, through real hit-testing.
      await chip.getByRole("button", { name: /Join voice/ }).tap();
      await expect(chip).toHaveAttribute("data-voice-state", "live", { timeout: 15_000 });
      await expect.poll(() => hearing(phone), { timeout: 20_000 }).toBe(1);
      await expect.poll(() => hearing(host), { timeout: 20_000 }).toBe(1);

      // Mute keeps the call.
      await chip.getByRole("button", { name: /Mute/ }).tap();
      await expect(chip).toHaveAttribute("data-voice-state", "muted");
      await expectHearingHolds(phone, 1, 1_500);

      // The Party screen says who is in the call (a phone has no hover titles).
      await dock(phone).getByRole("button", { name: "Party", exact: true }).tap();
      const party = phone.getByRole("dialog", { name: "Party Members" });
      await expect(party.getByRole("group", { name: "Voice chat" })).toContainText("In the call:");
      await expect(party.getByRole("group", { name: "Voice chat" })).toContainText("You (muted)");
      expect(await undersizedControls(phone, '[role="dialog"] .voice-control')).toEqual([]);
      await phone.getByRole("button", { name: "Close Party Members", exact: true }).tap();

      await chip.getByRole("button", { name: "Leave voice" }).tap();
      await expect(chip).toHaveAttribute("data-voice-state", "off");
      await expect.poll(() => hearing(phone)).toBe(0);
      await expect(chip).toContainText("1 in call");
    } finally {
      await Promise.all([hostContext.close(), phoneContext.close()]);
    }
  });
});
