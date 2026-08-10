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
import { openTouch, touchDrag } from "./touch.helpers";

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

/**
 * The cap, tested against content taller than the screen.
 *
 * Nothing shipped today is tall enough to reach it — which is exactly why this
 * injects 900px of filler rather than trusting the sheets as they stand. M4
 * puts a map-edit palette in this slot, and the question that matters is what
 * happens then. Measured before the shared cap landed: the tool sheet's top
 * went to -428px in portrait, where there was no cap at all, and to -60px in
 * landscape, where the 82vh cap was too large to intervene.
 */
test.describe("mobile shell — a sheet taller than the screen", () => {
  for (const vp of VIEWPORTS) {
    test(`stays on screen, scrolls, and keeps its header (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await joinMobileTable(page);

      // Scoped to the dock: once the sheet is open its own header says "Tools"
      // too, and an unscoped getByRole is a strict-mode violation.
      await page
        .getByRole("navigation", { name: /Mobile actions/i })
        .getByRole("button", { name: /Tools/i })
        .click();

      const report = await page.evaluate(() => {
        const sheet = document.querySelector(".mobile-tool-sheet") as HTMLElement;
        const header = sheet.querySelector(".mobile-tool-sheet__header") as HTMLElement;
        const filler = document.createElement("div");
        filler.style.height = "900px";
        sheet.appendChild(filler);

        const rect = sheet.getBoundingClientRect();
        sheet.scrollTop = sheet.scrollHeight;
        const headerAtBottom = header.getBoundingClientRect();
        const closeAtBottom = (
          sheet.querySelector(".mobile-tool-sheet__close") as HTMLElement
        ).getBoundingClientRect();

        const out = {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          viewport: window.innerHeight,
          scrolls: sheet.scrollHeight > sheet.clientHeight,
          headerTop: Math.round(headerAtBottom.top),
          closeTop: Math.round(closeAtBottom.top),
          closeBottom: Math.round(closeAtBottom.bottom),
          rootClips: getComputedStyle(document.querySelector(".mobile-layout-root")!).overflow,
        };
        filler.remove();
        return out;
      });

      // .mobile-layout-root is overflow:hidden, so a negative top is not merely
      // ugly — it is unreachable. This is the assertion that was -428/-60.
      expect(report.top).toBeGreaterThanOrEqual(0);
      expect(report.bottom).toBeLessThanOrEqual(report.viewport);
      expect(report.rootClips).toBe("hidden");
      // Overflowing content has to be reachable rather than clipped away.
      expect(report.scrolls).toBe(true);
      // ...and scrolling to the very bottom must not take the exit with it.
      expect(report.headerTop).toBeGreaterThanOrEqual(0);
      expect(report.closeTop).toBeGreaterThanOrEqual(0);
      expect(report.closeBottom).toBeLessThanOrEqual(report.viewport);
    });
  }
});

/**
 * The log is a SCREEN since M4a (redesign §1): full height, opaque, its own
 * header, dock covered, ✕ ≥44px. Its predecessor was a DraggableWindow in
 * phone dress whose ✕ was 24px on every tablet and landscape phone, plus a
 * stacking-context workaround so the drawing sheet stopped painting across
 * its middle — the screen replaces both, and this block measures the
 * replacement rather than trusting it.
 */
test.describe("mobile shell — the log screen", () => {
  for (const vp of VIEWPORTS) {
    test(`covers the shell with a >=44px exit, then yields to the drawing sheet (${vp.label})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await joinMobileTable(page);

      // Arm Draw first: the drawing sheet is tool-derived, not a surface, so
      // it stays MOUNTED under the opaque screen exactly as it stayed under
      // the old takeover — which makes it the intruder that would betray a
      // transparent or mis-stacked screen.
      await page
        .getByRole("navigation", { name: /Mobile actions/i })
        .getByRole("button", { name: /Tools/i })
        .click();
      await page.getByRole("button", { name: /^Draw$/i }).click();
      await expect(page.locator(".mobile-drawing-sheet")).toBeVisible();

      await page
        .getByRole("navigation", { name: /Mobile actions/i })
        .getByRole("button", { name: /Log/i })
        .click();

      const close = page.getByRole("button", { name: "Close Roll Log" });
      await expect(close).toBeVisible();

      const box = (await close.boundingBox())!;
      expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
      expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);

      const report = await page.evaluate(() => {
        const el = document.querySelector(".mobile-screen") as HTMLElement;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        // Occlusion, sampled down the screen's SPINE rather than at the close
        // button: the old bug covered the body and never the title bar, so a
        // hit-test on the ✕ passes whether or not the bug is present.
        const intruders: string[] = [];
        for (const f of [0.3, 0.45, 0.6, 0.75, 0.9]) {
          const hit = document.elementFromPoint(
            Math.round(r.left + r.width / 2),
            Math.round(r.top + r.height * f),
          );
          if (hit && !el.contains(hit)) {
            intruders.push(`${f}: ${(hit.className || hit.tagName).toString().slice(0, 40)}`);
          }
        }
        return {
          top: Math.round(r.top),
          left: Math.round(r.left),
          bottom: Math.round(r.bottom),
          right: Math.round(r.right),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          // elementFromPoint proves stacking, not paint: a fully transparent
          // screen would still win the hit test while the sheet showed
          // through it. The gradient background is the opacity claim.
          background: style.backgroundImage,
          intruders,
          surfaces: [...document.querySelectorAll("[data-mobile-surface]")].map((n) =>
            n.getAttribute("data-mobile-surface"),
          ),
        };
      });

      // Full height and full width — a Screen, not a window in phone dress.
      expect(report.top).toBe(0);
      expect(report.left).toBe(0);
      expect(report.bottom).toBe(report.viewportHeight);
      expect(report.right).toBe(report.viewportWidth);
      expect(report.background).toContain("gradient");
      expect(report.intruders).toEqual([]);
      // The machine's invariant, counted in a real DOM: one surface, this one.
      expect(report.surfaces).toEqual(["log"]);

      // And it really does close.
      await close.click();
      await expect(page.getByText(/No rolls yet/i)).toBeHidden();
      // Closing the log leaves the drawing sheet where it was.
      await expect(page.locator(".mobile-drawing-sheet")).toBeVisible();
    });
  }

  test("drag-down on the header dismisses; a short drag settles back", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);

    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: /Log/i })
      .click();
    await expect(page.locator(".mobile-screen")).toBeVisible();

    const header = (await page.locator(".mobile-screen__header").boundingBox())!;
    // Left of centre, clear of the ✕ that lives at the header's right edge.
    const grip = { x: header.x + header.width * 0.3, y: header.y + header.height / 2 };
    const cdp = await openTouch(page);

    // 40px is an adjustment, not an exit: the screen settles back.
    await touchDrag(cdp, grip, [{ x: grip.x, y: grip.y + 40 }]);
    await expect(page.locator(".mobile-screen")).toBeVisible();

    // 200px is past the threshold: dismissed, and the ✕ was never needed.
    await touchDrag(cdp, grip, [{ x: grip.x, y: grip.y + 200 }]);
    await expect(page.locator(".mobile-screen")).toBeHidden();
  });
});

/**
 * The fixed chrome across the top: the connection banner and the public-table
 * chip. Both are new to mobile as of S8, which is when their 8px and 7px text
 * and their hard-coded `top` first mattered on a device with a notch.
 *
 * NOTE the visibility test. An earlier sweep used `offsetParent !== null`,
 * which is null for EVERY position:fixed element — so it silently skipped the
 * two elements this describe block exists to check, and reported a clean bill
 * of health while a 7px chip sat on screen.
 */
test.describe("mobile shell — the fixed chrome", () => {
  for (const vp of VIEWPORTS) {
    test(`is readable and clear of the insets (${vp.label})`, async ({ page }) => {
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

        const find = (test: (t: string) => boolean) =>
          visible.find(
            (el) =>
              getComputedStyle(el).position === "fixed" && test((el.textContent || "").trim()),
          );
        const banner = find((t) => /^(🟢|🔴)(ONLINE|OFFLINE)$/.test(t));
        const chip = find((t) => t.startsWith("⚠ PUBLIC"));

        return {
          tooSmall,
          bannerTop: banner ? Math.round(rectOf(banner).top) : null,
          bannerBottom: banner ? Math.round(rectOf(banner).bottom) : null,
          chipTop: chip ? Math.round(rectOf(chip).top) : null,
          chipLeft: chip ? Math.round(rectOf(chip).left) : null,
          chipRight: chip ? Math.round(rectOf(chip).right) : null,
          viewportWidth: window.innerWidth,
          bodyOverflowsX: document.documentElement.scrollWidth > window.innerWidth,
        };
      });

      // The readability floor, over everything actually on screen.
      expect(report.tooSmall).toEqual([]);

      // Both were pinned to the top edge and to a literal 26px. Playwright
      // emulates no notch, so env(safe-area-inset-top) is 0 here and the
      // max(12px, …) floor is what shows — which is enough to prove the offset
      // comes from the variable rather than from a hard-coded number.
      expect(report.bannerTop).toBeGreaterThanOrEqual(12);
      expect(report.chipTop).toBeGreaterThanOrEqual(report.bannerBottom!);

      // Raising the chip from 7px to 11px makes its one long sentence far
      // wider than a phone, so it must wrap inside the screen rather than run
      // off both edges.
      expect(report.chipLeft).toBeGreaterThanOrEqual(0);
      expect(report.chipRight).toBeLessThanOrEqual(report.viewportWidth);
      expect(report.bodyOverflowsX).toBe(false);
    });
  }
});
