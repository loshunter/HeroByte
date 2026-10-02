/**
 * Mobile: the drawing sheet's tool line (U10a, then U10b).
 *
 * The sheet is pinned to the bottom of the screen and grows upward, so anything that
 * changes its height lifts every chip under the finger that just armed a tool. U10a put
 * the shape's description ABOVE the chips; U10b (owner's answer) made that line a fixed
 * two-line slot that is always there: the tool's description when a template is armed, a
 * general instruction otherwise. So arming a template, or switching back, moves nothing.
 * Measured as bounding boxes, in portrait, in landscape, in a height-capped portrait
 * window (375x450: the sheet itself is capped there, which is where the old line still
 * moved the chips by ~46px) and at 320px wide (the narrowest the descriptions must fit
 * in two lines). Every control must also stay on screen and at the 44px floor.
 */
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { joinMobileTable, selectMobileTool } from "./mobile.helpers";

// At 375x450 and 320x568 the sheet is height-capped and scrolls inside itself (measured: 375x450
// holds 384px of controls in a 294px box; 320x568 holds 434px in 412px, 31px of which is the
// reserved tool line). Its controls are reached by scrolling the sheet; the check below is
// "reachable at the start or the end of that scroll", for every viewport.
const VIEWPORTS = [
  { width: 375, height: 812, label: "portrait" },
  { width: 812, height: 375, label: "landscape" },
  { width: 375, height: 450, label: "height-capped portrait" },
  { width: 320, height: 568, label: "320px wide" },
  // The compact three-column landscape layout starts at 640px: its Tool column is the
  // narrowest the two-line slot must fit in (2/5 of the sheet).
  { width: 640, height: 360, label: "640 landscape" },
  { width: 667, height: 375, label: "667 landscape" },
];

const TEMPLATES: { name: string; text: RegExp }[] = [
  { name: "AoE Burst", text: /^Burst: a circle/ },
  { name: "AoE Cone", text: /^Cone: a wedge/ },
  { name: "AoE Cube", text: /^Cube: a square/ },
  { name: "AoE Bolt", text: /^Bolt: a line/ },
];

type Box = { x: number; y: number; width: number; height: number };

/** Every button and input in the sheet, keyed by its name, as drawn right now. */
const sheetBoxes = (toolbar: Locator): Promise<Record<string, Box>> =>
  toolbar.locator("button,input").evaluateAll((els) =>
    Object.fromEntries(
      els.map((el, i) => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim() || `#${i}`;
        return [name, { x: r.x, y: r.y, width: r.width, height: r.height }];
      }),
    ),
  );

/** The one tool-line slot: its box and the lines of text it holds. */
async function toolLine(page: Page) {
  const line = page.getByTestId("drawing-tool-hint");
  const box = (await line.boundingBox())!;
  const lines = await line.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
  });
  return { box, lines, text: (await line.textContent()) ?? "" };
}

for (const viewport of VIEWPORTS) {
  test(`arming a template moves no chip, and the tool line stays two lines (${viewport.label})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await joinMobileTable(page);
    await selectMobileTool(page, /^Draw$/i);
    const toolbar = page.getByRole("toolbar", { name: /Drawing tools/i });
    await expect(toolbar).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    // No template armed (Freehand is the default tool): the slot is already there, holding the
    // general instruction.
    const idle = await toolLine(page);
    expect(idle.text).toMatch(/^Drag on the map to use the pressed tool/);
    const baseline = await sheetBoxes(toolbar);
    expect(Object.keys(baseline), "the sheet's controls were found").toHaveLength(17);

    for (const template of TEMPLATES) {
      await page.getByRole("button", { name: template.name, exact: true }).click();
      await expect(page.getByTestId("drawing-tool-hint")).toHaveText(template.text);
      const armed = await toolLine(page);

      // The slot is the same box (so nothing moved by being filled) and no description
      // spills past two lines at this width.
      expect(armed.box.height, `${template.name} line height`).toBeCloseTo(idle.box.height, 0);
      expect(armed.box.y, `${template.name} line top`).toBeCloseTo(idle.box.y, 0);
      expect(armed.lines, `${template.name} wraps past two lines`).toBeLessThanOrEqual(2);

      const after = await sheetBoxes(toolbar);
      expect(Object.keys(after).sort()).toEqual(Object.keys(baseline).sort());
      const moved = Object.entries(baseline).filter(([name, was]) => {
        const now = after[name];
        return Math.abs(now.y - was.y) >= 1 || Math.abs(now.x - was.x) >= 1;
      });
      expect(
        moved.map(([name]) => name),
        `chips moved when ${template.name} armed`,
      ).toEqual([]);
    }

    // And back to an annotation tool: still nothing moves.
    await page.getByRole("button", { name: "Freehand", exact: true }).click();
    await expect(page.getByTestId("drawing-tool-hint")).toHaveText(
      /^Drag on the map to use the pressed tool/,
    );
    const back = await sheetBoxes(toolbar);
    expect(
      Object.entries(baseline)
        .filter(([name, was]) => Math.abs(back[name].y - was.y) >= 1)
        .map(([name]) => name),
    ).toEqual([]);
  });

  test(`every drawing control stays on screen and at the 44px floor with a template armed (${viewport.label})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await joinMobileTable(page);
    await selectMobileTool(page, /^Draw$/i);
    const toolbar = page.getByRole("toolbar", { name: /Drawing tools/i });
    await page.getByRole("button", { name: "AoE Cube", exact: true }).click();
    const hint = page.getByTestId("drawing-tool-hint");
    await expect(hint).toHaveText(/^Cube: a square/);
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

    // On screen is not the same as reachable: the sheet is height-capped and scrolls, so a
    // control can sit inside the window and still be clipped by the sheet. Every control
    // must lie inside the sheet's own box, and its label must fit its chip.
    const clipped = await toolbar.evaluate((sheet) => {
      // A capped sheet scrolls inside itself: a control is reachable if it lies inside the
      // sheet's box with the sheet scrolled to its start OR to its end (as a finger would).
      const inside = () => {
        const box = sheet.getBoundingClientRect();
        return new Map(
          [...sheet.querySelectorAll("button,input")].map((el) => {
            const r = el.getBoundingClientRect();
            return [el, r.top >= box.top - 1 && r.bottom <= box.bottom + 1] as const;
          }),
        );
      };
      sheet.scrollTop = 0;
      const atStart = inside();
      sheet.scrollTop = sheet.scrollHeight;
      const atEnd = inside();
      sheet.scrollTop = 0;
      const out: string[] = [];
      for (const el of sheet.querySelectorAll("button,input")) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim();
        if (!atStart.get(el) && !atEnd.get(el)) out.push(`${label}: unreachable in the sheet`);
        if (el.scrollWidth > el.clientWidth + 1) out.push(`${label}: label spills its chip`);
        // A one-word chip is sized by its word and must never break it: only the History chips
        // may wrap anywhere, and "Freehand" in two lines means that rule leaked onto the tools.
        if (!/\s/.test(label) && !el.closest(".mobile-drawing-sheet__history") && el.firstChild) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
          if (lines.size > 1) out.push(`${label}: a one-word chip broke its word`);
        }
      }
      return out;
    });
    expect(clipped).toEqual([]);
  });
}

// In the sheet's three-column landscape layout the Tool, Settings and History headings share
// one top edge. (The Tool column used to sit at the bottom of its cell so a line that came and
// went could not lift its chips; the line is a fixed slot now, so it need not. This guards the
// outcome only: restoring that alignment does not change it while the Tool column is the tallest.)
for (const viewport of [
  { width: 812, height: 375 },
  { width: 667, height: 375 },
]) {
  test(`the Tool, Settings and History headings share a top edge in landscape (${viewport.width}x${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await joinMobileTable(page);
    await selectMobileTool(page, /^Draw$/i);
    const toolbar = page.getByRole("toolbar", { name: /Drawing tools/i });
    await expect(toolbar).toBeVisible();
    const tops = await Promise.all(
      ["Tool", "Settings", "History"].map(async (name) => {
        const heading = toolbar.getByRole("heading", { name, exact: true });
        return (await heading.boundingBox())!.y;
      }),
    );
    expect(Math.max(...tops) - Math.min(...tops), `heading tops ${tops.join(", ")}`).toBeLessThan(
      2,
    );
  });
}
