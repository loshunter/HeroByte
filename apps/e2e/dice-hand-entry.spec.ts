import { test, expect, type Page } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

/**
 * Recording what the table actually threw — the physical-dice path.
 *
 * Two entry points, and they are separate tests because they are separate
 * mechanisms: one RECORDS a number with no server roll behind it, the other
 * REWRITES a roll the server already made. A single test exercising both would
 * pass with the rewrite silently appending instead, which is the exact failure
 * the "in place" decision was made to avoid.
 *
 * Sentinel totals, not small ones: a short number like `11` appears by accident
 * in a timestamp, a uuid, or another roll's breakdown, and an assertion built on
 * one reads as green for the wrong reason.
 */
const ENTERED_TOTAL = 731;
const OVERRIDE_TOTAL = 828;

const rolls = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.diceRolls ?? []);

async function openRoller(page: Page): Promise<void> {
  await joinDefaultRoom(page);
  await page.getByRole("button", { name: "⚂ Dice" }).click();
  await expect(page.getByText("⚂ DICE ROLLER")).toBeVisible();
}

test.describe("dice — entered by hand", () => {
  test("a bare number typed with no dice built reaches the table, marked", async ({ page }) => {
    await openRoller(page);

    // Deliberately NOT building anything first: "I rolled 731, put it on the
    // table" is the fastest path at a physical table, and the control must not
    // be gated on a build the way ROLL is.
    await page.getByTestId("roller-hand-entry-open").click();
    await page.getByTestId("roller-hand-entry-input").fill(String(ENTERED_TOTAL));
    await page.getByTestId("roller-hand-entry-submit").click();

    await expect
      .poll(async () => (await rolls(page)).some((roll) => roll.total === ENTERED_TOTAL), {
        timeout: 15_000,
      })
      .toBe(true);

    const entry = (await rolls(page)).find((roll) => roll.total === ENTERED_TOTAL)!;
    // The marker is the whole point — without it this is indistinguishable
    // from a server roll, which is the deceit the feature exists to avoid.
    expect(entry.handEntered).toBe(true);
    // Nothing to strike: there was no server roll to supersede.
    expect(entry.supersededTotal).toBeUndefined();
    // The total becomes its own notation rather than claiming dice nobody named.
    expect(entry.formula).toBe(String(ENTERED_TOTAL));

    // And it renders as such, in the log both surfaces share.
    await page.getByRole("button", { name: "📜 Log" }).click();
    await expect(page.getByTestId("roll-entered-badge").first()).toHaveText("BY HAND");
  });

  test("overriding a rolled result rewrites that row rather than adding one", async ({ page }) => {
    await openRoller(page);

    const before = (await rolls(page)).length;
    await page.getByRole("button", { name: "Add d20" }).click();
    await page.getByRole("button", { name: "Roll dice" }).click();

    const total = page.getByTestId("roll-result-total");
    await expect(total).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await rolls(page)).length, { timeout: 10_000 }).toBe(before + 1);
    const rolled = (await rolls(page))[before]!;
    expect(rolled.handEntered).toBeUndefined();

    await page.getByTestId("result-hand-entry-open").click();
    await page.getByTestId("result-hand-entry-input").fill(String(OVERRIDE_TOTAL));
    await page.getByTestId("result-hand-entry-submit").click();

    await expect
      .poll(async () => (await rolls(page))[before]?.total, { timeout: 15_000 })
      .toBe(OVERRIDE_TOTAL);

    // ONE row, not two. Appending instead would satisfy every assertion above.
    expect((await rolls(page)).length).toBe(before + 1);

    const rewritten = (await rolls(page))[before]!;
    expect(rewritten.id).toBe(rolled.id);
    expect(rewritten.handEntered).toBe(true);
    // What the server rolled, kept and struck through beside the real number.
    expect(rewritten.supersededTotal).toBe(rolled.total);
  });

  test("a second correction still strikes the SERVER's roll, not the first guess", async ({
    page,
  }) => {
    await openRoller(page);

    const before = (await rolls(page)).length;
    await page.getByRole("button", { name: "Add d20" }).click();
    await page.getByRole("button", { name: "Roll dice" }).click();
    await expect(page.getByTestId("roll-result-total")).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await rolls(page)).length, { timeout: 10_000 }).toBe(before + 1);
    const serverTotal = (await rolls(page))[before]!.total;

    const correct = async (value: number) => {
      await page.getByTestId("result-hand-entry-open").click();
      await page.getByTestId("result-hand-entry-input").fill(String(value));
      await page.getByTestId("result-hand-entry-submit").click();
      await expect
        .poll(async () => (await rolls(page))[before]?.total, { timeout: 15_000 })
        .toBe(value);
    };

    await correct(ENTERED_TOTAL);
    await correct(OVERRIDE_TOTAL);

    // First writer wins: the original is the thing a table would want to audit,
    // and a naive implementation overwrites it on every correction.
    expect((await rolls(page))[before]!.supersededTotal).toBe(serverTotal);
    expect((await rolls(page)).length).toBe(before + 1);
  });
});
