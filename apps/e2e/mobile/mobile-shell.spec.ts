/**
 * Mobile shell geometry (M3).
 *
 * Every one of these is arithmetic that only a real layout engine performs, so
 * jsdom cannot see any of it: the dock's height is a border-box computation,
 * and the sheets' heights are derived from that height through a CSS variable.
 * When the variable and the rendered dock disagree, nothing fails — the sheets
 * just sit closer to the dock than the stylesheet claims, and a tall one walks
 * off the top of the screen. That is the shape of the bug S8 shipped in the
 * help sheet, and these assertions exist so the next sheet cannot repeat it.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

const VIEWPORTS = [
  { width: 375, height: 812, label: "portrait" },
  { width: 812, height: 375, label: "landscape" },
];

test.describe("mobile shell — the dock", () => {
  for (const vp of VIEWPORTS) {
    test(`--mobile-dock-height is the dock's real height (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await joinMobileTable(page);

      const dock = await page.evaluate(() => {
        const root = document.querySelector(".mobile-layout-root")!;
        const el = document.querySelector(".mobile-action-dock")!;
        const buttons = [...document.querySelectorAll(".mobile-dock-button")];
        return {
          declared: parseFloat(getComputedStyle(root).getPropertyValue("--mobile-dock-height")),
          rendered: Math.round(el.getBoundingClientRect().height),
          shortest: Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().height))),
          narrowest: Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().width))),
          clipped: buttons
            .filter((b) => b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1)
            .map((b) => (b.textContent || "").trim()),
        };
      });

      // The claim the sheets' `bottom: calc(safe + dock + 22px)` depends on.
      // Was 68 declared against 86 rendered before border-box landed here.
      expect(dock.rendered).toBe(dock.declared);
      // Shrinking the dock must not take its buttons under the touch floor.
      expect(dock.shortest).toBeGreaterThanOrEqual(44);
      expect(dock.narrowest).toBeGreaterThanOrEqual(44);
      // ...nor squeeze the icon and label out of the box they sit in.
      expect(dock.clipped).toEqual([]);
    });
  }
});
