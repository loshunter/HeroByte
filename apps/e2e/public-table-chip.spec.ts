/**
 * The public-table chip must not swallow the header's clicks.
 *
 * It is position:fixed at z-index 199 with pointer-events on, centred in the
 * same band as the header — so its WIDTH decides which header buttons can
 * still be reached. Raising it from 7px to 11px for readability took it to
 * 682px and straight across "Draw Tools": elementFromPoint at that button's
 * centre returned the chip, and six specs in ui-state.spec.ts each sat out a
 * full timeout waiting to click something that was covered.
 *
 * That failure presents as a hang, not as a diff — the suite went from 3.5
 * minutes to over 25 with no assertion mentioning the chip. Hence a test that
 * names the cause directly.
 */
import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

test.describe("the public table chip", () => {
  test("is visible without covering any header control", async ({ page }) => {
    await joinDefaultRoom(page);

    const chip = page.getByTestId("public-table-chip");
    await expect(chip).toBeVisible();

    const covered = await page.evaluate(() => {
      const chipEl = document.querySelector('[data-testid="public-table-chip"]')!;
      const blocked: string[] = [];

      for (const button of document.querySelectorAll("button")) {
        const r = button.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        // Three points down the button's centre line, not one. The chip has
        // always grazed the top of this band — currently it ends 7px above the
        // centre of "Draw Tools" — so a bare centre test passes with almost no
        // margin and would only go red once the chip was already unusable.
        // Sampling the upper quarter turns that into a warning instead.
        const x = Math.round(r.left + r.width / 2);
        for (const y of [
          Math.round(r.top + r.height * 0.25),
          Math.round(r.top + r.height * 0.5),
          Math.round(r.top + r.height * 0.75),
        ]) {
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === chipEl || chipEl.contains(hit))) {
            blocked.push((button.textContent || "").trim().slice(0, 30));
            break;
          }
        }
      }
      return blocked;
    });

    expect(covered).toEqual([]);
  });
});
