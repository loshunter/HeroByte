import { expect, type Page } from "./fixtures";
import type { MapDocument } from "@herobyte/shared";
import { dock } from "./u2-cancel.helpers";

export async function openBuildTools(page: Page, mobile: boolean) {
  if (mobile && !(await page.getByRole("dialog", { name: "Map tools", exact: true }).isVisible()))
    await dock(page).getByRole("button", { name: "Tool", exact: true }).tap();
}

export async function closeBuildTools(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole("button", { name: /To the map/i }).tap();
}

/** Measure clipped hit regions as well as CSS boxes after scrolling active settings. */
export async function pinnedControls(page: Page, mobile: boolean) {
  await page.getByTestId("build-settings").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const targets = [
    page.getByTestId("build-tool-select"),
    page.getByTestId("build-tool-eyedropper"),
    mobile
      ? page.getByTestId("mobile-layers-toggle")
      : page.getByRole("button", { name: "🗂 Layers", exact: true }),
    page.getByRole("button", { name: "Done building", exact: true }),
    mobile
      ? dock(page).getByRole("button", { name: "Undo map edit", exact: true })
      : page.getByTitle("Undo map edit", { exact: true }),
  ];
  const measured = [];
  for (const control of targets) {
    const box = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      let left = rect.left,
        top = rect.top,
        right = rect.right,
        bottom = rect.bottom;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (!/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflow)) continue;
        const clip = parent.getBoundingClientRect();
        left = Math.max(left, clip.left);
        top = Math.max(top, clip.top);
        right = Math.min(right, clip.right);
        bottom = Math.min(bottom, clip.bottom);
      }
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      return {
        name: element.textContent?.trim(),
        x: rect.x,
        y: rect.y,
        width: right - left,
        height: bottom - top,
        visible: left >= 0 && top >= 0 && right <= innerWidth && bottom <= innerHeight,
        hittable: hit === element || Boolean(hit && element.contains(hit)),
      };
    });
    expect(box.visible, JSON.stringify(box)).toBe(true);
    expect(box.hittable, JSON.stringify(box)).toBe(true);
    expect(box.width, JSON.stringify(box)).toBeGreaterThanOrEqual(44);
    expect(box.height, JSON.stringify(box)).toBeGreaterThanOrEqual(44);
    measured.push(box);
  }
  return measured;
}

/** Click an authored location and inspect the topmost hit; never write app state. */
export async function inspectStamp(page: Page, mobile: boolean, document: MapDocument) {
  await closeBuildTools(page, mobile);
  const stamps = document.elements.filter((element) => element.type === "stamp");
  expect(stamps.length).toBeGreaterThan(0);
  const point = await page.evaluate((candidates) => {
    const cam = window.__HERO_BYTE_E2E__?.cam;
    const canvas = window.document.querySelector('[data-testid="map-board"] canvas');
    if (!cam || !canvas) throw new Error("Map unavailable");
    const box = canvas.getBoundingClientRect();
    for (const stamp of candidates) {
      const x = box.x + cam.x + stamp.transform.x * cam.scale;
      const y = box.y + cam.y + stamp.transform.y * cam.scale;
      if (window.document.elementFromPoint(x, y) instanceof HTMLCanvasElement) return { x, y };
    }
    throw new Error("No authored stamp is on uncovered canvas");
  }, stamps);
  if (mobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await openBuildTools(page, mobile);
  if (mobile) {
    await expect(page.getByTestId("mobile-select-delete")).toBeEnabled();
    await page.getByTestId("mobile-inspector-toggle").tap();
    await expect(page.getByTestId("mobile-inspector")).toBeInViewport();
  } else {
    await page.getByRole("button", { name: "🔍 Inspect", exact: true }).click();
    await expect(
      page.getByRole("group", { name: "Selected properties", exact: true }),
    ).toBeVisible();
    const advanced = page.getByRole("button", { name: "Position and scale", exact: true });
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
    await advanced.click();
    const x = page.getByRole("spinbutton", { name: "X (px)", exact: true });
    await x.scrollIntoViewIfNeeded();
    await expect(x).toBeInViewport({
      ratio: 1,
    });
  }
}
