import { expect, test } from "./fixtures";
import { hideParty } from "./party.helpers";
import { chooseBuildTool } from "./build-palette.helpers";
import {
  activate,
  armGrass,
  createAndJoin,
  dock,
  mapContent,
  mouseStroke,
} from "./u2-cancel.helpers";
import {
  aimRegion,
  observeGeneration,
  selectGenerate,
  showGenerate,
  viewPlayerDungeon,
} from "./u3a-generate.helpers";
import {
  closeBuildTools,
  inspectStamp,
  openBuildTools,
  pinnedControls,
} from "./u3b-palette.helpers";
import { openTouch, touchDrag } from "./mobile/touch.helpers";

for (const mobile of [false, true]) {
  test(`U3b ${mobile ? "phone" : "short desktop"} builds, decorates, paints, generates, inspects and undoes with a player`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(240_000);
    const dmContext = await browser.newContext({
      baseURL,
      viewport: mobile ? { width: 375, height: 812 } : { width: 1280, height: 640 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const playerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage(),
      player = await playerContext.newPage();
    dm.setDefaultTimeout(15_000);
    player.setDefaultTimeout(15_000);
    const wire = observeGeneration(dm),
      playerWire = observeGeneration(player);
    const checkpoints: unknown[] = [];
    try {
      await createAndJoin(dm, player, mobile, `U3b ${mobile ? "phone" : "desktop"}`);
      if (!mobile) await hideParty(dm);
      await armGrass(dm, mobile, true);
      await openBuildTools(dm, mobile);
      await chooseBuildTool(dm, "room", mobile);
      const beforeRoom = wire.document();
      const aim = await aimRegion(dm, mobile, beforeRoom);
      await expect.poll(() => wire.document().revision).toBeGreaterThan(beforeRoom.revision);
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(wire.document().revision);
      await info.attach("named-room-target.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await openBuildTools(dm, mobile);
      const baseline = await pinnedControls(dm, mobile);
      checkpoints.push({ tool: "room", controls: baseline });
      const decorate = dm.getByRole("button", { name: /Decorate last/ });
      await expect(decorate).toContainText("Decorate last room");
      await expect(decorate).toBeEnabled();
      const beforeDecorate = wire.document().elements.length;
      await activate(decorate, mobile);
      await expect.poll(() => wire.document().elements.length).toBeGreaterThan(beforeDecorate);
      await expect(decorate).toBeDisabled();
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(wire.document().revision);

      await chooseBuildTool(dm, "terrain", mobile);
      expect(await dm.getByRole("button", { name: /Decorate last/ }).count()).toBe(0);
      if (mobile) {
        await dm.getByRole("button", { name: "Ground", exact: true }).tap();
        await dm.getByRole("button", { name: "Dirt", exact: true }).tap();
      } else await dm.getByTitle("Dirt", { exact: true }).first().click();
      const paintControls = await pinnedControls(dm, mobile);
      checkpoints.push({ tool: "terrain", controls: paintControls });
      expect(paintControls.map(({ x, y }) => ({ x, y }))).toEqual(
        baseline.map(({ x, y }) => ({ x, y })),
      );
      await closeBuildTools(dm, mobile);
      const previousTerrain = (await mapContent(player)).terrain;
      const points = [
        { x: aim.points[0].x + 20, y: aim.points[0].y + 20 },
        { x: aim.points[0].x + 65, y: aim.points[0].y + 20 },
      ] as const;
      if (mobile) {
        const touch = await openTouch(dm);
        await touchDrag(touch, points[0], [points[1]]);
        await touch.detach();
      } else await mouseStroke(dm, [points[0], points[1]]);
      await expect
        .poll(async () => (await mapContent(player)).terrain)
        .not.toEqual(previousTerrain);

      const ui = await selectGenerate(dm, mobile);
      await aimRegion(dm, mobile, wire.document());
      await showGenerate(dm, mobile);
      checkpoints.push({ tool: "generate", controls: await pinnedControls(dm, mobile) });
      const beforeGenerate = wire.document();
      const publicBeforeGenerate = await mapContent(player);
      await activate(ui.fire, mobile);
      await expect(ui.hint).toContainText("Built here already");
      expect(wire.requests()).toHaveLength(1);
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(wire.document().revision);
      await info.attach("generated-palette.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      const layers = mobile
        ? dm.getByTestId("mobile-layers-toggle")
        : dm.getByRole("button", { name: "🗂 Layers", exact: true });
      await activate(layers, mobile);
      const layerPanel = mobile
        ? dm.getByTestId("mobile-layers")
        : dm.getByRole("region", { name: "Layers", exact: true });
      await expect(layerPanel.getByRole("button").first()).toBeInViewport({ ratio: 1 });
      await activate(layers, mobile);

      await chooseBuildTool(dm, "spline", mobile);
      checkpoints.push({ tool: "spline", controls: await pinnedControls(dm, mobile) });
      await chooseBuildTool(dm, "select", mobile);
      await inspectStamp(dm, mobile, wire.document());
      await info.attach("inspected-element.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      const undo = mobile
        ? dock(dm).getByRole("button", { name: "Undo map edit", exact: true })
        : dm.getByTitle("Undo map edit", { exact: true });
      await activate(undo, mobile);
      await expect.poll(() => wire.document().elements).toEqual(beforeGenerate.elements);
      await expect
        .poll(async () => (await mapContent(player)).terrain)
        .toEqual(publicBeforeGenerate.terrain);
      await expect
        .poll(async () => (await mapContent(player)).scene?.walls)
        .toEqual(publicBeforeGenerate.scene?.walls);
      expect(
        playerWire.received.filter((frame) => "t" in frame && frame.t === "map-studio-document"),
      ).toEqual([]);
      const renderStarted = Date.now();
      const statusBeforeView = await player.getByRole("status").allTextContents();
      await viewPlayerDungeon(player, wire.document());
      await info.attach("player-render-settled.json", {
        body: JSON.stringify({
          elapsedMs: Date.now() - renderStarted,
          statusBeforeView,
          statusAfterView: await player.getByRole("status").allTextContents(),
        }),
        contentType: "application/json",
      });
      await info.attach("player-after-undo.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
      await info.attach("persistent-controls.json", {
        body: JSON.stringify(checkpoints, null, 2),
        contentType: "application/json",
      });
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
}
