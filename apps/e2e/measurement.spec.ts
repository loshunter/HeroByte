import { expect, test } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

/**
 * S6 — distance and templates the table agrees on.
 *
 * Three things the unit tests cannot prove on their own: the corrected number
 * reaches a real canvas, a measurement drawn on one client reaches another,
 * and a dragged template lands on the table as a real drawing record.
 */

/**
 * A screen point on the map canvas, offset by a whole number of grid CELLS
 * from a fixed anchor near the canvas centre.
 *
 * Deliberately relative, not absolute: the camera is wherever the last test
 * left it, so converting a fixed world cell to screen coordinates lands
 * off-canvas as often as not. Offsetting in cells keeps the WORLD delta an
 * exact multiple of the grid, which is what the template assertions need.
 */
async function mapPoint(
  page: import("@playwright/test").Page,
  cellsRight: number,
  cellsDown: number,
) {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas has no bounding box");
  const { grid, scale } = await page.evaluate(() => ({
    grid: window.__HERO_BYTE_E2E__?.gridSize ?? 50,
    scale: window.__HERO_BYTE_E2E__?.cam?.scale ?? 1,
  }));
  const point = {
    x: box.x + box.width * 0.3 + cellsRight * grid * scale,
    y: box.y + box.height * 0.35 + cellsDown * grid * scale,
  };
  // The map canvas is SHORT — the entities panel takes the bottom half — so a
  // few cells at a zoomed-in camera walks straight off it and the click lands
  // on the panel instead. Fail loudly rather than time out on a mystery.
  if (point.x > box.x + box.width || point.y > box.y + box.height) {
    throw new Error(
      `mapPoint(${cellsRight}, ${cellsDown}) is outside the canvas at scale ${scale}`,
    );
  }
  return point;
}

/** A point at the given fraction of the map canvas. Camera-independent. */
async function canvasPoint(
  page: import("@playwright/test").Page,
  fractionX: number,
  fractionY: number,
) {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas has no bounding box");
  return { x: box.x + box.width * fractionX, y: box.y + box.height * fractionY };
}

test.describe("S6 measurement", () => {
  test("using the real measure tool puts a measurement on the wire", async ({ browser }) => {
    // What this proves that no unit test can: the tool arms, the canvas
    // receives the clicks, and usePointerTool's broadcast survives the real
    // socket. It does NOT assert the readout — Konva draws text to a canvas,
    // so there is no node to query; the number under each diagonal rule is
    // asserted in MeasureLayer.test.tsx, against the same shared function.
    const measurer = await browser.newPage();
    const watcher = await browser.newPage();
    try {
      await joinDefaultRoom(measurer);
      await joinDefaultRoom(watcher);
      await measurer.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.cam));
      const measurerUid = (await measurer.evaluate(() => window.__HERO_BYTE_E2E__?.uid))!;

      await measurer.getByTitle("Measure distances on the grid").click();
      // Fractions, not cells: this test asserts the PATH works, not a
      // distance, so it must not depend on where the camera happens to sit.
      const from = await canvasPoint(measurer, 0.35, 0.35);
      const to = { x: from.x + 120, y: from.y + 60 };
      await measurer.mouse.click(from.x, from.y);
      await measurer.mouse.move(to.x, to.y, { steps: 8 });
      await measurer.mouse.click(to.x, to.y);

      await watcher.waitForFunction(
        (uid) =>
          (window.__HERO_BYTE_E2E__?.remoteMeasurements ?? []).some(
            (entry) => entry.uid === uid && entry.start && entry.end,
          ),
        measurerUid,
        { timeout: 10_000 },
      );

      // The SECOND CLICK froze it. Without that, the rubber band alone would
      // satisfy the wait above and this test would pass on a tool that wipes
      // the reading the moment you try to commit it — which is exactly the bug
      // this arc found. Move the mouse well away and the line must not follow.
      const frozen = await watcher.evaluate(
        (uid) =>
          (window.__HERO_BYTE_E2E__?.remoteMeasurements ?? []).find((entry) => entry.uid === uid)
            ?.end,
        measurerUid,
      );
      await measurer.mouse.move(from.x + 400, from.y, { steps: 10 });
      await measurer.waitForTimeout(1_000);
      const stillFrozen = await watcher.evaluate(
        (uid) =>
          (window.__HERO_BYTE_E2E__?.remoteMeasurements ?? []).find((entry) => entry.uid === uid)
            ?.end,
        measurerUid,
      );
      expect(stillFrozen).toEqual(frozen);
    } finally {
      await measurer.close();
      await watcher.close();
    }
  });

  test("the server stamps the author, and stopping clears the line", async ({ browser }) => {
    const measurer = await browser.newPage();
    const watcher = await browser.newPage();
    try {
      await joinDefaultRoom(measurer);
      await joinDefaultRoom(watcher);
      await measurer.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.uid));
      const measurerUid = (await measurer.evaluate(() => window.__HERO_BYTE_E2E__?.uid))!;

      // Keyed on THIS measurer's uid throughout: the default table is shared,
      // so "the list is empty" is not a safe assertion to build on.
      await measurer.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "measure",
          measure: { start: { x: 125, y: 125 }, end: { x: 325, y: 325 } },
        } as never);
      });

      await watcher.waitForFunction(
        (uid) =>
          (window.__HERO_BYTE_E2E__?.remoteMeasurements ?? []).some((entry) => entry.uid === uid),
        measurerUid,
        { timeout: 10_000 },
      );
      const seen = await watcher.evaluate(
        (uid) =>
          (window.__HERO_BYTE_E2E__?.remoteMeasurements ?? []).find((entry) => entry.uid === uid),
        measurerUid,
      );
      expect(seen?.start).toEqual({ x: 125, y: 125 });
      expect(seen?.end).toEqual({ x: 325, y: 325 });

      // The measurer does NOT keep their own echo in the remote list; their
      // own line comes from local state, and drawing it twice would look
      // doubled while dragging.
      const ownEcho = await measurer.evaluate(
        (uid) =>
          (window.__HERO_BYTE_E2E__?.remoteMeasurements ?? []).filter((entry) => entry.uid === uid),
        measurerUid,
      );
      expect(ownEcho).toHaveLength(0);

      await measurer.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "measure", measure: null } as never);
      });
      await watcher.waitForFunction(
        (uid) =>
          !(window.__HERO_BYTE_E2E__?.remoteMeasurements ?? []).some((entry) => entry.uid === uid),
        measurerUid,
        { timeout: 10_000 },
      );
    } finally {
      await measurer.close();
      await watcher.close();
    }
  });

  test("the DM's diagonal rule reaches every client", async ({ browser }) => {
    const dm = await browser.newPage();
    const player = await browser.newPage();
    try {
      await joinDefaultRoomAsDM(dm);
      await joinDefaultRoom(player);

      // Establish a known starting point rather than assuming one: another
      // spec may have run first on this shared table.
      await dm.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "set-diagonal-rule", rule: "5e" } as never);
      });
      await player.waitForFunction(
        () => window.__HERO_BYTE_E2E__?.snapshot?.diagonalRule === "5e",
        undefined,
        { timeout: 10_000 },
      );

      await dm.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "set-diagonal-rule",
          rule: "pathfinder",
        } as never);
      });

      await player.waitForFunction(
        () => window.__HERO_BYTE_E2E__?.snapshot?.diagonalRule === "pathfinder",
        undefined,
        { timeout: 10_000 },
      );

      // Put it back. The default table is SHARED between specs and between
      // runs, so a spec that leaves the rule on "pathfinder" breaks its own
      // opening assertion the next time it runs.
      await dm.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "set-diagonal-rule",
          rule: "5e",
        } as never);
      });
      await player.waitForFunction(
        () => window.__HERO_BYTE_E2E__?.snapshot?.diagonalRule === "5e",
        undefined,
        { timeout: 10_000 },
      );
    } finally {
      await dm.close();
      await player.close();
    }
  });
});

test.describe("S6 area templates", () => {
  test("dragging a cone lands a snapped template on the table", async ({ page }) => {
    await joinDefaultRoom(page);
    await page.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.cam));

    const before = await page.evaluate(
      () => window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0,
    );

    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(page.locator("text=DRAWING TOOLS")).toBeVisible();
    const coneButton = page.getByRole("button", { name: /◺ Cone/ });
    await coneButton.click();
    // Prove the tool armed, so a later failure points at the drag and not at
    // a button that quietly moved. `jrpg-button-primary` is how JRPGButton
    // renders variant="primary".
    await expect(coneButton).toHaveClass(/jrpg-button-primary/);

    const from = await mapPoint(page, 0, 0);
    const to = await mapPoint(page, 3, 0);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();

    await page.waitForFunction(
      (previous) => (window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0) > previous,
      before,
      { timeout: 10_000 },
    );

    const landed = await page.evaluate(() => {
      const drawings = window.__HERO_BYTE_E2E__?.snapshot?.drawings ?? [];
      const last = drawings.at(-1);
      return {
        type: last?.type ?? null,
        template: last?.template ?? null,
        pointCount: Array.isArray(last?.points) ? last!.points.length : 0,
        owner: last?.owner ?? null,
        uid: window.__HERO_BYTE_E2E__?.uid ?? null,
      };
    });

    expect(landed.type).toBe("template");
    expect(landed.template?.kind).toBe("cone");
    // 3 squares dragged at 5 ft each; a cone is a triangle.
    expect(landed.template?.sizeFeet).toBe(15);
    expect(landed.pointCount).toBe(3);
    // The server stamps the owner; the client never sends one.
    expect(landed.owner).toBe(landed.uid);
  });

  test("a click that never moved leaves no template behind", async ({ page }) => {
    await joinDefaultRoom(page);
    await page.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.cam));

    const before = await page.evaluate(
      () => window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0,
    );

    await page.getByRole("button", { name: /Draw Tools/i }).click();
    await page.getByRole("button", { name: /◯ Burst/ }).click();

    const spot = await mapPoint(page, 1, 1);
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(750);

    const after = await page.evaluate(
      () => window.__HERO_BYTE_E2E__?.snapshot?.drawings?.length ?? 0,
    );
    expect(after).toBe(before);
  });
});
