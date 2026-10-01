/**
 * Mobile shell — the top stack (U9): the connection chip, the public-table chip and the
 * gate's reconnect notice in one in-flow column. A file of its own because
 * mobile-shell.spec.ts is at the 350-line guard.
 */
import { expect, test } from "../fixtures";
import { holdableSocket } from "../socket-drop.helpers";
import { joinMobileTable, tooSmallText } from "./mobile.helpers";

const VIEWPORTS = [
  { width: 375, height: 812, label: "portrait" },
  { width: 812, height: 375, label: "landscape" },
];

/**
 * The chrome across the top of the map: the connection chip and the public-table
 * chip in ONE in-flow column, `.mobile-top-stack` (U9). They were two fixed
 * elements with hand-picked `top`s — the badge at 0, the chip at +30 — and the
 * badge painted over the combat strip's PREV / NEXT and a screen's title. A column
 * cannot overlap itself, and this block measures that instead of trusting it; the
 * turn strip's own clearance is measured in mobile-encounter.spec.ts.
 *
 * The readability floor is swept over everything on screen. (An earlier sweep
 * used `offsetParent !== null`, which is null for EVERY position:fixed element, so
 * it silently skipped the elements this block exists to check.)
 */
test.describe("mobile shell — the top stack", () => {
  for (const vp of VIEWPORTS) {
    test(`is readable, in one column, and clear of the insets (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await joinMobileTable(page);

      const report = await page.evaluate(() => {
        const rectOf = (el: Element) => el.getBoundingClientRect();
        const visible = [...document.querySelectorAll<HTMLElement>("*")].filter((el) =>
          el.checkVisibility(),
        );

        const tooSmall = visible
          .filter(
            (el) =>
              parseFloat(getComputedStyle(el).fontSize) < 11 &&
              el.children.length === 0 &&
              (el.textContent || "").trim().length > 0,
          )
          .map((el) => `${getComputedStyle(el).fontSize} "${(el.textContent || "").trim()}"`);

        const stack = document.querySelector<HTMLElement>(".mobile-top-stack");
        const banner = stack?.querySelector<HTMLElement>("[data-testid='connection-chip']") ?? null;
        const chip = stack?.querySelector<HTMLElement>("[data-testid='public-table-chip']") ?? null;

        return {
          tooSmall,
          stackPosition: stack ? getComputedStyle(stack).position : null,
          bannerPosition: banner ? getComputedStyle(banner).position : null,
          chipPosition: chip ? getComputedStyle(chip).position : null,
          bannerText: (banner?.textContent ?? "").trim(),
          bannerTop: banner ? Math.round(rectOf(banner).top) : null,
          bannerBottom: banner ? Math.round(rectOf(banner).bottom) : null,
          chipTop: chip ? Math.round(rectOf(chip).top) : null,
          chipLeft: chip ? Math.round(rectOf(chip).left) : null,
          chipRight: chip ? Math.round(rectOf(chip).right) : null,
          viewportWidth: window.innerWidth,
          bodyOverflowsX: document.documentElement.scrollWidth > window.innerWidth,
        };
      });

      // The readability floor, over everything actually on screen — and, for the stack's own
      // members, over every element that owns text (a label around a control, a button with
      // children) and every text-bearing form control, which a leaf-only sweep cannot see.
      expect(report.tooSmall).toEqual([]);
      expect(await tooSmallText(page, ".mobile-top-stack")).toEqual([]);

      // Both members live in the stack, in flow: nothing in it is fixed, so no
      // member's `top` was picked by hand and none can land on another.
      expect(report.stackPosition).toBe("absolute");
      expect(report.bannerPosition).not.toBe("fixed");
      expect(report.chipPosition).not.toBe("fixed");
      expect(report.bannerText).toMatch(/^(🟢|🔴)(ONLINE|OFFLINE)$/);

      // Playwright emulates no notch, so env(safe-area-inset-top) is 0 here and the
      // max(12px, …) floor is what shows — which is enough to prove the offset
      // comes from the variable rather than from a hard-coded number.
      expect(report.bannerTop).toBeGreaterThanOrEqual(12);
      expect(report.chipTop).toBeGreaterThanOrEqual(report.bannerBottom!);

      // The chip's one long sentence is far wider than a phone, so it must wrap
      // inside the screen rather than run off both edges.
      expect(report.chipLeft).toBeGreaterThanOrEqual(0);
      expect(report.chipRight).toBeLessThanOrEqual(report.viewportWidth);
      expect(report.bodyOverflowsX).toBe(false);
    });
  }

  // The gate's "Reconnecting…" was a fixed banner at the top right: 26px of it lay over the
  // OFFLINE chip, and it took the taps meant for whatever was under it. It is a member of this
  // column now, below the chip, and never takes a tap.
  for (const vp of VIEWPORTS) {
    test(`gives the reconnect notice its place in the column, clear of the chip (${vp.label})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const socket = await holdableSocket(page);
      await joinMobileTable(page);
      await expect(page.getByTestId("reconnect-notice")).toHaveCount(0);

      const measure = () =>
        page.evaluate(() => {
          const stack = document.querySelector<HTMLElement>(".mobile-top-stack")!;
          const chip = stack.querySelector<HTMLElement>("[data-testid='connection-chip']")!;
          const notice = document.querySelector<HTMLElement>("[data-testid='reconnect-notice']")!;
          const c = chip.getBoundingClientRect();
          const n = notice.getBoundingClientRect();
          return {
            inTheColumn: stack.contains(notice),
            belowTheChip: n.top >= c.bottom,
            onScreen: n.left >= 0 && n.right <= window.innerWidth,
            tapsPass: getComputedStyle(notice).pointerEvents === "none",
            chipSays: (chip.textContent ?? "").trim(),
          };
        });
      const inItsPlace = (chipSays: RegExp) => ({
        inTheColumn: true,
        belowTheChip: true,
        onScreen: true,
        tapsPass: true,
        chipSays: expect.stringMatching(chipSays),
      });

      // The socket closed: "Reconnecting…", under an OFFLINE chip.
      await socket.drop();
      await expect(page.getByTestId("reconnect-notice")).toContainText("Reconnecting…");
      expect(await measure()).toEqual(inItsPlace(/OFFLINE/));

      // The retry has connected but nothing answers: other words, the same place.
      await expect.poll(() => socket.held(), { timeout: 30_000 }).toBeGreaterThan(0);
      await expect(page.getByTestId("reconnect-notice")).toContainText("Re-authenticating…");
      expect(await measure()).toEqual(inItsPlace(/ONLINE|OFFLINE/));

      await socket.release();
      await expect(page.getByTestId("reconnect-notice")).toHaveCount(0, { timeout: 30_000 });
    });
  }
});
