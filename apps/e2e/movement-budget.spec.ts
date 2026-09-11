/**
 * The movement budget — slice 3 of the keyboard-movement arc, on the desktop.
 *
 * In combat, every keyboard step charges the character's budget SERVER-side
 * under the table's diagonal rule; the token's nameplate reads what is left
 * over the DM-set speed; the budget resets when the character's turn starts
 * and vanishes when combat ends. A monster's budget never reaches a player.
 *
 * The mover is a PLAYER in its own context: a DM-owned PC is deliberately not
 * a combatant (shouldCharacterParticipateInCombat), so it never gets a turn
 * start and could never show the turn-start reset this pins. The third test
 * is F2's: the DM zeroes a spend from the card's settings — the budget is
 * advisory, and that is the DM's lever besides the turn.
 */
import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

const selectTool = (page: Page) => page.locator('button[title="Select multiple objects"]');

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
    const character = data.snapshot!.characters.find(
      (c) => c.ownedByPlayerUID === data.uid && c.tokenId,
    )!;
    return { id: character.id, tokenId: character.tokenId! };
  });
}

const send = (page: Page, message: unknown) =>
  page.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);

const readCharacter = (page: Page, id: string) =>
  page.evaluate((characterId) => {
    const c = window.__HERO_BYTE_E2E__!.snapshot!.characters.find((x) => x.id === characterId)!;
    return { speed: c.speed, movementUsed: c.movementUsed, initiative: c.initiative };
  }, id);

const characterIds = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.characters.map((c) => c.id));

/** Every movement readout drawn on the canvas, by Konva node name. */
const readouts = (page: Page) =>
  page.evaluate(() => {
    const stage = (
      window as unknown as {
        Konva: {
          stages: Array<{
            find: (s: string) => Array<{
              text: () => string;
              fontSize: () => number;
              fill: () => string;
            }>;
          }>;
        };
      }
    ).Konva.stages[0];
    return stage
      .find(".token-move-budget")
      .map((node) => ({ text: node.text(), fill: node.fill() }));
  });

const GOLD = "#e0a83c";
const RED = "#d63c53";

/** The DM sets a character's speed through the card's settings menu (the portrait opens it). */
async function setSpeedFromCard(dm: Page, characterName: string, speed: string) {
  const card = dm.locator(".player-card-shell", { hasText: characterName }).first();
  await card.getByRole("button", { name: "Change portrait" }).click();
  const field = dm.getByLabel("Movement speed in feet per turn");
  await field.fill(speed);
  await field.press("Enter");
  await dm.keyboard.press("Escape");
}

/** Advance the order until it is `characterId`'s turn (others may be in it). */
async function advanceToTurnOf(dm: Page, characterId: string) {
  for (let hops = 0; hops < 12; hops += 1) {
    await send(dm, { t: "next-turn" });
    await dm.waitForTimeout(150);
    const turn = await dm.evaluate(
      () => window.__HERO_BYTE_E2E__!.snapshot!.currentTurnCharacterId,
    );
    if (turn === characterId) return;
  }
  throw new Error(`the order never reached ${characterId}`);
}

test.describe("movement budget", () => {
  test("keyboard steps charge the budget, the nameplate reads it, a turn start resets it", async ({
    page,
    browser,
  }) => {
    const dmContext = await browser.newContext();
    const dm = await dmContext.newPage();
    try {
      await joinDefaultRoomAsDM(dm);
      await joinDefaultRoom(page);
      const me = await ownCharacter(page);

      // The DM puts me in the order and sets 25 ft per turn THROUGH THE UI —
      // the card's settings menu — then starts combat. The speed landing on
      // MY page, keyed by my character, proves the desktop binding.
      await send(dm, { t: "set-initiative", characterId: me.id, initiative: 15 });
      const myName = await page.evaluate(
        (id) => window.__HERO_BYTE_E2E__!.snapshot!.characters.find((c) => c.id === id)!.name,
        me.id,
      );
      await setSpeedFromCard(dm, myName, "25");
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.speed), { timeout: 5_000 })
        .toBe(25);
      await send(dm, { t: "start-combat" });
      await expect
        .poll(() => readCharacter(page, me.id), { timeout: 5_000 })
        .toEqual({ speed: 25, movementUsed: 0, initiative: 15 });
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toContainEqual({ text: "25 / 25 ft", fill: GOLD });

      // Two orthogonal steps: 10 ft under every rule.
      await selectTool(page).click();
      const uid = await page.evaluate(() => window.__HERO_BYTE_E2E__!.uid);
      await send(page, { t: "select-object", uid, objectId: `token:${me.tokenId}` });
      await page.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__!;
          const entry = data.snapshot!.selectionState?.[data.uid!];
          return entry?.mode === "single" && entry.objectId === id;
        },
        `token:${me.tokenId}`,
        { timeout: 5_000 },
      );
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.movementUsed), { timeout: 5_000 })
        .toBe(5);
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.movementUsed), { timeout: 5_000 })
        .toBe(10);
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toContainEqual({ text: "15 / 25 ft", fill: GOLD });

      // My turn comes round again: the budget starts over.
      await advanceToTurnOf(dm, me.id);
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.movementUsed), { timeout: 5_000 })
        .toBe(0);
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toContainEqual({ text: "25 / 25 ft", fill: GOLD });

      // Overspend: a 5 ft speed and two steps — the readout goes negative and red.
      await send(dm, { t: "set-character-speed", characterId: me.id, speed: 5 });
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toContainEqual({ text: "-5 / 5 ft", fill: RED });
      // And back to the default by emptying the field: the plate reads 30 again.
      await setSpeedFromCard(dm, myName, "");
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.speed), { timeout: 5_000 })
        .toBeUndefined();

      // Combat off: no budget on any plate.
      await send(dm, { t: "end-combat" });
      await expect.poll(() => readouts(page), { timeout: 5_000 }).toEqual([]);
    } finally {
      await send(dm, { t: "end-combat" }).catch(() => undefined);
      await dmContext.close();
    }
  });

  test("a monster's budget never reaches a player's frame; a party member's does", async ({
    page,
    browser,
  }) => {
    const playerContext = await browser.newContext();
    const player = await playerContext.newPage();
    let npcId: string | undefined;
    try {
      await joinDefaultRoomAsDM(page);
      await joinDefaultRoom(player);
      const pc = await ownCharacter(player);

      // The allocator renames NPCs ("Budget Goblin 1"), so find it by id diff.
      const before = new Set(await characterIds(page));
      await send(page, { t: "create-npc", name: "Budget Goblin", hp: 7, maxHp: 7 });
      await page.waitForFunction(
        (known) =>
          window.__HERO_BYTE_E2E__!.snapshot!.characters.some((c) => !known.includes(c.id)),
        [...before],
        { timeout: 5_000 },
      );
      npcId = (await characterIds(page)).find((id) => !before.has(id));
      await send(page, { t: "place-npc-token", id: npcId });
      await send(page, { t: "set-character-speed", characterId: npcId, speed: 40 });
      await send(page, { t: "set-initiative", characterId: npcId, initiative: 9 });
      await send(page, { t: "set-initiative", characterId: pc.id, initiative: 15 });
      await send(page, { t: "start-combat" });
      await expect
        .poll(() => readCharacter(page, npcId!), { timeout: 5_000 })
        .toMatchObject({ speed: 40, movementUsed: 0 });

      // The player's frame: their PC's budget fields present, the NPC's absent.
      await expect
        .poll(
          () =>
            player.evaluate(
              ({ pcId, goblinId }) => {
                const characters = window.__HERO_BYTE_E2E__!.snapshot!.characters;
                const mine = characters.find((c) => c.id === pcId);
                const goblin = characters.find((c) => c.id === goblinId);
                return {
                  pcHasBudget: mine !== undefined && "movementUsed" in mine,
                  goblinSeen: goblin !== undefined,
                  goblinLeaks:
                    goblin !== undefined && ("movementUsed" in goblin || "speed" in goblin),
                };
              },
              { pcId: pc.id, goblinId: npcId },
            ),
          { timeout: 5_000 },
        )
        .toEqual({ pcHasBudget: true, goblinSeen: true, goblinLeaks: false });
    } finally {
      await send(page, { t: "end-combat" }).catch(() => undefined);
      if (npcId) await send(page, { t: "delete-npc", id: npcId }).catch(() => undefined);
      await playerContext.close();
    }
  });

  test("the DM resets a player's spend from the card, mid-turn: the readout returns to full", async ({
    page,
    browser,
  }) => {
    const dmContext = await browser.newContext();
    const dm = await dmContext.newPage();
    try {
      await joinDefaultRoomAsDM(dm);
      await joinDefaultRoom(page);
      const me = await ownCharacter(page);
      await send(dm, { t: "set-initiative", characterId: me.id, initiative: 15 });
      await send(dm, { t: "start-combat" });
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toContainEqual({ text: "30 / 30 ft", fill: GOLD });

      // Two steps: 10 ft spent.
      await selectTool(page).click();
      const uid = await page.evaluate(() => window.__HERO_BYTE_E2E__!.uid);
      await send(page, { t: "select-object", uid, objectId: `token:${me.tokenId}` });
      await page.waitForFunction(
        (id) => {
          const data = window.__HERO_BYTE_E2E__!;
          const entry = data.snapshot!.selectionState?.[data.uid!];
          return entry?.mode === "single" && entry.objectId === id;
        },
        `token:${me.tokenId}`,
        { timeout: 5_000 },
      );
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.movementUsed), { timeout: 5_000 })
        .toBe(10);

      // The DM's card: the settings menu shows the spend and offers the reset
      // — the budget is advisory, this is the DM's one lever besides the turn.
      const myName = await page.evaluate(
        (id) => window.__HERO_BYTE_E2E__!.snapshot!.characters.find((c) => c.id === id)!.name,
        me.id,
      );
      const card = dm.locator(".player-card-shell", { hasText: myName }).first();
      await card.getByRole("button", { name: "Change portrait" }).click();
      await expect(dm.getByText("Used 10 ft")).toBeVisible({ timeout: 5_000 });
      const reset = dm.getByRole("button", { name: "Reset movement budget" });
      await expect(reset).toBeEnabled();
      await reset.click();
      await expect
        .poll(() => readCharacter(page, me.id).then((c) => c.movementUsed), { timeout: 5_000 })
        .toBe(0);
      await expect
        .poll(() => readouts(page), { timeout: 5_000 })
        .toContainEqual({ text: "30 / 30 ft", fill: GOLD });
      // Nothing left to reset: the control goes inert rather than sending a no-op.
      await expect(dm.getByText("Used 0 ft")).toBeVisible();
      await expect(reset).toBeDisabled();
      await dm.keyboard.press("Escape");
    } finally {
      await send(dm, { t: "end-combat" }).catch(() => undefined);
      await dmContext.close();
    }
  });
});
