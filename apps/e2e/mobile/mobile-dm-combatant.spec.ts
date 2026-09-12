/**
 * F3 on the phone: the DM's own character, rolled into the fight, is a
 * combatant — its plate wears the budget on the phone canvas, its PARTY row's
 * EDIT sheet reads the spend with a Reset on the 44px floor, and its turn
 * start refills it.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

const send = (page: Page, message: unknown) =>
  page.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);

/** Every movement readout on the canvas, keyed by the nameplate beside it. */
const readouts = (page: Page) =>
  page.evaluate(() => {
    type Node = { text: () => string; getParent: () => { findOne: (s: string) => Node } };
    const stage = (
      window as unknown as { Konva: { stages: Array<{ find: (s: string) => Node[] }> } }
    ).Konva.stages[0];
    return stage.find(".token-move-budget").map((node) => ({
      name: node.getParent().findOne(".token-nameplate").text(),
      text: node.text(),
    }));
  });

const movementUsed = (page: Page, id: string) =>
  page.evaluate(
    (characterId) =>
      window.__HERO_BYTE_E2E__!.snapshot!.characters.find((x) => x.id === characterId)!
        .movementUsed,
    id,
  );

test.describe("mobile — the DM's own character in the order (F3)", () => {
  test("rolled, its plate wears the budget, the EDIT sheet reads the spend on the floor, and the turn refills it", async ({
    page,
  }) => {
    let stepped = false;
    let me = { id: "", tokenId: "", name: "" };
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await joinMobileTable(page);
      await elevateToDM(page);
      await page.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          return Boolean(
            data?.snapshot?.players?.find((p) => p.uid === data.uid)?.isDM &&
              data.snapshot.characters.some((c) => c.ownedByPlayerUID === data.uid && c.tokenId),
          );
        },
        undefined,
        { timeout: 10_000 },
      );
      // A quiet table, established rather than inherited: no fight, no rolls,
      // no plate — and a speed of OUR choosing (35), so the numbers are this
      // character's and not the default every other plate wears.
      await send(page, { t: "end-combat" });
      await send(page, { t: "clear-all-initiative" });
      me = await page.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const c = data.snapshot!.characters.find(
          (x) => x.ownedByPlayerUID === data.uid && x.tokenId,
        )!;
        return { id: c.id, tokenId: c.tokenId!, name: c.name };
      });
      await send(page, { t: "set-character-speed", characterId: me.id, speed: 35 });
      await expect
        .poll(
          () =>
            page.evaluate(
              (id) =>
                window.__HERO_BYTE_E2E__!.snapshot!.characters.find((c) => c.id === id)!.speed,
              me.id,
            ),
          { timeout: 5_000 },
        )
        .toBe(35);
      await expect.poll(() => readouts(page), { timeout: 5_000 }).toEqual([]);

      await send(page, { t: "set-initiative", characterId: me.id, initiative: 15 });
      await send(page, { t: "start-combat" });
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "35 / 35 ft" }]);
      await send(page, { t: "step-object", ids: [`token:${me.tokenId}`], dx: 1, dy: 0 });
      stepped = true; // armed at the send: a failed assertion must still walk it back
      await expect.poll(() => movementUsed(page, me.id), { timeout: 5_000 }).toBe(5);
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "30 / 35 ft" }]);

      // PARTY → the DM's OWN row → EDIT: the spend reads, the Reset is on the floor.
      await page.getByRole("button", { name: /party/i }).click();
      const row = page.getByTestId("mobile-player-row").filter({ hasText: me.name }).first();
      await row.getByRole("button", { name: /EDIT/ }).click();
      await expect(page.getByText("Used 5 ft")).toBeVisible({ timeout: 5_000 });
      const reset = page.getByRole("button", { name: "Reset movement budget" });
      await reset.scrollIntoViewIfNeeded();
      await expect(reset).toBeEnabled();
      const box = (await reset.boundingBox())!;
      expect(box.height, "the reset sits on the 44px floor").toBeGreaterThanOrEqual(44);

      // Its turn start refills it (the only combatant: next-turn wraps onto it),
      // and the sheet follows.
      await send(page, { t: "next-turn" });
      await expect(page.getByText("Used 0 ft")).toBeVisible({ timeout: 5_000 });
      await expect(reset).toBeDisabled();
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "35 / 35 ft" }]);

      // END COMBAT: the roll stays on file, the plate goes (the phone has no
      // bench to come home to; the row's sheet is the same either way).
      await send(page, { t: "end-combat" });
      await expect.poll(() => readouts(page), { timeout: 5_000 }).toEqual([]);
    } finally {
      await send(page, { t: "end-combat" }).catch(() => undefined);
      await send(page, { t: "clear-all-initiative" }).catch(() => undefined);
      if (me.id) {
        await send(page, { t: "set-character-speed", characterId: me.id, speed: null }).catch(
          () => undefined,
        );
      }
      if (stepped) {
        await send(page, { t: "step-object", ids: [`token:${me.tokenId}`], dx: -1, dy: 0 }).catch(
          () => undefined,
        );
      }
    }
  });
});
