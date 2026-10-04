import type { ClientMessage, ServerMessage } from "@herobyte/shared";
import { expect, test } from "./fixtures";
import { activate, armGrass, createAndJoin, mapContent, publicBarrier } from "./u2-cancel.helpers";
import {
  aimRegion,
  joinSecondDM,
  observeGeneration,
  selectGenerate,
  showGenerate,
  viewPlayerDungeon,
} from "./u3a-generate.helpers";

for (const mobile of [false, true]) {
  test(`U3a ${mobile ? "phone" : "desktop"} recovery waits for its GET through FIFO outbound delay and live DM broadcasts`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(240_000);
    const contexts = await Promise.all([
      browser.newContext({
        baseURL,
        viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
        hasTouch: mobile,
        isMobile: mobile,
      }),
      browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } }),
      browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } }),
    ]);
    const [dm, other, player] = await Promise.all(contexts.map((context) => context.newPage()));
    if (!dm || !other || !player) throw new Error("Three independent clients required");
    for (const page of [dm, other, player]) page.setDefaultTimeout(15_000);
    const otherWire = observeGeneration(other),
      playerWire = observeGeneration(player);
    const incoming: ServerMessage[] = [],
      outgoing: ClientMessage[] = [];
    const buffer: (string | Buffer)[] = [];
    let holding = false;
    let release: (() => void) | undefined;
    await dm.routeWebSocket(
      (url) => url.protocol === "ws:" && url.port === (process.env.E2E_WS_PORT ?? "8788"),
      (route) => {
        const server = route.connectToServer();
        route.onMessage((raw) => {
          outgoing.push(JSON.parse(raw.toString()) as ClientMessage);
          // Buffer ALL outbound frames once armed, including GET and heartbeat.
          // Inbound remains live. Release preserves order within this socket.
          if (holding) buffer.push(raw);
          else server.send(raw);
        });
        server.onMessage((raw) => {
          incoming.push(JSON.parse(raw.toString()) as ServerMessage);
          route.send(raw);
        });
        release = () => {
          holding = false;
          for (const raw of buffer.splice(0)) server.send(raw);
        };
      },
    );
    const document = () => {
      const frame = [...incoming].reverse().find((m) => "t" in m && m.t === "map-studio-document");
      if (frame?.t !== "map-studio-document") throw new Error("No private document");
      return frame.document;
    };
    const generations = () => outgoing.filter((m) => m.t === "map-studio-generate");
    try {
      await createAndJoin(
        dm,
        player,
        mobile,
        `U3a FIFO ${mobile ? "phone" : "desktop"} ${Date.now()}`,
      );
      await armGrass(dm, mobile, true);
      const layers = await joinSecondDM(other, dm.url());
      const before = document();
      const ui = await selectGenerate(dm, mobile);
      await aimRegion(dm, mobile, before);
      await showGenerate(dm, mobile);
      await expect(ui.fire).toBeEnabled();
      holding = true;
      await activate(ui.fire, mobile);
      await expect(ui.hint).toContainText("Completion unconfirmed", { timeout: 15_000 });
      expect(generations()).toHaveLength(4);
      expect(new Set(generations().map((m) => m.commandId)).size).toBe(1);
      const refresh = ui.panel.getByRole("button", { name: "Refresh map", exact: true });
      const inspect = ui.panel.getByRole("button", { name: "I've checked the map", exact: true });
      await activate(refresh, mobile);
      expect(buffer.map((raw) => (JSON.parse(raw.toString()) as ClientMessage).t)).toContain(
        "map-studio-get",
      );
      // DM2's real edit predates every buffered Generate. Lock then unlock so
      // the eventual original generation can succeed without changing its recipe.
      await layers.getByRole("button", { name: "Lock Walls & Doors", exact: true }).click();
      await expect.poll(() => document().layers.find((l) => l.kind === "walls")?.locked).toBe(true);
      expect(document().elements).toEqual(before.elements);
      expect(otherWire.document().elements).toEqual(before.elements);
      await info.attach("stale-broadcast-recovery.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await expect(inspect).toBeDisabled();
      await expect(ui.fire).toBeDisabled();
      await layers.getByRole("button", { name: "Unlock Walls & Doors", exact: true }).click();
      await expect
        .poll(() => document().layers.find((l) => l.kind === "walls")?.locked)
        .toBe(false);
      // Observe the full recovery deadline; neither another broadcast nor the
      // generic loading watchdog is a receipt. This wait is the fault under test.
      await expect(refresh).toBeEnabled({ timeout: 15_000 });
      await expect(inspect).toBeDisabled();
      await expect(ui.fire).toBeDisabled();
      expect(generations()).toHaveLength(4);
      // Supersede the expired GET with a fresh recovery; both stay behind the
      // original generation. A late expired receipt must not settle the new one.
      await activate(refresh, mobile);
      const unlockedRevision = document().revision;
      if (!release) throw new Error("Fault route was not installed");
      release();
      await expect(inspect).toBeEnabled();
      await expect(ui.fire).toBeDisabled();
      const built = document();
      expect(built.revision).toBe(unlockedRevision + 1);
      expect(built.elements.length).toBeGreaterThan(0);
      expect(
        built.elements.every((element) => element.id.startsWith(generations()[0]!.commandId)),
      ).toBe(true);
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(built.revision);
      for (const control of [refresh, inspect]) {
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
      await activate(inspect, mobile);
      await expect(ui.fire).toBeEnabled();
      await publicBarrier(player, [dm, other, player], "fifo-recovery-no-duplicate");
      expect(generations()).toHaveLength(4);
      expect(playerWire.received.some((m) => "t" in m && m.t === "map-studio-document")).toBe(
        false,
      );
      await info.attach("matching-receipt-inspected.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await viewPlayerDungeon(player, built);
      await info.attach("player-one-dungeon.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
      await info.attach("fifo-correlation.json", {
        body: Buffer.from(
          JSON.stringify({ outgoing, before, built, player: await mapContent(player) }),
        ),
        contentType: "application/json",
      });
    } finally {
      for (const context of contexts) await context.close();
    }
  });
}
