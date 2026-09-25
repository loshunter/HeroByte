import { expect, test } from "./fixtures";
import { chooseBuildTool } from "./build-palette.helpers";
import { armGrass, createAndJoin, mapContent, mouseStroke } from "./u2-cancel.helpers";
import { aimRegion, observeGeneration } from "./u3a-generate.helpers";
import { closeBuildTools, openBuildTools } from "./u3b-palette.helpers";
import { openTouch, touchTap } from "./mobile/touch.helpers";

test("U3b phone Lighting group closes directly, places one light and preserves player redaction", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(90_000);
  const dmContext = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const playerContext = await browser.newContext({ baseURL });
  const dm = await dmContext.newPage(),
    player = await playerContext.newPage();
  const wire = observeGeneration(dm);
  const playerWire = observeGeneration(player);
  try {
    await createAndJoin(dm, player, true, "U3b direct group");
    await armGrass(dm, true, true);
    await openBuildTools(dm, true);
    const sheet = dm.getByRole("dialog", { name: "Map tools", exact: true });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("combobox", { name: "Tool group" }).selectOption("lighting");
    // No tool-tile click: changing the group already arms its remembered tool.
    await expect(sheet).toBeHidden();
    expect((await mapContent(player)).scene?.lights ?? []).toHaveLength(0);
    const canvas = dm.getByTestId("map-board").locator("canvas").first();
    const box = (await canvas.boundingBox())!;
    const point = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.4 };
    // Konva stacks canvases. Hit-test the stage, then use real viewport input;
    // targeting its bottom canvas makes Playwright wait for the top one to move.
    expect(
      await dm.evaluate(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return (
          hit instanceof HTMLCanvasElement && Boolean(hit.closest('[data-testid="map-board"]'))
        );
      }, point),
    ).toBe(true);
    const touch = await openTouch(dm);
    await touchTap(touch, point);
    await touch.detach();
    await expect
      .poll(() => wire.document().elements.filter((element) => element.type === "light").length)
      .toBe(1);
    await expect
      .poll(async () => (await mapContent(player)).scene?.sourceRevision)
      .toBe(wire.document().revision);
    // Light geometry is intentionally DM-only (compiledSceneFor). The player
    // must receive the new public revision without that private geometry.
    expect((await mapContent(player)).scene?.lights).toEqual([]);
    expect(
      playerWire.received.filter((frame) => "t" in frame && frame.t === "map-studio-document"),
    ).toEqual([]);
    await info.attach("direct-lighting-group.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await info.attach("lighting-commands.json", {
      body: JSON.stringify(wire.sent.filter((message) => message.t === "map-studio-command")),
      contentType: "application/json",
    });
    await dmContext.close();
    await playerContext.close();
  }
});

test("U3b Undo removes the decoration target even over surviving painted floor", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } });
  const playerContext = await browser.newContext({ baseURL });
  const dm = await dmContext.newPage(),
    player = await playerContext.newPage();
  const wire = observeGeneration(dm);
  try {
    await createAndJoin(dm, player, false, "U3b decoration Undo");
    await dm.getByRole("button", { name: /Hide entities/i }).click();
    await armGrass(dm, false, true);
    const aim = await aimRegion(dm, false, wire.document(), 12, false);
    // Leave an actual painted stroke underneath the room that will be undone.
    await mouseStroke(dm, [aim.points[0], aim.points[1]]);
    await expect.poll(() => wire.document().terrain).toBeTruthy();
    const before = wire.document();
    await expect
      .poll(async () => (await mapContent(player)).scene?.sourceRevision)
      .toBe(before.revision);
    const publicBefore = await mapContent(player);
    await chooseBuildTool(dm, "room");
    await aimRegion(dm, false, before);
    const decorate = dm.getByRole("button", { name: /Decorate last/ });
    await expect(decorate).toBeEnabled();
    await expect
      .poll(() => wire.document().elements.length)
      .toBeGreaterThan(before.elements.length);
    await dm.getByTitle("Undo map edit", { exact: true }).click();
    await expect.poll(() => wire.document().elements).toEqual(before.elements);
    await expect.poll(() => wire.document().terrain).toEqual(before.terrain);
    await expect.poll(async () => (await mapContent(player)).terrain).toEqual(publicBefore.terrain);
    await expect(decorate).toBeDisabled();
    await expect(dm.getByText(/draw a new room or hallway/i)).toBeVisible();
    await info.attach("undone-over-painted-floor.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});

for (const mobile of [false, true]) {
  test(`U3b ${mobile ? "phone" : "desktop"} hiding a perimeter invalidates decoration and removes player geometry`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(120_000);
    const dmContext = await browser.newContext({
      baseURL,
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const playerContext = await browser.newContext({ baseURL });
    const dm = await dmContext.newPage(),
      player = await playerContext.newPage();
    const wire = observeGeneration(dm);
    try {
      await createAndJoin(dm, player, mobile, "U3b hidden perimeter");
      if (!mobile) await dm.getByRole("button", { name: /Hide entities/i }).click();
      await armGrass(dm, mobile, true);
      await openBuildTools(dm, mobile);
      await chooseBuildTool(dm, "room", mobile);
      await aimRegion(dm, mobile, wire.document());
      await openBuildTools(dm, mobile);
      const decorate = dm.getByRole("button", { name: /Decorate last/ });
      await expect(decorate).toBeEnabled();
      const wall = wire.document().elements.find((element) => element.type === "wall");
      if (!wall || wall.type !== "wall") throw new Error("Expected an authored perimeter");
      expect(wall.transform).toMatchObject({ rotation: 0, scaleX: 1, scaleY: 1 });
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(wire.document().revision);
      expect(
        (await mapContent(player)).scene!.walls.filter((part) => part.id.startsWith(`${wall.id}#`))
          .length,
      ).toBeGreaterThan(0);
      await chooseBuildTool(dm, "select", mobile);
      await closeBuildTools(dm, mobile);
      const point = await dm.evaluate((perimeter) => {
        const cam = window.__HERO_BYTE_E2E__?.cam;
        const canvas = document.querySelector('[data-testid="map-board"] canvas');
        if (!cam || !canvas) throw new Error("Map unavailable");
        const box = canvas.getBoundingClientRect();
        for (let i = 1; i < perimeter.data.points.length; i++) {
          const start = perimeter.data.points[i - 1]!,
            end = perimeter.data.points[i]!;
          const x = box.x + cam.x + (perimeter.transform.x + (start.x + end.x) / 2) * cam.scale;
          const y = box.y + cam.y + (perimeter.transform.y + (start.y + end.y) / 2) * cam.scale;
          const hit = document.elementFromPoint(x, y);
          if (hit instanceof HTMLCanvasElement && hit.closest('[data-testid="map-board"]'))
            return { x, y };
        }
        throw new Error("No perimeter segment on uncovered canvas");
      }, wall);
      if (mobile) await dm.touchscreen.tap(point.x, point.y);
      else await dm.mouse.click(point.x, point.y);
      await openBuildTools(dm, mobile);
      if (mobile) {
        await dm.getByTestId("mobile-inspector-toggle").tap();
        const inspector = dm.getByTestId("mobile-inspector");
        await inspector.getByRole("button", { name: /Visible to players/i }).tap();
        await inspector.getByTestId("mobile-inspector-apply").tap();
        await dm.getByTestId("mobile-inspector-toggle").tap();
      } else {
        await dm.getByRole("button", { name: "🔍 Inspect", exact: true }).click();
        const inspector = dm.getByRole("group", { name: "Edit wall", exact: true });
        await inspector.getByRole("checkbox", { name: "Hide element" }).check();
        await inspector.getByRole("button", { name: "APPLY", exact: true }).click();
        await dm.getByRole("button", { name: "🔍 Inspect", exact: true }).click();
      }
      await expect
        .poll(() => wire.document().elements.find((element) => element.id === wall.id)?.hidden)
        .toBe(true);
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(wire.document().revision);
      await expect
        .poll(async () =>
          (await mapContent(player)).scene?.walls.filter((part) =>
            part.id.startsWith(`${wall.id}#`),
          ),
        )
        .toEqual([]);
      await chooseBuildTool(dm, "room", mobile);
      await expect(decorate).toBeDisabled();
      await expect(dm.getByText(/That area changed/)).toBeVisible();
      await info.attach("hidden-perimeter-target.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
}
