/**
 * Temp HP on a phone (U10d).
 *
 * The phone's HP bar used to be handed a Temp HP handler that did nothing, so a player could not
 * track temporary hit points on their own phone mid-combat although the desktop card, the server
 * and the bar all support it. The number is a 44px button on the player's own row; a tap opens a
 * named field, and what is typed there is the new temp HP.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

test("a player sets their own temp HP from the phone's Party screen", async ({ page }) => {
  await joinMobileTable(page);
  await page
    .getByRole("navigation", { name: /Mobile actions/i })
    .getByRole("button", { name: "Party", exact: true })
    .tap();
  const party = page.getByRole("dialog", { name: "Party Members" });

  // One editor, on the viewer's own row, a real 44px target.
  const temp = party.getByRole("button", { name: /^Set temp HP: / });
  await expect(temp).toHaveCount(1);
  await temp.scrollIntoViewIfNeeded();
  const box = (await temp.boundingBox())!;
  expect(Math.round(box.width), "temp HP button width").toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height), "temp HP button height").toBeGreaterThanOrEqual(44);

  await temp.tap();
  const field = party.getByRole("spinbutton", { name: "Temp HP" });
  await expect(field).toBeFocused();
  await field.fill("7");
  await field.press("Enter");

  // The row now reads 7 (the server accepted it and the snapshot came back).
  await expect(party.getByRole("button", { name: "Set temp HP: 7" })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const snap = window.__HERO_BYTE_E2E__?.snapshot;
        return snap?.characters?.find((c) => c.name && c.type === "pc")?.tempHp ?? null;
      }),
    )
    .toBe(7);
});
