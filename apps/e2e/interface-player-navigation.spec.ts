import { expect, test, type Page } from "./fixtures";
import { ownRosterRow } from "./party.helpers";
import { joinDefaultRoom } from "./helpers";
import { elevateViaUI, observeCommands } from "./chat-journey.helpers";

const readDrawings = (page: Page) =>
  page.evaluate(() => {
    const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
    if (!snapshot) throw new Error("Drawing snapshot is unavailable");
    return snapshot.drawings;
  });

const readPositions = (page: Page) =>
  page.evaluate(() => {
    const tokens = window.__HERO_BYTE_E2E__?.snapshot?.tokens;
    if (!tokens) throw new Error("Token snapshot is unavailable");
    return tokens.map(({ id, x, y }) => ({ id, x, y })).sort((a, b) => a.id.localeCompare(b.id));
  });

async function expectActivePanel(page: Page, name: "CHAT" | "ROLLS", focused = false) {
  const list = page.getByRole("tablist", { name: "Chat & Rolls", exact: true });
  await expect(list).toHaveAttribute("aria-orientation", "horizontal");
  await expect(list.getByRole("tab")).toHaveCount(2);
  const selected = list.getByRole("tab", { name, exact: true, selected: true });
  await expect(selected).toHaveAttribute("tabindex", "0");
  await expect(list.getByRole("tab", { selected: false })).toHaveAttribute("tabindex", "-1");
  if (focused) await expect(selected).toBeFocused();
  const panel = page.getByRole("tabpanel", { name, exact: true });
  await expect(panel).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  const tabId = await selected.getAttribute("id");
  const panelId = await panel.getAttribute("id");
  expect(tabId).toBeTruthy();
  expect(panelId).toBeTruthy();
  await expect(selected).toHaveAttribute("aria-controls", panelId!);
  await expect(panel).toHaveAttribute("aria-labelledby", tabId!);
}

test("a player returns from drawing to movement and finds shared chat and remembered rolls", async ({
  browser,
}, testInfo) => {
  const playerContext = await browser.newContext();
  const dmContext = await browser.newContext();
  const player = await playerContext.newPage();
  const dm = await dmContext.newPage();
  const playerCommands = observeCommands(player);
  const dmCommands = observeCommands(dm);

  try {
    await joinDefaultRoom(dm);
    await elevateViaUI(dm);
    await joinDefaultRoom(player);
    const playerUid = await player.evaluate(() => window.__HERO_BYTE_E2E__?.uid);
    const dmUid = await dm.evaluate(() => window.__HERO_BYTE_E2E__?.uid);
    expect(playerUid).toBeTruthy();
    expect(dmUid).toBeTruthy();
    expect(playerUid).not.toBe(dmUid);

    await player.getByRole("button", { name: "✏️ Draw", exact: true }).click();
    const closeDrawingTools = player.getByRole("button", { name: /Close.*DRAWING TOOLS/i });
    await expect(closeDrawingTools).toBeVisible();
    const canvas = player.getByTestId("map-board").locator("canvas").first();
    const board = await canvas.boundingBox();
    expect(board).not.toBeNull();
    const strokeX = board!.x + board!.width * 0.45;
    const strokeY = board!.y + board!.height * 0.4;
    await player.mouse.move(strokeX, strokeY);
    await player.mouse.down();
    await player.mouse.move(strokeX + 90, strokeY + 35, { steps: 12 });
    await player.mouse.up();
    await expect.poll(() => readDrawings(player)).toHaveLength(1);
    const drawings = await readDrawings(player);
    expect(drawings[0]!.owner).toBe(playerUid);
    await expect.poll(() => readDrawings(dm)).toEqual(drawings);

    await player.getByRole("button", { name: "✥ Move", exact: true }).click();
    await expect(closeDrawingTools).toBeHidden();
    // Empty-table arrivals start at (0,0), behind the fixed header. Use the
    // player's own visible focus action; Reset view would put it back at (0,0).
    await ownRosterRow(player)
      .getByRole("button", { name: /^Focus / })
      .click();
    await expect
      .poll(() =>
        player.evaluate(() => {
          const state = window.__HERO_BYTE_E2E__;
          const owned = state?.snapshot?.tokens.find((entry) => entry.owner === state.uid);
          const bounds = document
            .querySelector('[data-testid="map-board"] canvas')
            ?.getBoundingClientRect();
          if (!owned || !state?.cam || !bounds) return false;
          const size = state.gridSize ?? state.snapshot?.gridSize ?? 50;
          const x = state.cam.x + (owned.x * size + size / 2) * state.cam.scale;
          const y = state.cam.y + (owned.y * size + size / 2) * state.cam.scale;
          return Math.abs(x - bounds.width / 2) < 1 && Math.abs(y - bounds.height / 2) < 1;
        }),
      )
      .toBe(true);
    const token = await player.evaluate(() => {
      const state = window.__HERO_BYTE_E2E__;
      const owned = state?.snapshot?.tokens.find((entry) => entry.owner === state.uid);
      if (!owned || !state?.cam) return null;
      const size = state.gridSize ?? state.snapshot?.gridSize ?? 50;
      return {
        id: owned.id,
        x: owned.x,
        y: owned.y,
        screenX: state.cam.x + (owned.x * size + size / 2) * state.cam.scale,
        screenY: state.cam.y + (owned.y * size + size / 2) * state.cam.scale,
        step: size * state.cam.scale,
      };
    });
    expect(token).not.toBeNull();
    const moveBoard = await canvas.boundingBox();
    expect(moveBoard).not.toBeNull();
    const fromX = moveBoard!.x + token!.screenX;
    const fromY = moveBoard!.y + token!.screenY;
    const dragReachesCanvas = await player.evaluate(
      ({ x, y, step }) =>
        [x, x + step].every(
          (pointX) => document.elementFromPoint(pointX, y) instanceof HTMLCanvasElement,
        ),
      { x: fromX, y: fromY, step: token!.step },
    );
    expect(dragReachesCanvas, "token drag endpoints must not be covered by a menu or header").toBe(
      true,
    );
    await player.mouse.move(fromX, fromY);
    await player.mouse.down();
    await player.mouse.move(fromX + token!.step, fromY, { steps: 12 });
    await player.mouse.up();
    for (const client of [player, dm]) {
      await expect
        .poll(() =>
          client.evaluate((id) => {
            const moved = window.__HERO_BYTE_E2E__?.snapshot?.tokens.find((item) => item.id === id);
            return moved ? { x: moved.x, y: moved.y } : null;
          }, token!.id),
        )
        .toEqual({ x: token!.x + 1, y: token!.y });
      await expect.poll(() => readDrawings(client)).toEqual(drawings);
    }
    await testInfo.attach("player-move-after-drawing", {
      body: await player.screenshot(),
      contentType: "image/png",
    });

    for (const client of [player, dm]) {
      await client.getByRole("button", { name: "📜 Chat & Rolls", exact: true }).click();
      await expect(client.getByRole("button", { name: "Close Chat & Rolls" })).toHaveCount(1);
      await expectActivePanel(client, "CHAT");
      await expect(client.getByLabel("Chat message", { exact: true })).toBeVisible();
    }
    const message = "U1 navigation: ready at the table.";
    await player.getByLabel("Chat message", { exact: true }).fill(message);
    await player.getByRole("button", { name: "SEND", exact: true }).click();
    for (const client of [player, dm]) {
      await expect(client.getByTestId("chat-message").filter({ hasText: message })).toHaveCount(1);
    }
    await testInfo.attach("dm-received-player-chat", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });

    expect(
      playerCommands.filter((command) => command.t === "chat" && command.text === message),
    ).toHaveLength(1);
    const positions = await readPositions(player);
    await expect.poll(() => readPositions(dm)).toEqual(positions);
    const playerCommandStart = playerCommands.length;
    const dmCommandStart = dmCommands.length;
    await player.getByRole("tab", { name: "CHAT", exact: true }).click();
    await expectActivePanel(player, "CHAT", true);
    for (const [key, name] of [
      ["ArrowRight", "ROLLS"],
      ["ArrowLeft", "CHAT"],
      ["End", "ROLLS"],
      ["Home", "CHAT"],
      ["ArrowLeft", "ROLLS"],
      ["ArrowRight", "CHAT"],
    ] as const) {
      await player.keyboard.press(key);
      await expectActivePanel(player, name, true);
    }
    // Independent public traffic proves the observer and player are current
    // before asserting that the tab arrows never moved any table token.
    const barrier = "U1 tab keyboard barrier from the DM.";
    await dm.getByLabel("Chat message", { exact: true }).fill(barrier);
    await dm.getByRole("button", { name: "SEND", exact: true }).click();
    for (const client of [player, dm]) {
      await expect(client.getByTestId("chat-message").filter({ hasText: barrier })).toHaveCount(1);
      expect(await readPositions(client)).toEqual(positions);
      expect(await readDrawings(client)).toEqual(drawings);
    }
    expect(
      dmCommands.filter((command) => command.t === "chat" && command.text === barrier),
    ).toHaveLength(1);
    for (const commands of [
      playerCommands.slice(playerCommandStart),
      dmCommands.slice(dmCommandStart),
    ]) {
      expect(
        commands.filter((command) =>
          ["step-object", "move", "transform-object"].includes(command.t),
        ),
      ).toEqual([]);
    }

    await player.getByRole("tab", { name: "ROLLS", exact: true }).click();
    await expectActivePanel(player, "ROLLS", true);
    await expect(player.getByText("No rolls yet...", { exact: true })).toBeVisible();
    await player.getByRole("button", { name: "Close Chat & Rolls" }).click();
    await expect(player.getByLabel("Chat message", { exact: true })).toBeHidden();
    await expect(player.getByRole("tab", { name: "ROLLS", exact: true })).toHaveCount(0);
    await player.getByRole("button", { name: "📜 Chat & Rolls", exact: true }).click();
    await expect(player.getByRole("button", { name: "Close Chat & Rolls" })).toHaveCount(1);
    await expect(player.getByRole("tab", { name: "ROLLS", exact: true })).toHaveCount(1);
    await expectActivePanel(player, "ROLLS");
    await expect(player.getByText("No rolls yet...", { exact: true })).toBeVisible();
    await player.getByRole("tab", { name: "CHAT", exact: true }).click();
    await expect(player.getByTestId("chat-message").filter({ hasText: message })).toHaveCount(1);
  } finally {
    await playerContext.close();
    await dmContext.close();
  }
});
