import { expect, type Page } from "./fixtures";
import type { Locator, TestInfo } from "@playwright/test";
import type { Pt } from "./mobile/touch.helpers";
import { openTouch, touchDrag } from "./mobile/touch.helpers";

export const ink = (page: Page) =>
  page.evaluate(() => {
    const drawings = window.__HERO_BYTE_E2E__?.snapshot?.drawings;
    if (!Array.isArray(drawings)) throw new Error("Drawing snapshot unavailable or malformed");
    return drawings;
  });

export async function setRange(control: Locator, value: number) {
  await control.focus();
  await control.press("Home");
  const minimum = Number(await control.getAttribute("min"));
  for (let i = minimum; i < value; i++) await control.press("ArrowRight");
  await expect(control).toHaveValue(String(value));
}

export async function gesture(page: Page, from: Pt, to: Pt, touch: boolean) {
  const clear = await page.evaluate(
    ([a, b]) =>
      Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        return (
          document.elementFromPoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) instanceof
          HTMLCanvasElement
        );
      }).every(Boolean),
    [from, to],
  );
  expect(clear, "actual input must reach uncovered canvas").toBe(true);
  if (touch) {
    const cdp = await openTouch(page);
    await touchDrag(cdp, from, [to]);
    await cdp.detach();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
}

export async function drawingReach(page: Page, info: TestInfo, label: string, collapsed = false) {
  const report = await page.locator(".mobile-drawing-sheet").evaluate((sheet) => {
    const visibleBounds = (el: Element) => {
      const r = el.getBoundingClientRect();
      let left = Math.max(0, r.left),
        top = Math.max(0, r.top);
      let right = Math.min(innerWidth, r.right),
        bottom = Math.min(innerHeight, r.bottom);
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const box = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          left = Math.max(left, box.left + parent.clientLeft);
          right = Math.min(right, box.left + parent.clientLeft + parent.clientWidth);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          top = Math.max(top, box.top + parent.clientTop);
          bottom = Math.min(bottom, box.top + parent.clientTop + parent.clientHeight);
        }
      }
      return { left, top, right, bottom };
    };
    const targets = [
      ...sheet.querySelectorAll(
        'button,input:not([type="checkbox"]),label:has(input[type="checkbox"])',
      ),
    ];
    return targets.map((el) => {
      const r = el.getBoundingClientRect();
      const { left, top, right, bottom } = visibleBounds(el);
      const textTarget = el instanceof HTMLInputElement ? el.labels?.[0] : el;
      const textArea = textTarget ? visibleBounds(textTarget) : null;
      const textInset = el instanceof HTMLButtonElement ? 2 : 0;
      const textBounds: DOMRect[] = [];
      if (textTarget) {
        const walker = document.createTreeWalker(textTarget, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          textBounds.push(...range.getClientRects());
        }
      }
      return {
        name:
          el.getAttribute("aria-label") || el.textContent?.trim() || (el as HTMLInputElement).type,
        width: r.width,
        height: r.height,
        exposedWidth: right - left,
        exposedHeight: bottom - top,
        hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        measuredTextRanges: textBounds.length,
        textFits:
          textArea !== null &&
          textBounds.length > 0 &&
          textBounds.every(
            (text) =>
              text.left >= textArea.left + textInset &&
              text.right <= textArea.right - textInset &&
              text.top >= textArea.top + textInset &&
              text.bottom <= textArea.bottom - textInset,
          ),
      };
    });
  });
  await info.attach(`${label}-reach.json`, {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  await info.attach(`${label}.png`, { body: await page.screenshot(), contentType: "image/png" });
  // Nine tools, color, two ranges, fill, disclosure, Undo, Redo, Cancel and Done.
  // Collapsed keeps the five history/disclosure buttons.
  expect(report).toHaveLength(collapsed ? 5 : 18);
  expect(
    report.filter(
      (r) =>
        r.width < 44 ||
        r.height < 44 ||
        r.exposedWidth + 0.1 < r.width ||
        r.exposedHeight + 0.1 < r.height ||
        !r.hit ||
        !r.textFits,
    ),
  ).toEqual([]);
}
