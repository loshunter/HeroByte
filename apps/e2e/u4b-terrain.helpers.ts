import { expect, type Page } from "./fixtures";
import type { Locator, TestInfo } from "@playwright/test";
import type { MapDocument, TerrainPaintCell } from "@herobyte/shared";
import { activate, dock, mapContent } from "./u2-cancel.helpers";
import { closeBuildTools, openBuildTools } from "./u3b-palette.helpers";
import { chooseBuildTool } from "./build-palette.helpers";

export async function armSize(page: Page, mobile: boolean, size: number, erase = false) {
  await openBuildTools(page, mobile);
  await chooseBuildTool(page, erase ? "erase" : "terrain", mobile);
  const button = page.getByRole("button", { name: `${size} × ${size}`, exact: true });
  await activate(button, mobile);
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await closeBuildTools(page, mobile);
}

/** Input point derived from the document grid and camera, never from the preview. */
export async function targetCell(page: Page, doc: MapDocument, mobile: boolean) {
  return page.evaluate(
    ({ grid, mobile }) => {
      const cam = window.__HERO_BYTE_E2E__?.cam;
      const canvas = document.querySelector('[data-testid="map-board"] canvas');
      if (!cam || !canvas) throw new Error("Missing camera/canvas");
      const box = canvas.getBoundingClientRect();
      const cellX = Math.max(
        3,
        Math.floor((box.width * (mobile ? 0.33 : 0.62) - cam.x) / cam.scale / grid.size),
      );
      const cellY = Math.max(3, Math.floor((box.height * 0.4 - cam.y) / cam.scale / grid.size));
      const at = (x: number) => ({
        x: box.x + cam.x + (grid.offsetX + (x + 0.5) * grid.size) * cam.scale,
        y: box.y + cam.y + (grid.offsetY + (cellY + 0.5) * grid.size) * cam.scale,
      });
      return { cellX, cellY, from: at(cellX), to: at(cellX + 3) };
    },
    { grid: doc.grid, mobile },
  );
}

export const square = (
  x: number,
  y: number,
  size: number,
  assetId: string | null = "terrain:grass",
) => {
  const result: TerrainPaintCell[] = [],
    radius = (size - 1) / 2;
  for (let row = y - radius; row <= y + radius; row++)
    for (let col = x - radius; col <= x + radius; col++) result.push({ x: col, y: row, assetId });
  return result;
};
export const sortedCells = (cells: TerrainPaintCell[]) =>
  cells.map((c) => `${c.x},${c.y}:${c.assetId}`).sort();

/** Observe real Konva nodes; never call a stage or E2E state setter. */
export async function footprint(page: Page) {
  return page.evaluate(() => {
    type Node = {
      x(): number;
      y(): number;
      width(): number;
      height(): number;
      isVisible(): boolean;
    };
    const konva = (window as Window & { Konva?: { stages: { find(selector: string): Node[] }[] } })
      .Konva;
    if (!konva?.stages.length) throw new Error("No live Konva stage");
    return konva.stages
      .flatMap((stage) => stage.find(".map-edit-preview:brush-footprint"))
      .filter((node) => node.isVisible())
      .map((node) => ({ x: node.x(), y: node.y(), width: node.width(), height: node.height() }));
  });
}

export async function expectFootprint(page: Page, doc: MapDocument, cells: TerrainPaintCell[]) {
  const expected = cells.map((cell) => ({
    x: doc.grid.offsetX + cell.x * doc.grid.size,
    y: doc.grid.offsetY + cell.y * doc.grid.size,
    width: doc.grid.size,
    height: doc.grid.size,
  }));
  await expect.poll(() => footprint(page)).toEqual(expected);
}

/** Keep the brush dimensions together so a wrapped readout cannot split 5 × 5. */
export async function armedSizeFits(page: Page, size: number) {
  const report = await page.getByTestId("map-edit-armed").evaluate((el, size) => {
    const needle = `${size} × ${size}`;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const start = walker.currentNode.textContent?.indexOf(needle) ?? -1;
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(walker.currentNode, start);
      range.setEnd(walker.currentNode, start + needle.length);
      const rects = [...range.getClientRects()];
      const outer = el.getBoundingClientRect();
      return {
        lines: rects.length,
        fits: rects.every(
          (r) =>
            r.left >= outer.left &&
            r.right <= outer.right &&
            r.top >= outer.top &&
            r.bottom <= outer.bottom,
        ),
      };
    }
    throw new Error("Armed size text missing");
  }, size);
  expect(report).toEqual({ lines: 1, fits: true });
}

export async function canvasHit(page: Page, from: { x: number; y: number }, to = from) {
  expect(
    await page.evaluate(
      ([a, b]) =>
        Array.from(
          { length: 13 },
          (_, i) =>
            document.elementFromPoint(
              a.x + ((b.x - a.x) * i) / 12,
              a.y + ((b.y - a.y) * i) / 12,
            ) instanceof HTMLCanvasElement,
        ).every(Boolean),
      [from, to],
    ),
    "gesture reaches canvas",
  ).toBe(true);
}

export async function undoStroke(
  page: Page,
  player: Page,
  mobile: boolean,
  before: Awaited<ReturnType<typeof mapContent>>,
) {
  const undo = mobile
    ? dock(page).getByRole("button", { name: "Undo map edit", exact: true })
    : page.getByTitle("Undo map edit", { exact: true });
  await expect(undo).toBeEnabled();
  await activate(undo, mobile);
  await expect.poll(async () => (await mapContent(page)).terrain).toEqual(before.terrain);
  await expect.poll(async () => (await mapContent(player)).terrain).toEqual(before.terrain);
}

/** Measure actual visible hit and text regions after scrolling each control into view. */
export async function terrainReach(page: Page, controls: Locator[], info: TestInfo, label: string) {
  const report = [];
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    const row = await control.evaluate((el) => {
      const r = el.getBoundingClientRect();
      let left = Math.max(0, r.left),
        top = Math.max(0, r.top),
        right = Math.min(innerWidth, r.right),
        bottom = Math.min(innerHeight, r.bottom);
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p),
          b = p.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(s.overflowX)) {
          left = Math.max(left, b.left);
          right = Math.min(right, b.right);
        }
        if (/auto|scroll|hidden|clip/.test(s.overflowY)) {
          top = Math.max(top, b.top);
          bottom = Math.min(bottom, b.bottom);
        }
      }
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT),
        ranges: DOMRect[] = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        ranges.push(...range.getClientRects());
      }
      return {
        name: el.textContent?.trim(),
        width: right - left,
        height: bottom - top,
        hit: el.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2)),
        textRanges: ranges.length,
        textFits: ranges.every(
          (b) => b.left >= left && b.right <= right && b.top >= top && b.bottom <= bottom,
        ),
      };
    });
    expect(row.width, JSON.stringify(row)).toBeGreaterThanOrEqual(44);
    expect(row.height, JSON.stringify(row)).toBeGreaterThanOrEqual(44);
    expect(row.hit, JSON.stringify(row)).toBe(true);
    expect(row.textRanges).toBeGreaterThan(0);
    expect(row.textFits, JSON.stringify(row)).toBe(true);
    report.push(row);
  }
  await info.attach(label, { body: JSON.stringify(report), contentType: "application/json" });
}
