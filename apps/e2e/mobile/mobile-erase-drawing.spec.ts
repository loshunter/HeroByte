/**
 * A phone player can remove their own drawings without a Delete key (U10d).
 *
 * The Delete key (desktop) deletes a selected token or drawing; a phone has none. Help says what to
 * use instead: the Draw sheet's "Undo drawing" takes back your latest, and "Erase drawings" rubs a
 * drawing out under a finger. This spec drives both with real touch, so Help's sentence is a
 * checked claim and a player's drawings are not orphaned on a phone.
 */
import { expect, test } from "../fixtures";
import { boardBox, joinMobileTable, readDrawings, selectMobileTool } from "./mobile.helpers";
import { openTouch, touchDrag } from "./touch.helpers";

test("a phone player takes back their latest drawing with Undo, and rubs one out with Erase drawings", async ({
  page,
}) => {
  await joinMobileTable(page);
  await selectMobileTool(page, /^Draw$/i);
  const sheet = page.getByRole("toolbar", { name: /Drawing tools/i });
  await expect(sheet).toBeVisible();

  const box = await boardBox(page);
  const cdp = await openTouch(page);
  // The upper third: the sheet occupies the lower half of the canvas once it is open.
  const stroke = (y: number) => {
    const from = { x: box.x + box.width * 0.3, y: box.y + box.height * y };
    return { from, via: [{ x: from.x + 120, y: from.y }] };
  };
  const draw = async (y: number) => {
    const { from, via } = stroke(y);
    await touchDrag(cdp, from, via);
  };

  await draw(0.15);
  await expect.poll(async () => (await readDrawings(page)).count).toBe(1);
  await draw(0.25);
  await expect.poll(async () => (await readDrawings(page)).count).toBe(2);

  // Undo drawing takes back the latest.
  await sheet.getByRole("button", { name: /Undo\s*drawing/i }).tap();
  await expect.poll(async () => (await readDrawings(page)).count).toBe(1);

  // Erase drawings rubs the remaining one out under a finger (partial erase may leave nothing).
  await sheet.getByRole("button", { name: /Erase\s*drawings/i }).tap();
  const { from, via } = stroke(0.15);
  await touchDrag(cdp, { x: from.x - 20, y: from.y }, [{ x: via[0]!.x + 40, y: via[0]!.y }], {
    steps: 24,
  });
  await expect.poll(async () => (await readDrawings(page)).count).toBe(0);
});
