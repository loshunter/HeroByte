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
 * The roll log is a full-screen takeover on mobile, so its ✕ is the only way
 * out — and it was 32px in portrait and 24px in landscape, because
 * DraggableWindow decided "mobile" with its own `innerWidth < 768` while
 * App.tsx routes an 812x375 phone and a 1024px tablet into MobileLayout. The
 * landscape case is the one that proves the two now agree.
 */
test.describe("mobile shell — the roll log", () => {
  for (const vp of VIEWPORTS) {
    test(`opens over the sheets with a reachable exit (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await joinMobileTable(page);

      // Arm Draw first: the drawing sheet renders on `drawMode && !showTools`,
      // and opening the log clears showTools — so this is the state in which
      // the sheet used to paint straight across the middle of the log.
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

      const close = page.getByRole("button", { name: /^Close .*ROLL LOG$/i });
      await expect(close).toBeVisible();

      const box = (await close.boundingBox())!;
      expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
      expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);

      // Occlusion, sampled down the MIDDLE of the window rather than at the
      // close button. The sheet covers the log's body, not its title bar, so a
      // hit-test on the ✕ passes whether or not the bug is present — which is
      // exactly what removing the stacking context proved.
      const covered = await page.evaluate(() => {
        const panel = document.querySelector(".mobile-roll-log-panel")!;
        const win = panel.firstElementChild as HTMLElement;
        const r = win.getBoundingClientRect();
        const intruders: string[] = [];
        // Five points down the window's spine: the body is the part that was
        // painted over, and a single centre sample can slip between rows.
        for (const f of [0.3, 0.45, 0.6, 0.75, 0.9]) {
          const hit = document.elementFromPoint(
            Math.round(r.left + r.width / 2),
            Math.round(r.top + r.height * f),
          );
          if (hit && !panel.contains(hit)) {
            intruders.push(`${f}: ${(hit.className || hit.tagName).toString().slice(0, 40)}`);
          }
        }
        return intruders;
      });
      expect(covered).toEqual([]);

      // And it really does close.
      await close.click();
      await expect(page.getByText(/No rolls yet/i)).toBeHidden();
      // Closing the log leaves the drawing sheet where it was.
      await expect(page.locator(".mobile-drawing-sheet")).toBeVisible();
    });
  }
});

function mid(box: { x: number; y: number; width: number; height: number }) {
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}
