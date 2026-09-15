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
          image: { bottom: image.bottom, left: image.left, right: image.right },
          cellWidth: button.parentElement!.getBoundingClientRect().width,
        };
      }, `Remove ${NAME} from the library`);

      expect(geometry, "the shelf cell or its picture was not found").not.toBeNull();
      // (a) pressable, (b) below the picture rather than over it, and the full
      // width of its cell so it reads as a bar and not a stray badge.
      expect(geometry!.bar.height).toBeGreaterThanOrEqual(44);
      expect(geometry!.bar.top).toBeGreaterThanOrEqual(geometry!.image.bottom);
      expect(geometry!.bar.width).toBeGreaterThan(geometry!.cellWidth * 0.9);

      // (c) and nothing in the grid is under the floor — the cells, their
      // bars, and the MINE-badged ones alike.
      expect(await undersizedControls(page, '[data-testid="token-library-grid"]')).toEqual([]);
    } finally {
      const leftover = (await shelf()).filter((t) => !shelfBefore.includes(t.id));
      await page.evaluate(
        (ids) => {
          for (const id of ids)
            window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "remove-custom-token", id });
        },
        leftover.map((t) => t.id),
      );
    }
  });
});
