/**
 * Mobile: the drawing sheet's history row (Hide controls / Undo / Redo / Cancel / Done)
 * is ON SCREEN in a short single-column landscape.
 *
 * At 667x375 (a phone on its side) the sheet stacked Tool, Settings and History in one
 * column because its compact three-column layout began at 700px; with a freehand tool it was
 * taller than the window, so the history row, the only way to Undo, Cancel a stroke or say
 * Done, was below the fold. Found in U10a, not fixed there (no red spec then). The compact
 * layout now starts at 640px; narrower landscape screens (568x320, an iPhone 5/SE 1) still stack,
 * a known limit.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable, selectMobileTool } from "./mobile.helpers";

const HISTORY = ["Hide drawing controls", "Undo drawing", "Redo drawing", "Cancel stroke"];

for (const viewport of [
  { width: 667, height: 375 },
  { width: 640, height: 360 },
]) {
  test(`the history row is on screen and at the 44px floor at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await joinMobileTable(page);
    await selectMobileTool(page, /^Draw$/i);
    const toolbar = page.getByRole("toolbar", { name: /Drawing tools/i });
    await expect(toolbar).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const row = [
      ...HISTORY.map((name) => toolbar.getByRole("button", { name, exact: true })),
      toolbar.getByRole("button", { name: "Done drawing", exact: true }),
    ];
    for (const control of row) {
      const box = await control.boundingBox();
      const label = (await control.getAttribute("aria-label")) ?? (await control.textContent());
      expect(box, `${label} is rendered`).not.toBeNull();
      // toBeInViewport applies the sheet's own overflow clipping: a control scrolled out of the
      // height-capped sheet has a box inside the window and is still not on screen.
      await expect(control, `${label} is on screen`).toBeInViewport({ ratio: 1 });
      expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(44);
      // The label fits its chip: "drawing" must not spill into the next chip.
      const spills = await control.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(spills, `${label} label spills its chip`).toBe(false);
    }
  });
}
