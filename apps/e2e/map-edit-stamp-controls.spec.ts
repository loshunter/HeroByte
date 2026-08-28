/**
 * The stamp-vs-tile toggle and the rotate pair, on the DESKTOP.
 *
 * These two controls were built for M7's phone, where there is no Alt and no R.
 * They are on the desktop palette too, and that is not decoration: both
 * surfaces now write the same state, so a DM who toggles stamp on a tablet and
 * rotates the window into the desktop layout can still see what is armed. An
 * armed mode showing nowhere is the failure this arc has paid for more than
 * once.
 *
 * What this file really guards is the forwarding. `mapEditPlacementDials` is
 * OPTIONAL on MapBoard and travels MainLayout -> CenterCanvasLayout ->
 * MapBoard; dropping any link passes tsc, every unit suite and the whole mobile
 * project, while silently reverting R and the buttons to doing nothing. The
 * phone half has a completeness pin in MobileLayout.test.tsx. The desktop half
 * has this.
 *
 * The assertion is on the ELEMENT the server received, never on the button's
 * pressed state — a control wired to nothing looks identical to one wired to
 * something until a drop lands.
 */
import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";

/** Every element on the table, with the two fields the drop MODE decides: a
 * tile snaps to the lattice and never rotates, a free stamp does both. */
const placed = (page: Page) =>
  page.evaluate(
    () =>
      window.__HERO_BYTE_E2E__?.snapshot?.mapElements?.layers?.flatMap((layer) =>
        layer.elements.map((element) => ({
          type: element.type,
          rotation: element.transform.rotation ?? 0,
        })),
      ) ?? [],
  );

async function boardCenter(page: Page) {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A click on the canvas — place drops on PRESS for a mouse, unlike a finger. */
async function clickBoard(page: Page, at: { x: number; y: number }) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
}

test.describe("map-edit — stamp mode and rotation from the palette", () => {
  test("the toggle and the rotate buttons change what the table receives", async ({ page }) => {
    test.setTimeout(120_000);
    await joinDefaultRoomAsDM(page);
    await page.getByTitle("Author the live map on the table").click();
    await page.getByRole("button", { name: /START LIVE MAP/i }).click();
    await page.waitForFunction(
      () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
      undefined,
      { timeout: 20_000 },
    );

    const center = await boardCenter(page);
    await page.getByRole("button", { name: /📦 Place/ }).click();

    // A plain click is a grid TILE — the positive control for the toggle.
    expect(await placed(page)).toHaveLength(0);
    await clickBoard(page, { x: center.x - 120, y: center.y - 60 });
    await expect.poll(() => placed(page), { timeout: 20_000 }).toHaveLength(1);
    expect((await placed(page))[0]!.type).toBe("tile");

    // Toggle to free stamp and turn it twice: 30°.
    await page.getByRole("button", { name: /Grid tile/ }).click();
    const clockwise = page.getByTitle(/Rotate clockwise/i);
    await expect(clockwise).toBeVisible();
    await clockwise.click();
    await clockwise.click();
    // The readout is on the counter-clockwise button, which carries the angle.
    await expect(page.getByTitle(/Rotate counter-clockwise/i)).toContainText("30°");

    // Settle: a drop is skipped, not queued, while a command is in flight.
    await page.waitForTimeout(800);
    await clickBoard(page, { x: center.x + 120, y: center.y + 60 });
    await expect.poll(() => placed(page), { timeout: 20_000 }).toHaveLength(2);

    const stamp = (await placed(page)).find((element) => element.type === "stamp");
    expect(stamp, "the second drop should be a free stamp, not another tile").toBeDefined();
    expect(stamp!.rotation).toBe(30);
  });
});
