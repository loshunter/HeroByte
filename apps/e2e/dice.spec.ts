import { test, expect } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

/**
 * A total no d20 can roll, and a digit string that will not appear by accident
 * in a timestamp or a uuid. A short sentinel like "999" collides with both.
 */
const FORGED_TOTAL = 424242;
/** A modifier no other roll in these specs uses, so a negative is meaningful. */
const SECRET_MOD = 9973;

test.describe("HeroByte dice", () => {
  test("player can roll a die and see it logged", async ({ page }) => {
    await joinDefaultRoom(page);

    const initialRollCount =
      (await page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.diceRolls?.length ?? 0)) ?? 0;

    const diceToggle = page.getByRole("button", { name: "⚂ Dice" });
    await expect(diceToggle).toBeVisible();
    await diceToggle.click();
    await expect(page.getByText("⚂ DICE ROLLER")).toBeVisible();

    await page.getByRole("button", { name: "Add d20" }).click();
    await page.getByRole("button", { name: "Roll dice" }).click();

    const rollTotal = page.getByTestId("roll-result-total");
    await expect(rollTotal).toBeVisible({ timeout: 10_000 });
    const totalValue = (await rollTotal.textContent())?.trim();
    expect(totalValue).toMatch(/^[0-9]+$/);

    await page.waitForFunction(
      (previousCount) => {
        const data = window.__HERO_BYTE_E2E__;
        const rolls = data?.snapshot?.diceRolls;
        return Array.isArray(rolls) && rolls.length > previousCount;
      },
      initialRollCount,
      { timeout: 10_000 },
    );

    const diceHeader = page.getByText("⚂ DICE ROLLER").first();
    const headerBox = await diceHeader.boundingBox();
    if (headerBox) {
      const startDragX = headerBox.x + headerBox.width / 2;
      const startDragY = headerBox.y + headerBox.height / 2;
      await page.mouse.move(startDragX, startDragY);
      await page.mouse.down();
      await page.mouse.move(startDragX, startDragY + 260, { steps: 10 });
      await page.mouse.up();
    }

    const logToggle = page.getByRole("button", { name: "📜 Log" });
    await expect(logToggle).toBeVisible();
    await logToggle.click();
    await expect(page.getByText("⚂ ROLL LOG")).toBeVisible();

    const logEntry = page.getByTestId("roll-log-entry").first();
    await expect(logEntry).toBeVisible({ timeout: 10_000 });
    await expect(logEntry).toContainText("=");
    const logText = (await logEntry.textContent()) ?? "";
    expect(logText).toMatch(/=\s*\d+/);
    // The log renders the SERVER's formula. It rendered a blank line here for
    // as long as history entries carried no build (S5 fixed both halves).
    expect(logText).toContain("d20");
  });

  test("devtools cannot change a roll, its total, or its author", async ({ page }) => {
    // The S5 acceptance criterion, driven through the real socket. This is
    // exactly what a tampered client would send: a finished roll with someone
    // else's name on it and a total no d20 can produce.
    await joinDefaultRoom(page);

    const before =
      (await page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.diceRolls?.length ?? 0)) ?? 0;

    await page.evaluate((forged) => {
      const e2e = window.__HERO_BYTE_E2E__;
      e2e?.sendMessage?.({
        t: "dice-roll",
        formula: "d20",
        total: forged,
        playerUid: "somebody-else",
        playerName: "The Dungeon Master",
        breakdown: [{ tokenId: "t0", die: "d20", rolls: [forged], subtotal: forged }],
        id: "forged-id",
      } as never);
    }, FORGED_TOTAL);

    await page.waitForFunction(
      (previous) => (window.__HERO_BYTE_E2E__?.snapshot?.diceRolls?.length ?? 0) > previous,
      before,
      { timeout: 10_000 },
    );

    const landed = await page.evaluate(() => {
      const e2e = window.__HERO_BYTE_E2E__;
      const rolls = e2e?.snapshot?.diceRolls ?? [];
      return { roll: rolls[rolls.length - 1], uid: e2e?.uid };
    });

    expect(landed.roll?.total).toBeGreaterThanOrEqual(1);
    expect(landed.roll?.total).toBeLessThanOrEqual(20);
    expect(landed.roll?.playerUid).toBe(landed.uid);
    expect(landed.roll?.playerName).not.toBe("The Dungeon Master");
    expect(landed.roll?.id).not.toBe("forged-id");

    // ...and the claimed number is nowhere in the snapshot the table receives.
    // The sentinel has to be improbable: "999" would collide with the roll's
    // own 13-digit timestamp or its uuid and fail at random.
    const snapshotJson = await page.evaluate(() =>
      JSON.stringify(window.__HERO_BYTE_E2E__?.snapshot?.diceRolls ?? []),
    );
    expect(snapshotJson).not.toContain(String(FORGED_TOTAL));
  });

  test("a private roll never reaches the other player's socket", async ({ browser }) => {
    // Two real clients on the same table. The secrecy contract is asserted on
    // the raw server payload the second client received, not on its UI.
    const roller = await browser.newPage();
    const bystander = await browser.newPage();
    try {
      await joinDefaultRoom(roller);
      await joinDefaultRoom(bystander);

      // Positive control FIRST: prove the bystander's socket really is
      // receiving roll history, so the negative below cannot pass just because
      // nothing ever arrived.
      await roller.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "dice-roll", formula: "d8 + 1" } as never);
      });
      await bystander.waitForFunction(
        () =>
          (window.__HERO_BYTE_E2E__?.snapshot?.diceRolls ?? []).some(
            (roll) => roll.formula === "d8 + 1",
          ),
        undefined,
        { timeout: 10_000 },
      );

      // Now the private one, with a modifier no other roll here uses.
      await roller.evaluate((mod) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "dice-roll",
          formula: `d4 + ${mod}`,
          visibility: "self",
        } as never);
      }, SECRET_MOD);

      await roller.waitForFunction(
        (mod) =>
          (window.__HERO_BYTE_E2E__?.snapshot?.diceRolls ?? []).some((roll) =>
            roll.formula.includes(String(mod)),
          ),
        SECRET_MOD,
        { timeout: 10_000 },
      );

      // Give the bystander's socket the same chance to receive it.
      await bystander.waitForTimeout(1_000);
      const seen = await bystander.evaluate(() =>
        JSON.stringify(window.__HERO_BYTE_E2E__?.snapshot?.diceRolls ?? []),
      );
      expect(seen).toContain("d8 + 1"); // the control is still there...
      expect(seen).not.toContain(String(SECRET_MOD)); // ...and the private roll never was
    } finally {
      await roller.close();
      await bystander.close();
    }
  });
});
