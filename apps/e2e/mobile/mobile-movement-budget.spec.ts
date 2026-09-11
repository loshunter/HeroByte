/**
 * The movement budget's phone surface. A DM sets a character's speed from
 * the party drawer's EDIT sheet (the same settings menu that carries the
 * sight radius), on the 44px floor; the token's nameplate — shared with the
 * desktop — then reads remaining / speed once combat is on. And (F2) the DM
 * resets that spend from the same sheet, through a button on the floor.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

const send = (page: Page, message: unknown) =>
  page.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);

test.describe("mobile — movement budget", () => {
  test("a DM sets a PLAYER's speed from the party sheet, and the nameplate reads the budget", async ({
    page,
    browser,
  }) => {
    // The mover is a player in its own context: a DM-owned PC is not a
    // combatant, so its plate would (rightly) never wear a budget.
    const playerContext = await browser.newContext();
    const player = await playerContext.newPage();
    try {
      await joinMobileTable(player);
      await player.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          return Boolean(
            data?.snapshot?.characters?.some((c) => c.ownedByPlayerUID === data.uid && c.tokenId),
          );
        },
        undefined,
        { timeout: 10_000 },
      );
      const pc = await player.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const c = data.snapshot!.characters.find(
          (x) => x.ownedByPlayerUID === data.uid && x.tokenId,
        )!;
        return { id: c.id, name: c.name };
      });

      await page.setViewportSize({ width: 375, height: 812 });
      await joinMobileTable(page);
      await elevateToDM(page);
      await page.waitForFunction(
        (id) => window.__HERO_BYTE_E2E__?.snapshot?.characters?.some((c) => c.id === id),
        pc.id,
        { timeout: 10_000 },
      );

      // Party → the PLAYER's row's EDIT → the speed field, through the real sheet.
      await page.getByRole("button", { name: /party/i }).click();
      const row = page.getByTestId("mobile-player-row").filter({ hasText: pc.name }).first();
      await row.getByRole("button", { name: /EDIT/ }).click();
      const field = page.getByLabel("Movement speed in feet per turn");
      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeVisible();
      const box = (await field.boundingBox())!;
      expect(box.height, "the speed input sits on the 44px floor").toBeGreaterThanOrEqual(44);
      await field.fill("25");
      await field.blur(); // a phone keypad has no Enter: the commit is the blur
      await expect
        .poll(
          () =>
            player.evaluate(
              (id) =>
                window.__HERO_BYTE_E2E__!.snapshot!.characters.find((c) => c.id === id)?.speed,
              pc.id,
            ),
          { timeout: 5_000 },
        )
        .toBe(25);

      // Combat on with the player in the order → BOTH canvases read it. The
      // map stays mounted behind the party screen, so the DM's stage is
      // readable as is.
      await send(page, { t: "set-initiative", characterId: pc.id, initiative: 14 });
      await send(page, { t: "start-combat" });
      const readouts = (p: Page) =>
        p.evaluate(() => {
          const stage = (
            window as unknown as {
              Konva: {
                stages: Array<{
                  find: (s: string) => Array<{ text: () => string; fontSize: () => number }>;
                }>;
              };
            }
          ).Konva.stages[0];
          return stage.find(".token-move-budget").map((node) => ({ text: node.text() }));
        });
      try {
        await expect
          .poll(() => readouts(page), { timeout: 5_000 })
          .toContainEqual({ text: "25 / 25 ft" });
        await expect
          .poll(() => readouts(player), { timeout: 5_000 })
          .toContainEqual({ text: "25 / 25 ft" });

        // The player spends 5 ft; the DM resets it from the same EDIT sheet,
        // through a button on the 44px floor (F2 — the budget is advisory).
        const tokenId = await player.evaluate(
          (id) => window.__HERO_BYTE_E2E__!.snapshot!.characters.find((c) => c.id === id)!.tokenId,
          pc.id,
        );
        await send(player, { t: "step-object", ids: [`token:${tokenId}`], dx: 1, dy: 0 });
        await expect
          .poll(() => readouts(player), { timeout: 5_000 })
          .toContainEqual({ text: "20 / 25 ft" });
        const reset = page.getByRole("button", { name: "Reset movement budget" });
        await reset.scrollIntoViewIfNeeded();
        await expect(page.getByText("Used 5 ft")).toBeVisible({ timeout: 5_000 });
        const resetBox = (await reset.boundingBox())!;
        expect(resetBox.height, "the reset sits on the 44px floor").toBeGreaterThanOrEqual(44);
        // The readout and the button share ONE line inside the viewport — at
        // 5 ft and at 10 ft, the width where a sized button once wrapped to a
        // second line (the row is flex-wrap, so a wrap is a taller row, never
        // an overflow: the probe reads the tops, not the widths).
        const budgetRow = () =>
          page.evaluate(() => {
            const button = document.querySelector('button[aria-label="Reset movement budget"]')!;
            const span = button.parentElement!.querySelector("span")!;
            const b = button.getBoundingClientRect();
            const s = span.getBoundingClientRect();
            return {
              text: span.textContent,
              // The row centres its items: the readout's centre sits inside the
              // 44px button's band, and the readout ends before the button starts.
              sameLine:
                (s.top + s.bottom) / 2 >= b.top &&
                (s.top + s.bottom) / 2 <= b.bottom &&
                s.right <= b.left,
              inside: s.left >= 0 && b.right <= innerWidth,
            };
          });
        expect(await budgetRow()).toEqual({ text: "Used 5 ft", sameLine: true, inside: true });
        await send(player, { t: "step-object", ids: [`token:${tokenId}`], dx: 1, dy: 0 });
        await expect(page.getByText("Used 10 ft")).toBeVisible({ timeout: 5_000 });
        expect(await budgetRow()).toEqual({ text: "Used 10 ft", sameLine: true, inside: true });
        await reset.tap();
        await expect
          .poll(() => readouts(player), { timeout: 5_000 })
          .toContainEqual({ text: "25 / 25 ft" });
        await expect(reset).toBeDisabled();
      } finally {
        await send(page, { t: "end-combat" });
      }
    } finally {
      await playerContext.close();
    }
  });

  test("a DM sets a MONSTER's speed from the phone's DM screen — NPCs tab, the editor", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await elevateToDM(page);
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: /^DM$/i })
      .click();
    const dialog = page.getByRole("dialog", { name: "DM Menu" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Map Setup" })).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "NPCs & Monsters" }).click();

    const before = new Set(
      await page.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.characters.map((c) => c.id)),
    );
    await dialog.getByRole("button", { name: "+ Add NPC" }).click();
    await page.waitForFunction(
      (known) => window.__HERO_BYTE_E2E__!.snapshot!.characters.some((c) => !known.includes(c.id)),
      [...before],
      { timeout: 5_000 },
    );
    const npcId = (
      await page.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.characters.map((c) => c.id))
    ).find((id) => !before.has(id))!;
    try {
      // The new NPC's editor is the last one; its speed field is on the floor.
      const field = dialog.getByLabel("Movement speed in feet per turn").last();
      await field.scrollIntoViewIfNeeded();
      const box = (await field.boundingBox())!;
      expect(box.height, "the NPC speed input sits on the 44px floor").toBeGreaterThanOrEqual(44);
      // Five stats now share the editor's row: on a 375px phone they must
      // WRAP, not squeeze — every control of the editor stays inside the
      // viewport's width.
      const overflowing = await page.evaluate(() => {
        const editor = document
          .querySelector('[aria-label="Movement speed in feet per turn"]')!
          .closest("div")!.parentElement!;
        return [...editor.querySelectorAll("input, button")]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.left < 0 || r.right > innerWidth))
          .map((r) => Math.round(r.right));
      });
      expect(overflowing).toEqual([]);
      await field.fill("20");
      await field.blur(); // a phone keypad has no Enter: the commit is the blur
      const readNpc = () =>
        page.evaluate((id) => {
          const c = window.__HERO_BYTE_E2E__!.snapshot!.characters.find((x) => x.id === id);
          return c && { speed: c.speed, movementUsed: c.movementUsed, tokenId: c.tokenId };
        }, npcId);
      await expect.poll(() => readNpc().then((c) => c?.speed), { timeout: 5_000 }).toBe(20);

      // F2: the MONSTER's reset, through the editor's own button and the real
      // wire — the road no other test drives. Place its token, put it in the
      // order, start combat, step it (the DM may move any token), reset.
      await send(page, { t: "place-npc-token", id: npcId });
      const tokenId = await expect
        .poll(() => readNpc().then((c) => c?.tokenId), { timeout: 5_000 })
        .toBeTruthy()
        .then(() => readNpc().then((c) => c!.tokenId!));
      await send(page, { t: "set-initiative", characterId: npcId, initiative: 11 });
      await send(page, { t: "start-combat" });
      try {
        await send(page, { t: "step-object", ids: [`token:${tokenId}`], dx: 1, dy: 0 });
        await expect.poll(() => readNpc().then((c) => c?.movementUsed), { timeout: 5_000 }).toBe(5);
        // The new NPC's editor is the last one (the table may carry others).
        const reset = dialog.getByRole("button", { name: "Reset movement budget" }).last();
        await reset.scrollIntoViewIfNeeded();
        await expect(reset).toBeEnabled({ timeout: 5_000 });
        await reset.tap();
        await expect.poll(() => readNpc().then((c) => c?.movementUsed), { timeout: 5_000 }).toBe(0);
        await expect(reset).toBeDisabled();
      } finally {
        await send(page, { t: "end-combat" }).catch(() => undefined);
      }
    } finally {
      await send(page, { t: "delete-npc", id: npcId });
    }
  });
});
