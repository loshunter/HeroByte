/**
 * The DM password dialog on a phone. It is the one modal the phone reaches with
 * a password field in it, and it shipped with a 400px minimum width: on a 375px
 * screen a centred box that cannot shrink hangs 12px off both edges, so the
 * field's left edge and the Cancel button's left edge are off the screen.
 *
 * Geometry is MEASURED (boundingBox), never inferred from the CSS.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

const PHONE_WIDTH = 375;

test.describe("mobile — the DM password dialog", () => {
  test("fits a 375px screen: the field and both buttons are fully on it", async ({ page }) => {
    await page.setViewportSize({ width: PHONE_WIDTH, height: 812 });
    await joinMobileTable(page);

    await page.getByRole("button", { name: /Party/i }).click();
    await page.getByRole("button", { name: /EDIT/i }).click();
    await page.getByRole("button", { name: "DM Mode: OFF", exact: true }).click();

    const heading = page.getByRole("heading", { name: "Elevate to DM" });
    await expect(heading).toBeVisible();

    const parts = {
      panel: heading.locator(".."),
      field: page.getByLabel("Enter DM Password:", { exact: true }),
      cancel: page.getByRole("button", { name: "Cancel", exact: true }),
      submit: page.getByRole("button", { name: "Elevate to DM", exact: true }),
    };
    for (const [name, locator] of Object.entries(parts)) {
      const box = await locator.boundingBox();
      expect(box, `${name} is on the page`).not.toBeNull();
      expect(box!.x, `${name} starts on the screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${name} ends on the screen`).toBeLessThanOrEqual(PHONE_WIDTH);
    }
  });
});
