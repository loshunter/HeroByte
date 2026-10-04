import { expect, test } from "./fixtures";
import { identity } from "./chat-journey.helpers";
import {
  activate,
  createAndJoin,
  mouseStroke,
  observeWire,
  uncoveredRow,
} from "./u2-cancel.helpers";
import {
  actions,
  armTool,
  closeChat,
  commitStroke,
  drawingCommands,
  drawings,
  expectDrawings,
  finishPanel,
  nameCommands,
  openPanel,
  proveToolRetained,
  savedNames,
  settledBarrier,
  type Panel,
  type Tool,
} from "./u2-window-annotation.helpers";

for (const touch of [false, true]) {
  test(`U2 ${touch ? "phone" : "desktop"}: four windows return focus and preserve the covered tool`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(240_000);
    const dmContext = await browser.newContext({
      baseURL,
      hasTouch: touch,
      isMobile: touch,
      viewport: touch ? { width: 375, height: 812 } : { width: 1440, height: 900 },
    });
    // createAndJoin's observer path is explicitly desktop and leaves Chat open.
    // hasTouch is set at context creation; resizing later changes only layout.
    const playerContext = await browser.newContext({
      baseURL,
      hasTouch: touch,
      isMobile: touch,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    const dmWire = observeWire(dm);
    const playerWire = observeWire(player);
    try {
      await createAndJoin(dm, player, touch, `U2 windows ${touch ? "phone" : "desktop"}`);
      await closeChat(player, false);
      if (touch) {
        await player.setViewportSize({ width: 375, height: 812 });
        for (const page of [dm, player]) {
          await expect(actions(page)).toBeVisible();
          expect(page.viewportSize()).toEqual({ width: 375, height: 812 });
        }
      }
      const windows: [Panel, Tool][] = [
        ["Character", "Measure"],
        ["Chat", "Draw"],
        ["World", "Measure"],
        ["DM", "Draw"],
      ];
      for (const [panel, tool] of windows) {
        const page = panel === "DM" ? dm : player;
        const peer = page === dm ? player : dm;
        const ledger = page === dm ? dmWire : playerWire;
        await armTool(page, tool, touch);
        let originalName = "";
        for (const dismissal of ["Escape", "X"] as const) {
          const { launcher, close } = await openPanel(page, panel, touch);
          const beforeNames = await savedNames(page);
          const beforeNameCommands = nameCommands(ledger).length;
          if (panel === "Character") {
            const field = page.getByPlaceholder("Enter Name", { exact: true });
            if (dismissal === "Escape") {
              originalName = await field.inputValue();
              await field.fill(`UNSAVED U2 ${touch ? "phone" : "desktop"}`);
              await expect(field).toBeFocused();
            } else {
              // X retains ordinary blur/save semantics. Do not carry the intentionally
              // dirty Escape buffer into that separate focus-return assertion.
              await field.fill(originalName);
            }
          }
          if (dismissal === "Escape") await page.keyboard.press("Escape");
          else await activate(close, touch);
          await expect(close).toHaveCount(0);
          // On phone World this resolves the NEW tile in restored Tools; the
          // original tile was asserted detached in openPanel.
          await expect(launcher).toBeFocused();
          await info.attach(`${panel}-${dismissal}-${touch ? "phone" : "desktop"}.png`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          if (panel === "Character" && dismissal === "Escape") {
            await settledBarrier(page, peer, touch, `dirty-name-${touch}`);
            expect(nameCommands(ledger)).toHaveLength(beforeNameCommands);
            expect(await savedNames(page)).toEqual(beforeNames);
            expect(await savedNames(peer)).toEqual(beforeNames);
            await expect(launcher).toBeFocused();
          }
          await finishPanel(page, panel, touch);
          // Actual network output and the peer's state prove armed behavior;
          // a highlighted button or preserved toolbar alone is insufficient.
          await proveToolRetained(page, peer, ledger, tool, touch);
        }
      }
      expect((await identity(dm)).isDM).toBe(true);
      expect((await identity(player)).isDM).toBe(false);
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
}

test("U2 player annotations: own history, cancelled held stroke, then successful next stroke", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const playerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
  });
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();
  const dmWire = observeWire(dm);
  const playerWire = observeWire(player);
  try {
    await createAndJoin(dm, player, false, "U2 annotation history");
    await closeChat(player, false);
    await expectDrawings([dm, player], []);
    await armTool(player, "Draw", false);
    const playerMark = await commitStroke(player, dm, playerWire, false, 0.35);
    await armTool(dm, "Draw", false);
    const dmMark = await commitStroke(dm, player, dmWire, false, 0.55);
    const bothMarks = [playerMark, dmMark];

    for (const [page, ledger, surviving] of [
      [player, playerWire, dmMark],
      [dm, dmWire, playerMark],
    ] as const) {
      const undo = page.getByRole("button", { name: "↶ Undo drawing", exact: true });
      const redo = page.getByRole("button", { name: "↷ Redo drawing", exact: true });
      const sent = drawingCommands(ledger).length;
      await expect(undo).toBeEnabled();
      await undo.click();
      await expectDrawings([dm, player], [surviving]);
      await expect.poll(() => drawingCommands(ledger).length).toBe(sent + 1);
      expect(drawingCommands(ledger).at(-1)!.t).toBe("undo-drawing");
      await expect(redo).toBeEnabled();
      await redo.click();
      await expectDrawings([dm, player], bothMarks);
      await expect.poll(() => drawingCommands(ledger).length).toBe(sent + 2);
      expect(drawingCommands(ledger).at(-1)!.t).toBe("redo-drawing");
    }

    const sent = drawingCommands(playerWire).length;
    const heldRow = await uncoveredRow(player, 0.65);
    await mouseStroke(player, heldRow, false);
    const cancel = player.getByRole("button", { name: "Cancel stroke", exact: true });
    await expect(cancel).toBeEnabled();
    await info.attach("player-held-annotation-before-Escape.png", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
    await player.keyboard.press("Escape");
    await expect(cancel).toBeDisabled();
    await expect(player.getByRole("button", { name: /Close.*DRAWING TOOLS/i })).toBeVisible();
    await player.mouse.move(heldRow[1].x + 20, heldRow[1].y, { steps: 5 });
    await player.mouse.up();
    await settledBarrier(player, dm, false, "annotation-Escape-residual-release");
    expect(drawingCommands(playerWire)).toHaveLength(sent);
    await expectDrawings([dm, player], bothMarks);

    const next = await commitStroke(player, dm, playerWire, false, 0.45);
    await player.getByRole("button", { name: "↶ Undo drawing", exact: true }).click();
    await expectDrawings([dm, player], bothMarks);
    await player.getByRole("button", { name: "↷ Redo drawing", exact: true }).click();
    await expectDrawings([dm, player], [...bothMarks, next]);
    expect(await drawings(dm)).toHaveLength(3);
    for (const [label, page] of [
      ["player", player],
      ["dm", dm],
    ] as const) {
      await info.attach(`${label}-annotation-history-after-cancel.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
