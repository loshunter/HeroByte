/**
 * Desktop: the ? help panel (S8).
 *
 * The occlusion assertion below is the point of this file. The header is a
 * fixed container at z-index 100, which makes it a stacking context — so a
 * popover rendered inside it cannot paint above the entities panel, a later
 * sibling at the same z-index, no matter what z-index the popover itself
 * claims. The manual is ~500px tall and was being cut off exactly at the
 * entities panel's top edge: the bottom half was on screen, drawn, and
 * unreadable. Every unit test was green, because jsdom computes no layout and
 * has no notion of stacking contexts.
 *
 * The fix portals the popover to document.body. What is asserted here is the
 * consequence, not the mechanism: hit-testing a point inside the panel must
 * land on the panel.
 */
import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

/** Accessible name, not the title attribute — the "?" glyph is aria-hidden. */
const HELP_BUTTON = "Help";

test.describe("desktop — the help panel", () => {
  test("opens from the header and closes again", async ({ page }) => {
    await joinDefaultRoom(page);

    const button = page.getByRole("button", { name: HELP_BUTTON });
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    const dialog = page.getByRole("dialog", { name: /HeroByte help/i });
    await expect(dialog).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("is not painted under the entities panel", async ({ page }) => {
    await joinDefaultRoom(page);
    await page.getByRole("button", { name: HELP_BUTTON }).click();
    await expect(page.getByRole("dialog", { name: /HeroByte help/i })).toBeVisible();

    const report = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="HeroByte help"]');
      if (!dialog) return null;
      const rect = dialog.getBoundingClientRect();

      // Hit-test near the BOTTOM of the panel — the region the entities panel
      // used to cover. Inset from the edge so the probe cannot land on a
      // border and pass by accident.
      const probe = document.elementFromPoint(
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.bottom - 12),
      );

      return {
        fitsInViewport:
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.left >= 0 &&
          rect.right <= window.innerWidth,
        height: Math.round(rect.height),
        probeIsInsidePanel: probe ? dialog.contains(probe) : false,
        probeClass: probe ? `${probe.tagName}.${probe.className}`.slice(0, 60) : null,
        topicCount: dialog.querySelectorAll(".help-panel__topic-button").length,
        linkCount: dialog.querySelectorAll(".help-panel__link").length,
      };
    });

    expect(report).not.toBeNull();
    // The whole panel must be on screen, not merely positioned.
    expect(report!.fitsInViewport).toBe(true);
    // …and nothing may be drawn on top of it.
    expect(report!.probeIsInsidePanel).toBe(true);
    expect(report!.topicCount).toBe(8);
    expect(report!.linkCount).toBe(4);
  });

  test("a topic expands to its entries", async ({ page }) => {
    await joinDefaultRoom(page);
    await page.getByRole("button", { name: HELP_BUTTON }).click();

    const dialog = page.getByRole("dialog", { name: /HeroByte help/i });
    const topic = dialog.getByRole("button", { name: "Doors, fog, and what you can see" });

    await expect(topic).toHaveAttribute("aria-expanded", "false");
    await topic.click();
    await expect(topic).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByText("Explored ground")).toBeVisible();
  });

  test("clicking the table closes it", async ({ page }) => {
    await joinDefaultRoom(page);
    await page.getByRole("button", { name: HELP_BUTTON }).click();

    const dialog = page.getByRole("dialog", { name: /HeroByte help/i });
    await expect(dialog).toBeVisible();

    // Raw mouse, not a locator click: the target is "anywhere that is not the
    // panel", and a locator would run actionability checks against a canvas
    // that the panel may legitimately overlap.
    const box = (await dialog.boundingBox())!;
    await page.mouse.click(Math.round(box.x + box.width + 120), Math.round(box.y + 80));

    await expect(dialog).toBeHidden();
  });
});
