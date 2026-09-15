/**
 * The shelf and the stance, on a phone (G3 and G4's mobile surfaces).
 *
 * G3 — the shelf's ✕.
 *
 * The 44px floor lifts every bare <button> inside a mobile surface, and the
 * remove control was an ABSOLUTE 22px overlay pinned to the cell's top-right:
 * lifted to 44px it grew DOWNWARD over the thumbnail it sits on, so a tap
 * meant for "pick this token" could land on "remove it" instead — the same
 * shape as the dice chip's ✕ badge, on a control whose action is destructive.
 *
 * On a coarse pointer it is a full-width bar UNDER the cell. What this proves
 * is the geometry no unit test can see: the bar is pressable at the floor, and
 * it does not cover the picture.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable, undersizedControls } from "./mobile.helpers";

/** A same-origin image the validator accepts — the pack's own thumbnail tier. */
const IMAGE = "/tokens/Thumbs/NPC/Civilians/Tavern/npcHumanBartender.png";

async function openDMScreen(page: Page): Promise<void> {
  await elevateToDM(page);
  await page
    .getByRole("navigation", { name: /Mobile actions/i })
    .getByRole("button", { name: /^DM$/i })
    .click();
  const dialog = page.getByRole("dialog", { name: "DM Menu" });
  await expect(dialog).toBeVisible();
  // The menu is a lazy chunk on mobile exactly as on desktop — wait for it.
  await expect(page.getByRole("button", { name: "Map Setup" })).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "NPCs & Monsters" }).click();
}

/** …and on into the Library's Custom shelf, where the ✕ lives. */
async function openShelf(page: Page): Promise<void> {
  await openDMScreen(page);
  const dialog = page.getByRole("dialog", { name: "DM Menu" });
  const library = dialog.getByRole("button", { name: "📖 Library" });
  await library.scrollIntoViewIfNeeded();
  await library.click();
  await dialog.getByRole("button", { name: "Custom" }).click();
}

test.describe("mobile — the shelf and the stance", () => {
  test("the NPC editor's Stance is reachable and at the floor on a phone", async ({ page }) => {
    // Every slice ships its mobile surface. The coarse-pointer floor lifts a
    // <select> inside a mobile surface — this is the check that it actually
    // reaches THIS one rather than the assumption that it must.
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openDMScreen(page);
    const dialog = page.getByRole("dialog", { name: "DM Menu" });

    const before = await page.evaluate(
      () =>
        (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
          .filter((c) => c.type === "npc")
          .map((c) => c.id) as string[],
    );

    try {
      const add = dialog.getByRole("button", { name: "+ Add NPC" });
      await add.scrollIntoViewIfNeeded();
      await add.click();
      await page.waitForFunction(
        (count) =>
          (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter((c) => c.type === "npc")
            .length ===
          count + 1,
        before.length,
      );

      const stance = dialog.getByLabel("Stance").first();
      await stance.scrollIntoViewIfNeeded();
      await expect(stance).toBeVisible();
      expect((await stance.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      // And it really commits: the snapshot's NPC carries the new stance.
      await stance.selectOption("friendly");
      await expect
        .poll(async () =>
          page.evaluate(
            (ids) =>
              (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).find(
                (c) => c.type === "npc" && !ids.includes(c.id),
              )?.disposition,
            before,
          ),
        )
        .toBe("friendly");
    } finally {
      await page.evaluate((preexisting) => {
        for (const npc of (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
          (c) => c.type === "npc",
        )) {
          if (!preexisting.includes(npc.id)) {
            window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-npc", id: npc.id });
          }
        }
      }, before);
      // Polled, for the same reason the shelf's cleanup is.
      await expect
        .poll(async () =>
          page.evaluate(
            (ids) =>
              (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
                (c) => c.type === "npc" && !ids.includes(c.id),
              ).length,
            before,
          ),
        )
        .toBe(0);
    }
  });

  test("the ✕ is a 44px bar under the cell, not an overlay on its picture", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openShelf(page);

    const shelf = () => page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.customTokens ?? []);
    const shelfBefore = (await shelf()).map((t) => t.id);
    const NAME = `Phone Marta ${Date.now().toString(36)}`;

    try {
      const form = page.getByTestId("custom-token-form");
      await form.scrollIntoViewIfNeeded();

      // "Keep a copy on this table" is a LABEL, and the panel-wide sweep only
      // measures button/input/select/textarea — so its 44px rule was reachable
      // by no test at any level, and could be deleted with everything green.
      // It only renders for a pasted link, which is also why the pack path
      // below never showed it.
      await form.getByRole("textbox", { name: "Image" }).fill("https://i.imgur.com/x.png");
      const keepCopy = form.getByText(/Keep a copy on this table/);
      await expect(keepCopy).toBeVisible();
      expect((await keepCopy.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      await form.getByRole("textbox", { name: "Image" }).fill(IMAGE);
      await form.getByRole("textbox", { name: "Image" }).press("Enter");
      await form.getByLabel("Name").fill(NAME);
      await form.getByRole("button", { name: "＋ Add to library" }).click();
      await expect
        .poll(async () => (await shelf()).filter((t) => !shelfBefore.includes(t.id)))
        .toHaveLength(1);

      const remove = page.getByRole("button", { name: `Remove ${NAME} from the library` });
      await remove.scrollIntoViewIfNeeded();
      await expect(remove).toBeVisible();

      const geometry = await page.evaluate((label) => {
        const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
          (b) => b.getAttribute("aria-label") === label,
        );
        const picture = button?.parentElement?.querySelector("img");
        if (!button || !picture) return null;
        const bar = button.getBoundingClientRect();
        const image = picture.getBoundingClientRect();
        return {
          bar: { top: bar.top, height: bar.height, width: bar.width },
          image: { bottom: image.bottom, width: image.width },
        };
      }, `Remove ${NAME} from the library`);

      expect(geometry, "the shelf cell or its picture was not found").not.toBeNull();
      // (a) pressable, (b) below the picture rather than over it, and (c) as
      // wide as the PICTURE it belongs to — measuring it against its own
      // parent proves nothing, since `align-self: stretch` makes that true
      // whatever the rule says.
      expect(geometry!.bar.height).toBeGreaterThanOrEqual(44);
      expect(geometry!.bar.top).toBeGreaterThanOrEqual(geometry!.image.bottom);
      expect(geometry!.bar.width).toBeGreaterThanOrEqual(geometry!.image.width);

      // (d) and nothing in the whole Library panel is under the floor — the
      // cells, their bars, the form's fields AND its tag chips. Scoped to the
      // grid alone this could not fail: the cells carry inline 84px minima and
      // the bar's height is already asserted above, so it swept nothing that
      // could ever go red. The form is where the undersized controls were.
      const swept = await page.evaluate(
        () => document.querySelectorAll('[data-testid="token-library"] button').length,
      );
      expect(swept, "the sweep found no controls to measure").toBeGreaterThan(10);
      expect(await undersizedControls(page, '[data-testid="token-library"]')).toEqual([]);
    } finally {
      const leftover = (await shelf()).filter((t) => !shelfBefore.includes(t.id));
      await page.evaluate(
        (ids) => {
          for (const id of ids)
            window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "remove-custom-token", id });
        },
        leftover.map((t) => t.id),
      );
      // POLL, do not fire and forget. The default table is shared between
      // specs and between runs, the optional-chained send cleans up nothing
      // if the seam is missing, and the shelf caps at 200 — after which adds
      // are refused in silence and a later spec fails for no visible reason.
      await expect
        .poll(async () => (await shelf()).filter((t) => !shelfBefore.includes(t.id)).length)
        .toBe(0);
    }
  });

  test("a row mixing one of ours with the pack does not stretch the pack cells", async ({
    page,
  }) => {
    // The bar is IN FLOW on a coarse pointer, so a custom cell's wrapper is
    // ~48px taller than a pack one beside it. The cell button carried
    // `flex: 1` to equalise ragged captions, and inside a stretched row that
    // made every PACK button grow to the custom wrapper's height: a bordered
    // box with ~48px of dead space under its caption, next to a normal one.
    // Measured before the fix at 375px: wrappers 171/171/171, buttons
    // 123/171/171. No test looked at cell-to-cell geometry, and the ✕ spec's
    // shelf holds exactly one token, so it could not see this.
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openShelf(page);

    const shelf = () => page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.customTokens ?? []);
    const shelfBefore = (await shelf()).map((t) => t.id);
    const NAME = `Row Marta ${Date.now().toString(36)}`;

    try {
      const form = page.getByTestId("custom-token-form");
      await form.scrollIntoViewIfNeeded();
      await form.getByRole("textbox", { name: "Image" }).fill(IMAGE);
      await form.getByRole("textbox", { name: "Image" }).press("Enter");
      await form.getByLabel("Name").fill(NAME);
      await form.getByRole("button", { name: "＋ Add to library" }).click();
      await expect
        .poll(async () => (await shelf()).filter((t) => !shelfBefore.includes(t.id)))
        .toHaveLength(1);

      // ALL, where ours lead the grid and the pack follows in the same row.
      const dialog = page.getByRole("dialog", { name: "DM Menu" });
      await dialog.getByRole("button", { name: "All" }).click();
      await expect(page.getByRole("button", { name: NAME })).toBeVisible();

      const row = await page.evaluate(() => {
        const MINE = 'button[aria-label^="Remove "]';
        const cells = [...document.querySelectorAll<HTMLElement>(".token-library-cell")];
        const mine = cells.find((c) => c.parentElement?.querySelector(MINE));
        if (!mine) return null;
        const top = Math.round(mine.getBoundingClientRect().top);
        return cells
          .filter((c) => Math.abs(Math.round(c.getBoundingClientRect().top) - top) <= 2)
          .map((c) => {
            const box = c.getBoundingClientRect();
            const caption = c.querySelector("span")!.getBoundingClientRect();
            return {
              mine: !!c.parentElement?.querySelector(MINE),
              height: Math.round(box.height),
              deadSpace: Math.round(box.bottom - caption.bottom),
            };
          });
      });

      expect(row, "no grid row containing one of our own tokens").not.toBeNull();
      expect(row!.length, "the row held only our token, so it proves nothing").toBeGreaterThan(1);
      expect(row!.some((c) => c.mine)).toBe(true);
      // 4px of the cell's own padding, and nothing else. The bug put ~48 here.
      for (const cell of row!) {
        expect(cell.deadSpace, JSON.stringify(cell)).toBeLessThanOrEqual(12);
      }
    } finally {
      const leftover = (await shelf()).filter((t) => !shelfBefore.includes(t.id));
      await page.evaluate(
        (ids) => {
          for (const id of ids)
            window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "remove-custom-token", id });
        },
        leftover.map((t) => t.id),
      );
      await expect
        .poll(async () => (await shelf()).filter((t) => !shelfBefore.includes(t.id)).length)
        .toBe(0);
    }
  });
});
