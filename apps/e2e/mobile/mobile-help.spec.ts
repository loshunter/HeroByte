/**
 * Mobile: reaching the manual from a phone (S8).
 *
 * This spec exists because the bug it guards is invisible to jsdom. The help
 * sheet's height came from a vh fraction while its position came from a dock
 * offset, and the two did not know about each other: at 812x375 the shared 82vh
 * landscape cap plus the 102px offset made a 409px sheet in a 375px viewport,
 * so the header — and the ✕ that is the only way to close it — sat 34px above
 * the top of the screen. Every unit test stayed green, because jsdom computes
 * no layout.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

/** Open Tools → Help. The tool sheet closes itself on pick. */
async function openMobileHelp(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("button", { name: /Tools/i }).click();
  await page.getByRole("button", { name: /^Help$/i }).click();
  await expect(page.getByRole("dialog", { name: /HeroByte help/i })).toBeVisible();
}

test.describe("mobile — the manual", () => {
  test("the dock stays at five buttons", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);

    // The dock is a 5-column CSS grid with no overflow handling; a sixth child
    // does not wrap, it overlaps. Help therefore lives in the tool sheet.
    const dock = page.getByRole("navigation", { name: /Mobile actions/i });
    await expect(dock.getByRole("button")).toHaveCount(5);
  });

  for (const viewport of [
    { width: 375, height: 812, label: "portrait" },
    { width: 812, height: 375, label: "landscape" },
  ]) {
    test(`the whole sheet is on screen and every target is >=44px (${viewport.label})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await joinMobileTable(page);
      await openMobileHelp(page);

      const report = await page.evaluate(() => {
        const sheet = document.querySelector(".mobile-help-sheet");
        if (!sheet) return null;
        const rect = sheet.getBoundingClientRect();
        const onScreen = (r: DOMRect) =>
          r.top >= 0 &&
          r.bottom <= window.innerHeight &&
          r.left >= 0 &&
          r.right <= window.innerWidth;

        const targets = [...sheet.querySelectorAll("button,a")].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            label: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 18),
            height: Math.round(r.height),
            width: Math.round(r.width),
            onScreen: onScreen(r),
          };
        });

        const close = sheet.querySelector(".mobile-tool-sheet__close");

        // Scroll to the end and re-measure the last target. Unlike the drawing
        // toolbar — which must fit entirely, because it cannot scroll — the
        // manual is prose in a scroller, so the claim to prove is "reachable",
        // not "simultaneously visible".
        sheet.scrollTop = sheet.scrollHeight;
        const last = [...sheet.querySelectorAll("a")].pop();

        return {
          sheetOnScreen: onScreen(rect),
          sheetTop: Math.round(rect.top),
          sheetBottom: Math.round(rect.bottom),
          viewportHeight: window.innerHeight,
          closeOnScreen: close ? onScreen(close.getBoundingClientRect()) : false,
          scrollable: sheet.scrollHeight > sheet.clientHeight,
          lastLinkReachable: last ? onScreen(last.getBoundingClientRect()) : false,
          count: targets.length,
          under44: targets
            .filter((t) => t.height < 44 || t.width < 44)
            .map((t) => `${t.label}:${t.height}x${t.width}`),
          bodyOverflowsX: document.documentElement.scrollWidth > window.innerWidth,
        };
      });

      expect(report).not.toBeNull();
      // The regression, stated as arithmetic: the sheet must start below the
      // top edge, not above it.
      expect(report!.sheetTop).toBeGreaterThanOrEqual(0);
      expect(report!.sheetBottom).toBeLessThanOrEqual(report!.viewportHeight);
      expect(report!.sheetOnScreen).toBe(true);
      // The ✕ is the only way out of this sheet, and it must not scroll away.
      expect(report!.closeOnScreen).toBe(true);
      // Scrolling has to actually get you to the bottom of the manual.
      expect(report!.scrollable).toBe(true);
      expect(report!.lastLinkReachable).toBe(true);
      // 14 = the close button + nine topic buttons + four guide links (the
      // Atlas topic joined in A5). Pinned deliberately, as the drawing sheet's
      // count is: adding a control must be seen and re-measured, not
      // auto-accepted.
      expect(report!.count).toBe(14);
      expect(report!.under44).toEqual([]);
      expect(report!.bodyOverflowsX).toBe(false);
    });
  }

  test("a topic opens and the guide links are reachable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openMobileHelp(page);

    // Scoped to the dialog: "Dice" is also the label of a dock button.
    const dialog = page.getByRole("dialog", { name: /HeroByte help/i });
    const topic = dialog.getByRole("button", { name: "Dice" });
    await expect(topic).toHaveAttribute("aria-expanded", "false");
    await topic.click();
    await expect(topic).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByText("Build a roll")).toBeVisible();

    const guide = dialog.getByRole("link", { name: /Player Guide/i });
    await expect(guide).toHaveAttribute(
      "href",
      "https://github.com/loshunter/HeroByte/blob/main/docs/user-guide/player-guide.md",
    );
    // Opening the manual must not be able to navigate the table away.
    await expect(guide).toHaveAttribute("target", "_blank");
    await expect(guide).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("the ✕ closes it again", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openMobileHelp(page);

    await page.getByRole("button", { name: /Close help/i }).click();
    await expect(page.getByRole("dialog", { name: /HeroByte help/i })).toBeHidden();
  });
});
