/**
 * The stable Stop slot cancels a real pending gesture.
 * A successful canvas commit is required first. Disabled before a gesture is
 * intentional; the second thumb must disable Stop on press, before any lift.
 * Trusted CDP input exercises the pointer path while the first finger stays held.
 */
import { expect, test, type Page } from "../fixtures";
import type { CDPSession, Locator } from "@playwright/test";
import { elevateToDM } from "../helpers";
import { armLiveMapEdit, joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag, touchTap, type Pt } from "./touch.helpers";

function wallCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0);
}
const elements = (page: Page) =>
  page.evaluate(
    () =>
      window.__HERO_BYTE_E2E__?.snapshot?.mapElements?.layers?.reduce(
        (total, layer) => total + layer.elements.length,
        0,
      ) ?? 0,
  );

async function enterLiveMapEdit(page: Page): Promise<void> {
  await joinMobileTable(page);
  await elevateToDM(page);
  await page.getByRole("button", { name: /^DM$/i }).click();
  await page.getByRole("button", { name: /Edit the live map/i }).click();
  const dock = page.getByRole("navigation", { name: /Map edit actions/i });
  await expect(dock).toBeVisible();
  await dock.getByRole("button", { name: /Tool/ }).click();
  await page.getByRole("button", { name: /Start live map/i }).click();
  await page.waitForFunction(
    () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
    undefined,
    { timeout: 30_000 },
  );
  await expect(page.getByRole("button", { name: /Wall/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Close tools/i }).click();
  await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
}

async function send(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", points: Pt[]) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, id) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
      id,
    })),
  });
}

// Stop lives outside the canvas. Hold the first finger STILL after the second
// lands so the stage's two-finger movement cancellation cannot satisfy this test.
async function pressStopWhileHeld(
  cdp: CDPSession,
  from: Pt,
  to: Pt,
  cancel: Locator,
  dock: Locator,
) {
  await expect(cancel).toBeDisabled();
  const originalSlot = await cancel.elementHandle();
  if (!originalSlot) throw new Error("Stop slot missing before gesture");
  let holding = false;
  try {
    await send(cdp, "touchStart", [from]);
    holding = true;
    for (let step = 1; step <= 6; step++) {
      await send(cdp, "touchMove", [
        { x: from.x + ((to.x - from.x) * step) / 6, y: from.y + ((to.y - from.y) * step) / 6 },
      ]);
    }
    // Positive pending prerequisite: a no-op canvas cannot pass by leaving Stop disabled.
    await expect(cancel).toBeEnabled();
    await expect(cancel).toHaveText(/Stop$/);
    await expect(dock.getByRole("button")).toHaveCount(5);
    const box = await cancel.boundingBox();
    if (!box) throw new Error("Enabled Stop slot has no box");
    const thumb = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await send(cdp, "touchStart", [to, thumb]);
    // Assert BEFORE either finger lifts: an onClick-only implementation fails here.
    await expect(cancel).toBeDisabled();
    expect(await originalSlot.evaluate((node) => node.isConnected)).toBe(true);
    expect(
      await originalSlot.evaluate(
        (node) => node === node.parentElement?.querySelectorAll("button")[4],
      ),
    ).toBe(true);
    await expect(dock.getByRole("button")).toHaveCount(5);
    await send(cdp, "touchEnd", [to]);
    await send(cdp, "touchEnd", []);
    holding = false;
  } finally {
    if (holding) await send(cdp, "touchEnd", []);
    await originalSlot.dispose();
  }
}

async function positions(page: Page) {
  const box = await page.getByTestId("map-board").locator("canvas").first().boundingBox();
  if (!box) throw new Error("Canvas has no box");
  return (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
}

test.describe("the stable Stop slot", () => {
  test("a second-thumb press mid-drag cancels before lift and the next drag commits", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 820, height: 1180 });
    await enterLiveMapEdit(page);
    const dock = page.getByRole("navigation", { name: /Map edit actions/i });
    const cancel = dock.getByRole("button", { name: "Cancel placement", exact: true });
    await expect(cancel).toBeDisabled();
    await expect(dock.getByRole("button").nth(4)).toHaveAccessibleName("Cancel placement");
    const at = await positions(page);
    const cdp = await openTouch(page);
    try {
      // A server-confirmed positive commit precedes any cancellation claim.
      expect(await wallCount(page)).toBe(0);
      await touchDrag(cdp, at(0.3, 0.3), [at(0.7, 0.3)]);
      await expect.poll(() => wallCount(page), { timeout: 30_000 }).toBe(1);
      await expect(dock.getByText("Saving…")).toHaveCount(0);
      await expect(cancel).toBeDisabled();

      await pressStopWhileHeld(cdp, at(0.3, 0.5), at(0.7, 0.5), cancel, dock);
      await page.waitForTimeout(2_000);
      expect(await wallCount(page)).toBe(1);

      await touchDrag(cdp, at(0.3, 0.7), [at(0.7, 0.7)]);
      await expect.poll(() => wallCount(page), { timeout: 30_000 }).toBe(2);
      await expect(cancel).toBeDisabled();
    } finally {
      await cdp.detach();
    }
  });

  test("a second-thumb press mid-aim cancels before lift and the next place commits", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { dock, toolGrid } = await armLiveMapEdit(page, { width: 820, height: 1180 });
    await toolGrid.getByRole("button", { name: /^Place$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    const cancel = dock.getByRole("button", { name: "Cancel placement", exact: true });
    await expect(cancel).toBeDisabled();
    const at = await positions(page);
    const cdp = await openTouch(page);
    try {
      expect(await elements(page)).toBe(0);
      await touchTap(cdp, at(0.4, 0.3));
      await expect.poll(() => elements(page), { timeout: 30_000 }).toBe(1);
      await expect(dock.getByText("Saving…")).toHaveCount(0);
      await expect(cancel).toBeDisabled();

      await pressStopWhileHeld(cdp, at(0.3, 0.5), at(0.5, 0.5), cancel, dock);
      await page.waitForTimeout(2_000);
      expect(await elements(page)).toBe(1);

      await touchTap(cdp, at(0.6, 0.35));
      await expect.poll(() => elements(page), { timeout: 30_000 }).toBe(2);
      await expect(cancel).toBeDisabled();
    } finally {
      await cdp.detach();
    }
  });
});
