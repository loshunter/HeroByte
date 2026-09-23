import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

const readDrawings = (page: Page) =>
  page.evaluate(() => {
    const drawings = window.__HERO_BYTE_E2E__?.snapshot?.drawings;
    if (!drawings) throw new Error("Drawing snapshot is unavailable");
    return drawings;
  });

async function drawStroke(page: Page, verticalOffset = 0) {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  // Stay right of the drawing palette and left of the party cards.
  const x = box!.x + box!.width * 0.45;
  const y = box!.y + box!.height * 0.4 + verticalOffset;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y + 35, { steps: 12 });
  await page.mouse.up();
}

test("only the DM can clear drawings, and cancelling preserves drawings and undo history", async ({
  browser,
}, testInfo) => {
  const dmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();

  try {
    await joinDefaultRoomAsDM(dm);
    await joinDefaultRoom(player);
    const dmUid = await dm.evaluate(() => window.__HERO_BYTE_E2E__?.uid);
    const playerUid = await player.evaluate(() => window.__HERO_BYTE_E2E__?.uid);
    expect(dmUid).toBeTruthy();
    expect(playerUid).toBeTruthy();
    expect(playerUid).not.toBe(dmUid);

    await player.getByRole("button", { name: /Draw Tools/i }).click();
    await expect(player.getByRole("button", { name: /Close.*DRAWING TOOLS/i })).toBeVisible();
    await expect(player.getByRole("button", { name: /Clear All/i })).toHaveCount(0);
    await drawStroke(player);
    await expect.poll(() => readDrawings(player)).toHaveLength(1);
    const playerDrawing = (await readDrawings(player))[0]!;
    expect(playerDrawing.owner).toBe(playerUid);
    expect(playerDrawing.type).toBe("freehand");
    await expect.poll(() => readDrawings(dm)).toEqual([playerDrawing]);
    await expect(player.getByRole("button", { name: /Undo/i })).toBeEnabled();
    await expect(player.getByRole("button", { name: /Clear All/i })).toHaveCount(0);

    await dm.getByRole("button", { name: /Draw Tools/i }).click();
    const clearAll = dm.getByRole("button", { name: /Clear All/i });
    await expect(clearAll).toBeVisible();
    // The DM also needs an owned stroke so cancellation tests real local and
    // server undo history, not merely an unchanged count on an empty stack.
    await drawStroke(dm, 90);
    await expect.poll(() => readDrawings(dm)).toHaveLength(2);
    const beforeCancel = await readDrawings(dm);
    expect(beforeCancel[1]!.owner).toBe(dmUid);
    await expect.poll(() => readDrawings(player)).toEqual(beforeCancel);
    await expect(player.getByRole("button", { name: /Clear All/i })).toHaveCount(0);

    const undo = dm.getByRole("button", { name: /Undo/i });
    const redo = dm.getByRole("button", { name: /Redo/i });
    await expect(undo).toBeEnabled();
    const cancelledDialog = dm.waitForEvent("dialog");
    const cancelClick = clearAll.click();
    const cancelPrompt = await cancelledDialog;
    expect(cancelPrompt.type()).toBe("confirm");
    expect(cancelPrompt.message()).toBe("Clear all drawings from the map? This cannot be undone.");
    await cancelPrompt.dismiss();
    await cancelClick;

    await expect.poll(() => readDrawings(dm)).toEqual(beforeCancel);
    await expect.poll(() => readDrawings(player)).toEqual(beforeCancel);
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect.poll(() => readDrawings(dm)).toEqual([playerDrawing]);
    await expect.poll(() => readDrawings(player)).toEqual([playerDrawing]);
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect.poll(() => readDrawings(dm)).toEqual(beforeCancel);
    await expect.poll(() => readDrawings(player)).toEqual(beforeCancel);

    await testInfo.attach("player-drawing-actions", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
    await testInfo.attach("dm-cancel-preserves-drawings", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });

    const acceptedDialog = dm.waitForEvent("dialog");
    const confirmClick = clearAll.click();
    const confirmPrompt = await acceptedDialog;
    expect(confirmPrompt.type()).toBe("confirm");
    await confirmPrompt.accept();
    await confirmClick;
    await expect.poll(() => readDrawings(dm)).toEqual([]);
    await expect.poll(() => readDrawings(player)).toEqual([]);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
