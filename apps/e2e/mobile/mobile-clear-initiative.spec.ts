/**
 * Clear Initiative on a phone (U10d).
 *
 * The desktop settings window could take a character out of the order; the phone's character
 * sheet had no route, so a player who rolled or typed the wrong initiative could set another but
 * not clear it. It is in the sheet now ("Initiative Status"), beside Status Effects.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

test("a player sets their initiative, then clears it from the phone's character sheet", async ({
  page,
}) => {
  await joinMobileTable(page);
  const hero = () =>
    page.evaluate(() => {
      const snap = window.__HERO_BYTE_E2E__?.snapshot;
      return (
        snap?.characters?.find(
          (c) => c.type === "pc" && c.ownedByPlayerUID === window.__HERO_BYTE_E2E__?.uid,
        ) ?? null
      );
    });
  await page
    .getByRole("navigation", { name: /Mobile actions/i })
    .getByRole("button", { name: "Party", exact: true })
    .tap();
  const party = page.getByRole("dialog", { name: "Party Members" });
  const name = (await hero())!.name;

  // Set one (INIT → Roll d20 now), as the encounter spec does.
  await party.getByRole("button", { name: `Set initiative for ${name}` }).tap();
  await page.getByRole("button", { name: "Roll d20 now" }).tap();
  await expect.poll(async () => (await hero())?.initiative).not.toBeUndefined();

  // Clear it: EDIT → Initiative Status → Clear Initiative.
  await party.getByRole("button", { name: /EDIT/ }).tap();
  const clear = page.getByRole("button", { name: /Clear Initiative/ });
  await clear.scrollIntoViewIfNeeded();
  await expect(clear).toBeEnabled();
  const box = (await clear.boundingBox())!;
  expect(Math.round(box.height), "Clear Initiative height").toBeGreaterThanOrEqual(44);
  await clear.tap();
  await expect.poll(async () => (await hero())?.initiative).toBeUndefined();
  await expect(clear).toBeDisabled();
});
