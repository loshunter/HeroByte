/**
 * The DM password dialog on a phone. It is the one modal the phone reaches with
 * a password field in it, and it shipped with a 400px minimum width: on a 375px
 * screen a centred box that cannot shrink hangs about 38px off both edges (its
 * 452px outside width is 77px wider than the screen), so the
 * field's left edge and the Cancel button's left edge are off the screen.
 *
 * Reached the way a host reaches it (U9): Tools → Table → Enter DM mode.
 *
 * Geometry is MEASURED (boundingBox), never inferred from the CSS.
 */
import { expect, test } from "../fixtures";
import { openTableScreen } from "../table-role.helpers";
import { joinMobileTable } from "./mobile.helpers";

const PHONE_WIDTH = 375;

test.describe("mobile — the DM password dialog", () => {
  test("fits a 375px screen: the field and both buttons are fully on it", async ({ page }) => {
    await page.setViewportSize({ width: PHONE_WIDTH, height: 812 });
    await joinMobileTable(page);

    const table = await openTableScreen(page);
    await table.getByRole("button", { name: "Enter DM mode", exact: true }).tap();

    const dialog = page.getByRole("dialog", { name: "Enter DM mode" });
    await expect(dialog).toBeVisible();

    const parts = {
      panel: dialog,
      field: dialog.getByLabel("DM password", { exact: true }),
      cancel: dialog.getByRole("button", { name: "Cancel", exact: true }),
      submit: dialog.getByRole("button", { name: "Enter DM mode", exact: true }),
    };
    for (const [name, locator] of Object.entries(parts)) {
      const box = await locator.boundingBox();
      expect(box, `${name} is on the page`).not.toBeNull();
      expect(box!.x, `${name} starts on the screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${name} ends on the screen`).toBeLessThanOrEqual(PHONE_WIDTH);
    }
  });
});
