/**
 * HP numbers on a touch screen are tappable targets, not 10x11px text.
 *
 * A character's current and max HP (and, on the desktop card, temp HP) open a
 * number field when their viewer may edit them (the owner; the DM). They were
 * underlined spans about 10x11px — far under the 44px floor, and outside the
 * floor's rules, which reach buttons and fields only. They are buttons now,
 * each with a 44px box of its own (herobyte.css, .hp-bar__value).
 *
 * The numbers sit about 30px apart, so "44px each" is not enough on its own:
 * centred 44px overlays would overlap and one would steal the other's taps. So
 * each box is hit-tested at its four corners — a corner another number covered
 * would name that number instead.
 *
 * The rule is scoped to `(pointer: coarse)`, which is why this lives in the
 * mobile project (Pixel 7). A phone's Party screen also lifts every button to
 * 44px tall (the surface rule), so the touchscreen desktop case is what pins
 * the number's own height.
 */
import type { Locator } from "@playwright/test";
import { expect, test } from "../fixtures";
import { openCharacterDetails, ownRosterRow } from "../party.helpers";
import { joinMobileTable } from "./mobile.helpers";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

/** The element at each of the box's corners (2px in), as an HP button's label. */
async function cornerOwners(target: Locator): Promise<string[]> {
  return target.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const corners: [number, number][] = [
      [box.left + 2, box.top + 2],
      [box.right - 2, box.top + 2],
      [box.left + 2, box.bottom - 2],
      [box.right - 2, box.bottom - 2],
    ];
    return corners.map(([x, y]) => {
      const hit = document.elementFromPoint(x, y)?.closest("button");
      return hit?.getAttribute("aria-label") ?? "nothing";
    });
  });
}

/** At least 44px square, and every corner of it is this number's own. */
async function isItsOwnTarget(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const label = await target.getAttribute("aria-label");
  expect(box.width, `${label} is ${Math.round(box.width)}px wide`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label} is ${Math.round(box.height)}px tall`).toBeGreaterThanOrEqual(44);
  expect(await cornerOwners(target)).toEqual([label, label, label, label]);
}

test.describe("HP numbers on a touch screen", () => {
  test("a phone's are each their own 44px target, and a tap edits one", async ({ page }) => {
    await joinMobileTable(page);
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: "Party", exact: true })
      .tap();
    const party = page.getByRole("dialog", { name: "Party Members" });

    // A player edits their own row's numbers only: one of each.
    const current = party.getByRole("button", { name: /^Set current HP: / });
    const max = party.getByRole("button", { name: /^Set max HP: / });
    await expect(current).toHaveCount(1);
    await expect(max).toHaveCount(1);
    await isItsOwnTarget(current);
    await isItsOwnTarget(max);

    // A real tap opens the field, and what is typed there is the new HP.
    await current.tap();
    const field = party.locator('input[type="number"]');
    await expect(field).toBeFocused();
    await field.fill("33");
    await field.press("Enter");
    await expect(party.getByRole("button", { name: "Set current HP: 33" })).toBeVisible();
  });

  test("a touchscreen desktop's card gives them the same targets", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?mobile=false");
    await page.getByPlaceholder("Table password").fill(ROOM_PASSWORD);
    await page.getByRole("button", { name: /Enter Table/i }).click();
    await expect(page.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 15_000 });
    // The desktop layout with a coarse pointer: what the rule is scoped by.
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

    await openCharacterDetails(page, ownRosterRow(page));
    for (const name of [/^Set current HP: /, /^Set max HP: /, /^Set temp HP: /]) {
      const target = page.getByRole("button", { name });
      await expect(target).toHaveCount(1);
      await isItsOwnTarget(target);
    }
  });
});
