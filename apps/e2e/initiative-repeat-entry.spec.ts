import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

/**
 * A hand entry EQUAL to the number already on file.
 *
 * The modal confirmed a save by noticing the character's initiative CHANGE.
 * A physical-die entry matching the roll on file changes nothing, so the
 * server applied it, logged it "by hand", and the modal sat five seconds
 * then said "Initiative update timed out" over a table that had moved on —
 * and stayed open, its overlay swallowing the next click on the toolbar.
 * One d20 face in twenty; the e2e suite hit it three times in two days.
 *
 * Lives in its own file because `player-npc-initiative-ui.spec.ts` is at the
 * 350-line guard; the two helpers below are that file's, cut to size.
 */

const myCharacter = (page: Page) =>
  page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    return (data?.snapshot?.characters ?? []).find((c) => c.ownedByPlayerUID === data?.uid) ?? null;
  });

const rolls = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.diceRolls ?? []);

async function openInitiativeModal(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { name: "ENTITIES" });
  if (!(await heading.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /show entities/i }).click();
  }
  await page.getByRole("button", { name: "Set Initiative" }).first().click();
  await expect(page.getByRole("button", { name: "Roll Initiative" })).toBeVisible();
}

test.describe("initiative — a hand entry that matches the number on file", () => {
  test("saves, closes the modal, and never reports a timeout", async ({ page }) => {
    await joinDefaultRoom(page);

    await openInitiativeModal(page);
    await page.getByRole("button", { name: "Roll Initiative" }).click();
    await expect
      .poll(async () => (await myCharacter(page))?.initiative, { timeout: 15_000 })
      .toEqual(expect.any(Number));
    const onFile = (await myCharacter(page))!.initiative!;
    const before = (await rolls(page)).length;

    await openInitiativeModal(page);
    await page.getByRole("button", { name: "Use Physical Dice" }).click();
    await page.getByPlaceholder("Enter roll...").fill(String(onFile));
    await page.getByRole("button", { name: "Save" }).click();

    // The modal is GONE — not "Setting..." for five seconds, not reopened
    // with an error. The timeout fires at 5 s, so a 15 s bound sees it.
    await expect(page.getByRole("button", { name: "Roll Initiative" })).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByText("Initiative update timed out")).toHaveCount(0);

    // And the server did take it: a by-hand row, superseding the roll.
    await expect
      .poll(async () => (await rolls(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(before);
    const entry = (await rolls(page))[before]!;
    expect(entry.handEntered).toBe(true);
    expect(entry.supersededTotal).toBe(onFile);
    expect((await myCharacter(page))!.initiative).toBe(onFile);

    // The toolbar is reachable again — the bug's user-visible symptom.
    await page.getByRole("button", { name: "📜 Log" }).click();
    await expect(page.getByTestId("roll-entered-badge").first()).toHaveText("BY HAND");
  });
});
