import type { ClientMessage, ServerMessage } from "@herobyte/shared";
import { expect, test } from "./fixtures";
import { activate, armGrass, createAndJoin, mapContent, publicBarrier } from "./u2-cancel.helpers";
import {
  aimRegion,
  observeGeneration,
  selectGenerate,
  showGenerate,
  viewPlayerDungeon,
} from "./u3a-generate.helpers";

for (const mobile of [false, true]) {
  test(`U3a ${mobile ? "phone" : "desktop"} lost Generate replies require refresh and inspection without creating another dungeon`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(240_000);
    const dmContext = await browser.newContext({
      baseURL,
      viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const playerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage(),
      player = await playerContext.newPage();
    for (const page of [dm, player]) page.setDefaultTimeout(15_000);
    const playerWire = observeGeneration(player);
    const incoming: ServerMessage[] = [];
    const generations: Extract<ClientMessage, { t: "map-studio-generate" }>[] = [];
    let suppressed = 0;
    // Network fault only: user input still drives the real client and real server.
    // Suppress only the application result; receipt ACKs still reach the client.
    // Its bounded same-ID retries must recover or report uncertain completion.
    await dm.routeWebSocket(
      (url) => url.protocol === "ws:" && url.port === (process.env.E2E_WS_PORT ?? "8788"),
      (route) => {
        const server = route.connectToServer();
        route.onMessage((raw) => {
          const message = JSON.parse(raw.toString()) as ClientMessage;
          if (message.t === "map-studio-generate") generations.push(message);
          server.send(raw);
        });
        server.onMessage((raw) => {
          const message = JSON.parse(raw.toString()) as ServerMessage;
          incoming.push(message);
          const id = generations[0]?.commandId;
          if (
            id &&
            "t" in message &&
            message.t === "map-studio-document" &&
            message.appliedCommandId === id
          ) {
            suppressed++;
            return;
          }
          route.send(raw);
        });
      },
    );
    const latestDocument = () => {
      const frame = [...incoming].reverse().find((m) => "t" in m && m.t === "map-studio-document");
      if (frame?.t !== "map-studio-document") throw new Error("No server document observed");
      return frame.document;
    };
    try {
      await createAndJoin(
        dm,
        player,
        mobile,
        `U3a lost reply ${mobile ? "phone" : "desktop"} ${Date.now()}`,
      );
      await armGrass(dm, mobile, true);
      const before = latestDocument();
      const ui = await selectGenerate(dm, mobile);
      const seed = await ui.seed.innerText();
      await aimRegion(dm, mobile, before);
      await showGenerate(dm, mobile);
      await expect(ui.fire).toBeEnabled();
      await activate(ui.fire, mobile);
      await expect(ui.hint).toContainText("Generating");
      await expect(ui.hint).toContainText("Completion unconfirmed", { timeout: 15_000 });
      await expect(ui.hint).not.toContainText("Built here already");
      await expect(ui.fire).toBeDisabled();
      await expect(ui.seed).toHaveText(seed);
      expect(generations).toHaveLength(4);
      expect(
        generations.every((request) => JSON.stringify(request) === JSON.stringify(generations[0])),
      ).toBe(true);
      expect(suppressed).toBeGreaterThanOrEqual(4);
      const actual = latestDocument();
      expect(actual.revision).toBe(before.revision + 1);
      expect(actual.elements.length).toBeGreaterThan(0);
      expect(
        actual.elements.every((element) => element.id.startsWith(generations[0]!.commandId)),
      ).toBe(true);
      // Generated walls/doors use the compiled scene, not the decorative-element channel.
      await expect
        .poll(async () => (await mapContent(player)).scene?.walls.length)
        .toBeGreaterThan(4);
      await expect
        .poll(async () => (await mapContent(player)).scene?.doors.length)
        .toBeGreaterThan(0);
      const publicResult = await mapContent(player);
      expect(publicResult.scene?.sourceRevision).toBe(actual.revision);
      expect(publicResult.terrain).toBeTruthy();
      expect(publicResult.terrain).toEqual((await mapContent(dm)).terrain);
      await info.attach("completion-unconfirmed.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      const inspected = ui.panel.getByRole("button", { name: "I've checked the map", exact: true });
      await expect(inspected).toBeDisabled();
      const refresh = ui.panel.getByRole("button", { name: "Refresh map", exact: true });
      for (const control of [refresh, inspected]) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        if (mobile) {
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height).toBeLessThanOrEqual(812);
        }
      }
      await activate(refresh, mobile);
      await expect(inspected).toBeEnabled();
      await expect(ui.fire).toBeDisabled();
      expect(latestDocument().revision).toBe(actual.revision);
      expect(generations).toHaveLength(4);
      await activate(inspected, mobile);
      await expect(ui.hint).toContainText("Completion remains unconfirmed");
      await expect(ui.fire).toBeEnabled();
      await expect(ui.seed).toHaveText(seed);
      await publicBarrier(player, [dm, player], "u3a-inspected-no-new-generation");
      expect(generations).toHaveLength(4);
      expect(playerWire.requests()).toHaveLength(0);
      expect(playerWire.received.some((m) => "t" in m && m.t === "map-studio-document")).toBe(
        false,
      );
      await info.attach("inspected-no-automatic-retry.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await viewPlayerDungeon(player, actual);
      await info.attach("player-sees-one-dungeon.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
      await info.attach("uncertain-completion-evidence.json", {
        body: Buffer.from(
          JSON.stringify({
            generations,
            suppressed,
            beforeRevision: before.revision,
            actualRevision: actual.revision,
            elements: actual.elements.length,
            freshGenerationsAfterInspection: 0,
          }),
        ),
        contentType: "application/json",
      });
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
}
