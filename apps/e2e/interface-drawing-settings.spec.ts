import { expect, test } from "./fixtures";
import { activate, createAndJoin, observeWire } from "./u2-cancel.helpers";
import { actions, armTool, closeChat, tools } from "./u2-window-annotation.helpers";
import { drawingReach, gesture, ink, setRange } from "./u4a-drawing.helpers";

test("U4a drawing oracle rejects a page without observable drawing state", async ({ page }) => {
  await page.goto("about:blank");
  await expect(ink(page)).rejects.toThrow("Drawing snapshot unavailable or malformed");
});

test("U4a landscape touch can draw across two grid cells with controls hidden", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 1440, height: 900 },
  });
  const dm = await dmContext.newPage(),
    player = await context.newPage();
  const wire = observeWire(player);
  try {
    await createAndJoin(dm, player, false, "U4a landscape drawing");
    await closeChat(player, false);
    await armTool(player, "Draw", false);
    await player.getByRole("button", { name: /Rectangle/ }).click();
    await player.getByLabel("Drawing color", { exact: true }).fill("#66cc66");
    await setRange(player.getByRole("slider", { name: "Stroke width (px)", exact: true }), 17);
    await setRange(player.getByRole("slider", { name: "Opacity (%)", exact: true }), 40);
    await player.getByRole("checkbox", { name: "Filled", exact: true }).check();
    await player.setViewportSize({ width: 812, height: 375 });
    await expect(player.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
    const hide = player.getByRole("button", { name: "Hide drawing controls" });
    // Let the pre-repair UI reach the canvas assertion, exposing the obstruction
    // rather than failing only because the new disclosure button is absent.
    if (await hide.count()) await hide.tap();
    for (const surface of ["Tools", "Help"]) {
      await actions(player).getByRole("button", { name: "Tools", exact: true }).tap();
      await expect(player.getByRole("toolbar", { name: "Drawing tools" })).toHaveCount(0);
      if (surface === "Help") {
        await tools(player).getByRole("button", { name: "Help", exact: true }).tap();
        await player.getByRole("button", { name: "Close help", exact: true }).tap();
      } else {
        await player.getByRole("button", { name: "Close tools", exact: true }).tap();
      }
      await expect(player.getByRole("button", { name: "Show drawing controls" })).toBeVisible();
      await expect(player.getByRole("slider")).toHaveCount(0);
    }
    await info.attach("landscape-before-stroke.png", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
    // Fixed 100px vertical travel covers two cells of the visible default 50px grid.
    await gesture(player, { x: 450, y: 55 }, { x: 550, y: 155 }, true);
    await expect.poll(async () => (await ink(dm)).length).toBe(1);
    const mark = (await ink(dm))[0]!;
    expect(mark).toMatchObject({
      type: "rect",
      color: "#66cc66",
      width: 17,
      opacity: 0.4,
      filled: true,
    });
    await expect.poll(() => ink(player)).toEqual([mark]);
    expect(wire.sent.filter((m) => m.t === "draw")).toHaveLength(1);
    await expect(player.getByRole("button", { name: "Show drawing controls" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(player.getByRole("slider")).toHaveCount(0);
    await drawingReach(player, info, "landscape-collapsed", true);
    await player.getByRole("button", { name: "Undo drawing" }).tap();
    await expect.poll(() => ink(dm)).toEqual([]);
    await expect.poll(() => ink(player)).toEqual([]);
    await player.getByRole("button", { name: "Redo drawing" }).tap();
    await expect.poll(() => ink(dm)).toEqual([mark]);
    await expect.poll(() => ink(player)).toEqual([mark]);
    await info.attach("landscape-author.png", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
    await info.attach("landscape-observer.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
    await player.getByRole("button", { name: "Show drawing controls" }).tap();
    await expect(player.getByRole("slider", { name: "Opacity (%)" })).toHaveValue("40");
    await expect(player.getByRole("slider", { name: "Stroke width (px)" })).toHaveValue("17");
    await expect(player.getByRole("checkbox")).toBeChecked();
    await player.getByRole("button", { name: "Hide drawing controls" }).tap();
    await player.getByRole("button", { name: "Done drawing" }).tap();
    await expect(player.getByRole("toolbar", { name: "Drawing tools" })).toHaveCount(0);
    await expect.poll(() => ink(player)).toEqual([mark]);
    await armTool(player, "Draw", true);
    await expect(player.getByRole("button", { name: "Hide drawing controls" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(player.getByRole("slider", { name: "Opacity (%)" })).toHaveValue("40");
    await player.getByRole("button", { name: "Done drawing" }).tap();
    expect(wire.sent.filter((m) => m.t === "map-studio-command")).toEqual([]);
    expect(wire.received.filter((m) => m.t === "map-studio-document")).toEqual([]);
  } finally {
    await Promise.allSettled([dmContext.close(), context.close()]);
  }
});

for (const touch of [false, true]) {
  test(`U4a ${touch ? "responsive phone" : "desktop"}: settings, erase and own history reach the observer`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(150_000);
    const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const playerContext = await browser.newContext({
      baseURL,
      hasTouch: touch,
      isMobile: touch,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage(),
      player = await playerContext.newPage();
    const wire = observeWire(player);
    try {
      await createAndJoin(dm, player, false, `U4a ${touch ? "phone" : "desktop"}`);
      await closeChat(player, false);
      await armTool(player, "Draw", false);
      await player.getByRole("button", { name: /Rectangle/ }).click();
      await player.getByLabel("Drawing color", { exact: true }).fill("#66cc66");
      await setRange(player.getByRole("slider", { name: "Stroke width (px)", exact: true }), 17);
      await setRange(player.getByRole("slider", { name: "Opacity (%)", exact: true }), 40);
      await player.getByRole("checkbox", { name: "Filled", exact: true }).check();
      let opacity = 0.4;
      if (touch) {
        expect(new URL(player.url()).searchParams.has("mobile")).toBe(false);
        await player.setViewportSize({ width: 375, height: 812 });
        await expect(player.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
        await expect(
          player.getByRole("button", { name: "Rectangle", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
          player.getByRole("slider", { name: "Stroke width (px)", exact: true }),
        ).toHaveValue("17");
        const slider = player.getByRole("slider", { name: "Opacity (%)", exact: true });
        await expect(slider).toHaveValue("40");
        await expect(player.getByRole("checkbox")).toBeChecked();
        await drawingReach(player, info, "phone-rectangle-settings");
        const box = (await slider.boundingBox())!;
        await slider.tap({ position: { x: box.width * 0.7, y: box.height / 2 } });
        opacity = Number(await slider.inputValue()) / 100;
        expect(opacity).toBeGreaterThan(0.55);
        expect(opacity).toBeLessThan(0.85);
        await player.getByText("Filled", { exact: true }).tap();
        await expect(player.getByRole("checkbox")).not.toBeChecked();
        await player.getByText("Filled", { exact: true }).tap();
        await expect(player.getByRole("checkbox")).toBeChecked();
      }
      await expect(player.getByRole("button", { name: /Clear all drawings/i })).toHaveCount(0);
      const canvas = (await player
        .getByTestId("map-board")
        .locator("canvas")
        .first()
        .boundingBox())!;
      const from = { x: canvas.x + canvas.width * 0.5, y: canvas.y + (touch ? 70 : 130) };
      const to = { x: from.x + (touch ? 70 : 120), y: from.y + 55 };
      await gesture(player, from, to, touch);
      await expect.poll(async () => (await ink(dm)).length).toBe(1);
      const mark = (await ink(dm))[0]!;
      expect(mark).toMatchObject({
        type: "rect",
        color: "#66cc66",
        width: 17,
        opacity,
        filled: true,
      });
      await expect.poll(() => ink(player)).toEqual([mark]);
      expect(wire.sent.filter((m) => m.t === "draw")).toHaveLength(1);
      await info.attach("author-green-shape.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
      await info.attach("observer-green-shape.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await activate(player.getByRole("button", { name: /Undo drawing/ }), touch);
      await expect.poll(() => ink(dm)).toEqual([]);
      await expect.poll(() => ink(player)).toEqual([]);
      await activate(player.getByRole("button", { name: /Redo drawing/ }), touch);
      await expect.poll(() => ink(dm)).toEqual([mark]);
      await expect.poll(() => ink(player)).toEqual([mark]);
      await activate(player.getByRole("button", { name: /Erase drawings/ }), touch);
      await expect(player.getByLabel("Drawing color", { exact: true })).toHaveCount(0);
      await expect(player.getByRole("slider", { name: /Opacity/ })).toHaveCount(0);
      await expect(player.getByRole("checkbox")).toHaveCount(0);
      await expect(
        player.getByRole("slider", { name: "Eraser width (px)", exact: true }),
      ).toHaveValue("17");
      await gesture(player, { x: from.x - 20, y: from.y }, { x: from.x + 20, y: from.y }, touch);
      await expect.poll(() => ink(dm)).toEqual([]);
      await expect.poll(() => ink(player)).toEqual([]);
      // Whole-shape erasure uses delete-drawing, which has no history entry.
      // Creation undo/redo above and partial-erase.smoke cover the supported paths.
      await expect(player.getByRole("button", { name: /Undo drawing/ })).toBeDisabled();
      await activate(player.getByRole("button", { name: /Rectangle/ }), touch);
      if (touch) await player.setViewportSize({ width: 1440, height: 900 });
      await expect(player.getByRole("slider", { name: "Opacity (%)", exact: true })).toHaveValue(
        String(opacity * 100),
      );
      await expect(player.getByRole("checkbox")).toBeChecked();
      await expect(
        player.getByRole("slider", { name: "Stroke width (px)", exact: true }),
      ).toHaveValue("17");
      await player.getByRole("button", { name: "Done drawing", exact: true }).click();
      await expect(player.getByRole("slider", { name: /Stroke width/ })).toHaveCount(0);
      await expect.poll(() => ink(player)).toEqual([]);
      expect(wire.sent.filter((m) => m.t === "map-studio-command")).toEqual([]);
      expect(wire.received.filter((m) => m.t === "map-studio-document")).toEqual([]);
    } finally {
      await Promise.allSettled([dmContext.close(), playerContext.close()]);
    }
  });
}

test("U4a touch settings fit portrait, short landscape, tablet and a 200%-equivalent viewport", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 1440, height: 900 },
  });
  const dm = await dmContext.newPage(),
    player = await context.newPage();
  try {
    await createAndJoin(dm, player, false, "U4a drawing reach");
    await closeChat(player, false);
    await armTool(player, "Draw", false);
    await player.getByRole("button", { name: /Rectangle/ }).click();
    await setRange(player.getByRole("slider", { name: "Stroke width (px)", exact: true }), 50);
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 812, height: 375 },
      { width: 1024, height: 768 },
      { width: 720, height: 450 },
    ]) {
      await player.setViewportSize(viewport);
      await expect(player.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
      await drawingReach(player, info, `${viewport.width}x${viewport.height}`);
    }
  } finally {
    await dmContext.close();
    await context.close();
  }
});
