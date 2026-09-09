/**
 * The movement budget's phone surface. A DM sets a character's speed from
 * the party drawer's EDIT sheet (the same settings menu that carries the
 * sight radius), on the 44px floor; the token's nameplate — shared with the
 * desktop — then reads remaining / speed once combat is on.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

const send = (page: Page, message: unknown) =>
  page.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);

test.describe("mobile — movement budget", () => {
  test("a DM sets a speed from the party sheet, and the nameplate reads the budget", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await elevateToDM(page);
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
    const me = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      const c = data.snapshot!.characters.find(
        (x) => x.ownedByPlayerUID === data.uid && x.tokenId,
      )!;
      return { id: c.id, name: c.name };
    });

    // Party → my row's EDIT → the speed field, through the real sheet.
    await page.getByRole("button", { name: /party/i }).click();
    await page.getByRole("button", { name: /EDIT/ }).first().click();
    const field = page.getByLabel("Movement speed in feet per turn");
    await field.scrollIntoViewIfNeeded();
    await expect(field).toBeVisible();
    const box = (await field.boundingBox())!;
    expect(box.height, "the speed input sits on the 44px floor").toBeGreaterThanOrEqual(44);
    await field.fill("25");
    await field.press("Enter");
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) => window.__HERO_BYTE_E2E__!.snapshot!.characters.find((c) => c.id === id)?.speed,
            me.id,
          ),
        { timeout: 5_000 },
      )
      .toBe(25);

    // Combat on with me in the order → the plate reads it. The map stays
    // mounted behind the party screen, so the stage is readable as is.
    await send(page, { t: "set-initiative", characterId: me.id, initiative: 14 });
    await send(page, { t: "start-combat" });
    try {
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const stage = (
                window as unknown as {
                  Konva: {
                    stages: Array<{
                      find: (s: string) => Array<{ text: () => string; fontSize: () => number }>;
                    }>;
                  };
                }
              ).Konva.stages[0];
              return stage
                .find(".token-move-budget")
                .map((node) => ({ text: node.text(), size: node.fontSize() }));
            }),
          { timeout: 5_000 },
        )
        .toContainEqual({ text: "25 / 25 ft", size: 11 });
    } finally {
      await send(page, { t: "end-combat" });
    }
  });
});
