// U9 — the conflict gate and its fresh-session way out, untouched by the Table. A browser
// that presents a live seat's uid without that seat's session token (another device, or a
// browser that lost its key) is HELD: it never reaches the seat or its DM powers, the gate
// names its way out, and the fresh session gives it a new identity. The first browser is
// not disturbed. (Real pages, real server: the unit suites pin the gate's copy and the
// escape itself; this proves the new UI did not get in the way of either.)

import { expect, test } from "./fixtures";
import {
  DM_PASSWORD,
  TABLE_PASSWORD,
  createTable,
  enterDMMode,
  tableButton,
  viewerIsDM,
} from "./table-role.helpers";
import { uidOf } from "./u7-party.helpers";

test.describe("U9 — the conflict gate", () => {
  test.describe.configure({ timeout: 90_000 });

  test("a browser with no session token for a live seat is held, can start fresh, and never gets the DM's powers", async ({
    page: first,
    browser,
  }) => {
    const link = await createTable(first, "u9-conflict");
    await enterDMMode(first, DM_PASSWORD);
    const seat = await uidOf(first);
    expect(seat).toBeTruthy();

    const otherDevice = await browser.newContext();
    try {
      const second = await otherDevice.newPage();
      const url = new URL(link);
      url.searchParams.set("sessionUid", seat!);
      await second.goto(url.toString());
      await second.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
      await second.getByRole("button", { name: /Enter Table/i }).click();
      await expect(second.getByText("Held in another window")).toBeVisible({ timeout: 20_000 });
      // The gate, not the table: none of the Table's controls exist behind it, and the
      // seat is not this browser's to read.
      await expect(tableButton(second)).toHaveCount(0);

      // The fresh-session button is offered once a retry has failed.
      await second.getByRole("button", { name: "Try Again" }).click();
      const startFresh = second.getByRole("button", { name: "Start a Fresh Session" });
      await expect(startFresh).toBeVisible({ timeout: 20_000 });
      second.once("dialog", (dialog) => void dialog.accept());
      await startFresh.click();

      // A new player, at the table (typing the table password once if this tab had not kept
      // it), with the ordinary way to DM mode and none of the DM's.
      const password = second.getByPlaceholder("Table password");
      await expect(password.or(tableButton(second))).toBeVisible({ timeout: 30_000 });
      if (await password.isVisible()) {
        await password.fill(TABLE_PASSWORD);
        await second.getByRole("button", { name: /Enter Table/i }).click();
      }
      await expect(tableButton(second)).toBeVisible({ timeout: 30_000 });
      expect(await uidOf(second)).not.toBe(seat);
      expect(await viewerIsDM(second)).toBe(false);
      await expect(tableButton(second)).toHaveAttribute("aria-label", /, Player, online/);
    } finally {
      await otherDevice.close();
    }

    // The first browser was never touched: still seated, still the DM.
    expect(await uidOf(first)).toBe(seat);
    expect(await viewerIsDM(first)).toBe(true);
    await expect(tableButton(first)).toHaveAttribute("aria-label", /Dungeon Master, online/);
  });
});
