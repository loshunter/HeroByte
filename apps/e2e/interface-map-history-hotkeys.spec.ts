import { expect, test } from "./fixtures";
import { openChat } from "./chat-journey.helpers";
import {
  armGrass,
  createAndJoin,
  mapCommands,
  mapContent,
  mouseStroke,
  observeWire,
  uncoveredRow,
} from "./u2-cancel.helpers";

for (const chatOpen of [false, true]) {
  test(`a completed hallway supports keyboard undo and redo with chat ${chatOpen ? "open" : "closed"}`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(120_000);
    const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const playerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    const wire = observeWire(dm);
    try {
      await createAndJoin(dm, player, false, "Hallway keyboard history");
      await armGrass(dm, false, true);
      const row = await uncoveredRow(dm, 0.55);
      row[1].x = (row[0].x + row[1].x) / 2;
      if (chatOpen) await openChat(dm);
      await dm.getByRole("button", { name: "🚇 Hall", exact: true }).click();
      const before = (await mapContent(dm)).terrain;
      await expect.poll(async () => (await mapContent(player)).terrain).toEqual(before);
      const sent = mapCommands(wire).length;
      expect(
        await dm.evaluate(
          (points) =>
            points.every(
              ({ x, y }) => document.elementFromPoint(x, y) instanceof HTMLCanvasElement,
            ),
          row,
        ),
      ).toBe(true);
      await mouseStroke(dm, row, true);
      await expect.poll(() => mapCommands(wire).length).toBe(sent + 1);
      await expect(dm.getByTitle("Undo map edit", { exact: true })).toBeEnabled();
      await expect.poll(async () => (await mapContent(dm)).terrain).not.toEqual(before);
      const hallway = (await mapContent(dm)).terrain;
      await expect.poll(async () => (await mapContent(player)).terrain).toEqual(hallway);

      await dm.keyboard.press("Control+z");
      await expect.poll(() => mapCommands(wire).length).toBe(sent + 2);
      expect(mapCommands(wire)[sent + 1]?.command?.type).toBe("undo");
      for (const page of [dm, player])
        await expect.poll(async () => (await mapContent(page)).terrain).toEqual(before);
      await expect(dm.getByTitle("Redo map edit", { exact: true })).toBeEnabled();
      await dm.keyboard.press("Control+Shift+z");
      await expect.poll(() => mapCommands(wire).length).toBe(sent + 3);
      expect(mapCommands(wire)[sent + 2]?.command?.type).toBe("redo");
      for (const page of [dm, player])
        await expect.poll(async () => (await mapContent(page)).terrain).toEqual(hallway);
      await info.attach("hallway-redone.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
}
