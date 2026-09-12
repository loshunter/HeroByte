/**
 * F3 of the keyboard-movement arc: a DM-owned character with an initiative is
 * a combatant. Rolled into the fight, the DM's OWN character leaves the DM
 * group for the order — on the DM's screen and on a PLAYER's — wears a plate
 * budget, is charged by a step, and has that budget refilled when its turn
 * starts, the same road as a player's. After END COMBAT it comes home.
 */
import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

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

const readCharacter = (page: Page, id: string) =>
  page.evaluate((characterId) => {
    const c = window.__HERO_BYTE_E2E__!.snapshot!.characters.find((x) => x.id === characterId)!;
    return { movementUsed: c.movementUsed, initiative: c.initiative };
  }, id);

async function ownCharacter(page: Page) {
  await page.waitForFunction(
    () => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(
        data?.snapshot?.characters?.some((c) => c.ownedByPlayerUID === data.uid && c.tokenId),
      );
    },
    undefined,
    { timeout: 10_000 },
  );
  return page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__!;
    const c = data.snapshot!.characters.find((x) => x.ownedByPlayerUID === data.uid && x.tokenId)!;
    return { id: c.id, tokenId: c.tokenId!, name: c.name };
  });
}

const cardOf = (page: Page, name: string) =>
  page.locator(".player-card-shell").filter({ hasText: name }).first();
const inDmGroup = (page: Page, name: string) =>
  cardOf(page, name).evaluate((el) => Boolean(el.closest(".entities-panel-dm-group")));
const inOrder = (page: Page, name: string) =>
  cardOf(page, name).evaluate((el) => Boolean(el.closest(".entities-panel-card-grid")));

test.describe("the DM's own character in the order (F3)", () => {
  test("rolled, it stands in the order (on a player's screen too) with a plate budget; a step charges it; its turn start refills it; END COMBAT sends it home", async ({
    page,
    browser,
  }) => {
    const playerContext = await browser.newContext();
    const player = await playerContext.newPage();
    let stepped = false;
    let me = { id: "", tokenId: "", name: "" };
    try {
      await joinDefaultRoomAsDM(page);
      // A quiet table, established rather than inherited: no fight, no rolls —
      // and a speed of OUR choosing (35), so the plate's numbers are this
      // character's and not the default every other plate wears.
      await send(page, { t: "end-combat" });
      await send(page, { t: "clear-all-initiative" });
      me = await ownCharacter(page);
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
      await joinDefaultRoom(player);
      await player.waitForFunction(
        (id) => window.__HERO_BYTE_E2E__?.snapshot?.characters?.some((c) => c.id === id),
        me.id,
        { timeout: 10_000 },
      );
      await expect(player.locator(".player-card-shell").filter({ hasText: me.name })).toHaveCount(
        1,
      );
      const card = () => cardOf(page, me.name);

      // Before the roll: the bench (the DM group), no plate budget anywhere.
      // Exactly one card carries the name — a leftover from another spec
      // would make `.first()` silently pick one.
      await expect(page.locator(".player-card-shell").filter({ hasText: me.name })).toHaveCount(1);
      await expect(card()).toBeVisible();
      expect(await inDmGroup(page, me.name)).toBe(true);
      await expect.poll(() => readouts(page), { timeout: 5_000 }).toEqual([]);

      await send(page, { t: "set-initiative", characterId: me.id, initiative: 15 });
      await send(page, { t: "start-combat" });

      // In the order: out of the DM group, wearing the current-turn mark (the
      // auto-start put the turn on the only combatant), and the ONLY plate.
      await expect.poll(() => inDmGroup(page, me.name), { timeout: 5_000 }).toBe(false);
      expect(await inOrder(page, me.name)).toBe(true);
      await expect(card()).toHaveClass(/player-card-shell--current-turn/);
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "35 / 35 ft" }]);
      // The player's screen agrees: the same card in the order, the same plate.
      await expect.poll(() => inDmGroup(player, me.name), { timeout: 5_000 }).toBe(false);
      expect(await inOrder(player, me.name)).toBe(true);
      await expect
        .poll(() => readouts(player), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "35 / 35 ft" }]);

      // A step charges it, like anyone's — the snapshot is the witness, the
      // plate (on both screens) the rendering.
      await send(page, { t: "step-object", ids: [`token:${me.tokenId}`], dx: 1, dy: 0 });
      stepped = true; // armed at the send: a failed assertion must still walk it back
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.movementUsed), { timeout: 5_000 })
        .toBe(5);
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "30 / 35 ft" }]);
      await expect
        .poll(() => readouts(player), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "30 / 35 ft" }]);

      // Its turn start refills it: the only combatant, so next-turn wraps onto it.
      await send(page, { t: "next-turn" });
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.movementUsed), { timeout: 5_000 })
        .toBe(0);
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toEqual([{ name: me.name, text: "35 / 35 ft" }]);

      // END COMBAT keeps the roll on file — and the card comes home to the bench.
      await send(page, { t: "end-combat" });
      await expect.poll(() => inDmGroup(page, me.name), { timeout: 5_000 }).toBe(true);
      expect((await readCharacter(page, me.id)).initiative).toBe(15);
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
      await playerContext.close();
    }
  });
});
