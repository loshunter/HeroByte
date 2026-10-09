/**
 * Personal colour (C1) on a phone: the row's ⚙️ EDIT sheet carries the colour
 * picker, its suggested spots are 44px taps, and one tap commits a colour the
 * table keeps (read back from the room snapshot, not the component).
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

test.describe("mobile colour picker", () => {
  test("a phone picks a free colour in one tap from the EDIT sheet", async ({ page }) => {
    await joinMobileTable(page);
    const colour = () =>
      page.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        return data.snapshot?.characters.find(
          (character) => character.ownedByPlayerUID === data.uid && character.type === "pc",
        )?.color;
      });
    await expect.poll(colour).toMatch(/^#[0-9a-f]{6}$/);
    const before = await colour();

    await page.getByRole("button", { name: /Party/i }).click();
    await page.getByRole("button", { name: /EDIT/i }).click();
    await expect(page.getByRole("slider", { name: /'s colour$/ })).toBeVisible();

    const spots = page.getByRole("button", { name: /^Suggested colour \d, #[0-9a-f]{6}$/ });
    await expect(spots).toHaveCount(3);
    for (const spot of await spots.all()) {
      const box = (await spot.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // The handle's touch target reaches 22 px past its 28 px dot on every side (50 px).
    const handle = page.getByRole("slider", { name: /'s colour$/ });
    const reach = await handle.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const x = box.left + box.width / 2 + 24;
      const y = box.top + box.height / 2;
      return document.elementFromPoint(x, y) === element;
    });
    expect(reach).toBe(true);

    // The sheet fits the phone: the window and the preview stay inside the screen.
    const fits = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [".color-picker__window", ".color-picker__preview"].every((selector) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return box.left >= 0 && box.right <= width;
      });
    });
    expect(fits).toBe(true);

    await spots.first().tap();
    await expect.poll(colour).not.toBe(before);
    await expect(page.getByLabel("Colour code")).toHaveText((await colour())!);
  });
});
