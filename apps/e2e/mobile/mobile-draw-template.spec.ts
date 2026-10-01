/**
 * Mobile: arming an area template on the drawing sheet (U10a).
 *
 * Arming a template adds one line to the sheet — the shape's description. The sheet is
 * pinned to the bottom of the screen and grows upward, so where that line goes decides
 * whether the chip under the finger that armed the template jumps by a row. Measured:
 * with the line BELOW the chips every chip was lifted ~50px at 375x812; above them none
 * moves. Every control must also stay on screen and at the 44px floor with it showing
 * (mobile-draw.spec.ts measures the same for a freehand tool).
 */
import { expect, test } from "../fixtures";
import { joinMobileTable, selectMobileTool } from "./mobile.helpers";

for (const viewport of [
  { width: 375, height: 812, label: "portrait" },
  { width: 812, height: 375, label: "landscape" },
]) {
  test(`arming AoE Cube moves no chip and keeps every control reachable (${viewport.label})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await joinMobileTable(page);
    await selectMobileTool(page, /^Draw$/i);
    const toolbar = page.getByRole("toolbar", { name: /Drawing tools/i });
    await expect(toolbar).toBeVisible();
    const hint = page.getByTestId("template-tool-hint");
    await expect(hint).toHaveCount(0);

    const cone = page.getByRole("button", { name: "AoE Cone", exact: true });
    const before = (await cone.boundingBox())!;
    await page.getByRole("button", { name: "AoE Cube", exact: true }).click();
    // Measure only once the hint is on screen: before it renders, "nothing moved" is vacuous.
    await expect(hint).toHaveText(/^Cube: a square/);
    const after = (await cone.boundingBox())!;
    // Under 4px: a row is 44px+ (the hint below the chips lifted them ~50px); what is left
    // is the sheet's own padding rounding, not something a finger can feel.
    expect(Math.abs(after.y - before.y), "AoE Cone moved when a template armed").toBeLessThan(4);

    await expect(hint).toBeInViewport({ ratio: 1 });
    const controls = await toolbar.locator("button,input").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: (el.getAttribute("aria-label") || el.textContent || "").trim(),
          small: r.height < 44 || r.width < 44,
          off: r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth,
        };
      }),
    );
    expect(controls.length).toBe(17);
    expect(controls.filter((c) => c.small).map((c) => c.label)).toEqual([]);
    expect(controls.filter((c) => c.off).map((c) => c.label)).toEqual([]);
  });
}
