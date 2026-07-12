import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

// End-to-end lock for the live map toolbar (Phase 1, S1–S7): a DM authors a
// room + a door directly on the live table, a player who joins afterwards
// receives the compiled scene + terrain instantly, and operating the door
// round-trips back to the DM. Serial-safe — the shared fixture resets the room
// (and the map store) before the test, so no live map exists at the start.

async function waitForSnap(page: Page, predicate: () => boolean, timeout = 20_000) {
  await page.waitForFunction(predicate, undefined, { timeout });
}

// Map-edit tools are a two-point drag. Intermediate moves so the stage event
// router sees a genuine drag (not a click) and routes it to the active tool.
async function dragBoard(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

async function boardCenter(page: Page) {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function authorLiveScene(page: Page, player: Page) {
  // ---- DM: enter map-edit mode and start the live map ----
  await joinDefaultRoomAsDM(page);
  await page.getByTitle("Author the live map on the table").click();
  await page.getByRole("button", { name: /START LIVE MAP/i }).click();
  await waitForSnap(page, () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId));

  const center = await boardCenter(page);

  // ---- DM: Room tool → drag a rect → walls + terrain compile onto the table ----
  const roomTool = page.getByRole("button", { name: /🏠 Room/ });
  await expect(roomTool).toBeVisible();
  await roomTool.click();
  await dragBoard(
    page,
    { x: center.x - 120, y: center.y - 120 },
    { x: center.x + 120, y: center.y + 120 },
  );
  await waitForSnap(page, () => {
    const s = window.__HERO_BYTE_E2E__?.snapshot;
    return (s?.compiledScene?.walls?.length ?? 0) > 0 && Boolean(s?.mapTerrain);
  });

  // ---- DM: Door tool → drag a segment → a door compiles in ----
  // Let the room's placeRoom command fully settle first: a tool's onMouseUp
  // skips the commit while a command is in flight (no retry). Use the same 240px
  // span the room proved clears ≥1 grid cell after snapping (a shorter drag can
  // collapse to zero length on a zoomed-out camera → null draft).
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /🚪 Door/ }).click();
  await dragBoard(
    page,
    { x: center.x - 120, y: center.y + 40 },
    { x: center.x + 120, y: center.y + 40 },
  );
  await waitForSnap(
    page,
    () => (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.length ?? 0) > 0,
  );

  // ---- Player: joins afterwards and instantly receives the authored scene ----
  await joinDefaultRoom(player);
  await waitForSnap(player, () => {
    const s = window.__HERO_BYTE_E2E__?.snapshot;
    return (
      (s?.compiledScene?.walls?.length ?? 0) > 0 &&
      Boolean(s?.mapTerrain) &&
      (s?.compiledScene?.doors?.length ?? 0) > 0
    );
  });

  // ---- Door round-trip: the player operates the door; the DM sees it flip ----
  // A real fog-of-war canvas click is a pre-existing DoorsLayer concern; here we
  // exercise the live-authoring → player-interactive → back-to-DM arc via the
  // same toggle-door message a player's door click produces.
  const doorBefore = await player.evaluate(
    () => window.__HERO_BYTE_E2E__!.snapshot!.compiledScene!.doors[0]!.state,
  );
  await player.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__!;
    const doorId = data.snapshot!.compiledScene!.doors[0]!.id;
    data.sendMessage!({ t: "toggle-door", doorId });
  });

  // Both the player and the DM converge on the new door state.
  for (const p of [player, page]) {
    await p.waitForFunction(
      (before) => {
        const d = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.[0];
        return Boolean(d) && d!.state !== before;
      },
      doorBefore,
      { timeout: 20_000 },
    );
  }
}

test.describe("Live map toolbar smoke", () => {
  test("DM authors a room + door live; a player sees them and operates the door", async ({
    browser,
  }) => {
    test.setTimeout(90_000);

    // Separate browser contexts → isolated storage → distinct session UIDs, so
    // the player is a genuinely separate client (a shared context would collide
    // the DM's UID and trigger a connection conflict).
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const page = await dmContext.newPage();
    const player = await playerContext.newPage();
    try {
      await authorLiveScene(page, player);
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
});
