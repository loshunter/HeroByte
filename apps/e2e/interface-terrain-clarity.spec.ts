import { expect, test } from "./fixtures";
import {
  activate,
  armGrass,
  createAndJoin,
  dock,
  mapContent,
  publicBarrier,
} from "./u2-cancel.helpers";
import { observeGeneration } from "./u3a-generate.helpers";
import { closeBuildTools, openBuildTools } from "./u3b-palette.helpers";
import { chooseBuildTool } from "./build-palette.helpers";
import { openTouch, touchDragThenSecondFinger } from "./mobile/touch.helpers";
import { firstElementScreenPos } from "./mobile/mobile.helpers";
import {
  armSize,
  armedSizeFits,
  canvasHit,
  expectFootprint,
  footprint,
  sortedCells,
  square,
  targetCell,
  terrainReach,
  undoStroke,
} from "./u4b-terrain.helpers";

for (const mobile of [false, true]) {
  test(`U4b ${mobile ? "phone" : "desktop"} terrain sizes, fast strokes, Sample and undo reach the player`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      baseURL,
      viewport: mobile ? { width: 375, height: 812 } : { width: 1280, height: 720 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const observer = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const dm = await context.newPage(),
      player = await observer.newPage();
    dm.setDefaultTimeout(12_000);
    const wire = observeGeneration(dm),
      playerWire = observeGeneration(player);
    const commands = () => wire.sent.filter((m) => m.t === "map-studio-command");
    const paints = () =>
      commands()
        .map((m) => m.command)
        .filter((c) => c.type === "paint-terrain");
    try {
      await createAndJoin(dm, player, mobile, `U4b ${mobile ? "phone" : "desktop"}`);
      if (!mobile) await dm.getByRole("button", { name: /Hide entities/i }).click();
      await armGrass(dm, mobile, true);
      const doc = wire.document(),
        target = await targetCell(dm, doc, mobile);
      await canvasHit(dm, target.from, target.to);
      const cdp = mobile ? await openTouch(dm) : null;
      const press = async () => {
        if (cdp)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...target.from, id: 0 }],
          });
        else {
          await dm.mouse.move(target.from.x, target.from.y);
          await dm.mouse.down();
        }
      };
      const release = async () => {
        if (cdp) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await expect.poll(() => footprint(dm)).toEqual([]);
        } else await dm.mouse.up();
      };
      const hoverReentry = async (cells: ReturnType<typeof square>) => {
        if (mobile) return;
        await dm.mouse.move(target.from.x, target.from.y);
        await expectFootprint(dm, doc, cells);
        await dm.getByRole("button", { name: "Done building", exact: true }).hover();
        await expect.poll(() => footprint(dm)).toEqual([]);
        await dm.mouse.move(target.from.x, target.from.y);
        await expectFootprint(dm, doc, cells);
      };
      const synchronized = async () => {
        await expect
          .poll(async () => (await mapContent(player)).terrain)
          .toEqual((await mapContent(dm)).terrain);
        await expect
          .poll(async () => (await mapContent(player)).scene?.sourceRevision)
          .toBe(wire.document().revision);
      };
      // A real placed object takes the other explicit Sample route.
      await openBuildTools(dm, mobile);
      await chooseBuildTool(dm, "place", mobile);
      await closeBuildTools(dm, mobile);
      const objectPoint = { x: target.from.x, y: target.from.y - 100 };
      await canvasHit(dm, objectPoint);
      if (mobile) await dm.touchscreen.tap(objectPoint.x, objectPoint.y);
      else await dm.mouse.click(objectPoint.x, objectPoint.y);
      await expect.poll(() => wire.document().elements.length).toBe(1);
      await expect
        .poll(async () => (await mapContent(player)).elements)
        .toEqual((await mapContent(dm)).elements);
      const objectSample = await firstElementScreenPos(dm);
      expect(objectSample).not.toBeNull();
      await openBuildTools(dm, mobile);
      await chooseBuildTool(dm, "eyedropper", mobile);
      await canvasHit(dm, objectSample!);
      const beforeObjectSample = commands().length;
      if (mobile) await dm.touchscreen.tap(objectSample!.x, objectSample!.y);
      else await dm.mouse.click(objectSample!.x, objectSample!.y);
      if (mobile) await expect(dm.getByTestId("map-edit-armed")).toHaveText("Place object · Crate");
      else await expect(dm.getByTestId("build-tool-place")).toHaveAttribute("aria-pressed", "true");
      await expect(dm.getByTestId("map-edit-armed")).toHaveText("Place object · Crate");
      await expect(dm.getByTestId("map-edit-armed")).toBeInViewport({ ratio: 1 });
      expect(commands()).toHaveLength(beforeObjectSample);
      await info.attach("object-sample.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      for (const size of [1, 3, 5]) {
        await armSize(dm, mobile, size);
        const before = await mapContent(dm),
          count = paints().length;
        const expected = square(target.cellX, target.cellY, size);
        await hoverReentry(expected);
        expect(paints()).toHaveLength(count);
        await press();
        await expectFootprint(dm, doc, expected);
        if (!mobile) {
          // Leaving the canvas while held must retain the pending stroke.
          await dm.getByRole("button", { name: "Done building", exact: true }).hover();
          await expectFootprint(dm, doc, expected);
          await dm.mouse.move(target.from.x, target.from.y);
        }
        if (mobile) {
          await armedSizeFits(dm, size);
          await expect(
            dock(dm).getByRole("button", { name: "Cancel stroke", exact: true }),
          ).toBeEnabled();
        }
        expect(paints()).toHaveLength(count);
        await info.attach(`size-${size}-pending.png`, {
          body: await dm.screenshot(),
          contentType: "image/png",
        });
        await release();
        await expect.poll(() => paints().length).toBe(count + 1);
        expect(sortedCells(paints()[count]!.cells)).toEqual(sortedCells(expected));
        await expect.poll(async () => (await mapContent(dm)).terrain).not.toEqual(before.terrain);
        await synchronized();
        const painted = await mapContent(dm);
        await armSize(dm, mobile, size, true);
        await hoverReentry(square(target.cellX, target.cellY, size, null));
        await press();
        await expectFootprint(dm, doc, square(target.cellX, target.cellY, size, null));
        await release();
        await expect.poll(() => paints().length).toBe(count + 2);
        expect(sortedCells(paints()[count + 1]!.cells)).toEqual(
          sortedCells(square(target.cellX, target.cellY, size, null)),
        );
        await expect.poll(async () => (await mapContent(dm)).terrain).not.toEqual(painted.terrain);
        await synchronized();
        await undoStroke(dm, player, mobile, painted);
        await undoStroke(dm, player, mobile, before);
      }

      // One actual move crosses four cells; interpolation must happen in the app.
      await armSize(dm, mobile, 1);
      const count = paints().length,
        beforeFast = await mapContent(dm);
      await press();
      if (cdp)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...target.to, id: 0 }],
        });
      else await dm.mouse.move(target.to.x, target.to.y);
      await release();
      await expect.poll(() => paints().length).toBe(count + 1);
      expect(sortedCells(paints()[count]!.cells)).toEqual(
        sortedCells([0, 1, 2, 3].flatMap((dx) => square(target.cellX + dx, target.cellY, 1))),
      );
      await synchronized();
      await undoStroke(dm, player, mobile, beforeFast);

      // The five-cell brush cancels without a late compatibility release committing it.
      await armSize(dm, mobile, 5);
      const beforeCancel = await mapContent(dm),
        sentBefore = commands().length;
      if (cdp) {
        const second = { x: target.from.x + 30, y: target.from.y + 60 };
        await canvasHit(dm, second);
        await touchDragThenSecondFinger(cdp, target.from, target.to, second, [target.to, second], {
          steps: 1,
        });
      } else {
        await press();
        await expectFootprint(dm, doc, square(target.cellX, target.cellY, 5));
        await dm.keyboard.press("Escape");
        await release();
      }
      await publicBarrier(player, [dm, player], "U4b canceled terrain");
      expect(commands()).toHaveLength(sentBefore);
      expect(await mapContent(dm)).toEqual(beforeCancel);
      expect((await mapContent(player)).terrain).toEqual(beforeCancel.terrain);
      expect(await footprint(dm)).toEqual([]);

      // Explicit material Sample chooses Paint. Change to Dirt first to prove the selection.
      await armSize(dm, mobile, 3);
      await press();
      await release();
      await expect.poll(() => paints().length).toBe(count + 2);
      await synchronized();
      await openBuildTools(dm, mobile);
      if (mobile) {
        await dm.getByRole("button", { name: "Ground", exact: true }).tap();
        await dm.getByRole("button", { name: "Dirt", exact: true }).tap();
      } else await dm.getByTitle("Dirt", { exact: true }).first().click();
      const sampleCount = commands().length;
      await chooseBuildTool(dm, "eyedropper", mobile);
      await canvasHit(dm, target.from);
      if (mobile) await dm.touchscreen.tap(target.from.x, target.from.y);
      else await dm.mouse.click(target.from.x, target.from.y);
      if (mobile)
        await expect(dm.getByTestId("map-edit-armed")).toHaveText("Paint terrain · Grass · 3 × 3");
      else {
        await expect(dm.getByTestId("build-tool-terrain")).toHaveAttribute("aria-pressed", "true");
        await expect(dm.getByText("Brush: Grass", { exact: true })).toBeVisible();
      }
      expect(commands()).toHaveLength(sampleCount);
      await expect(dm.getByTestId("map-edit-armed")).toHaveText("Paint terrain · Grass · 3 × 3");
      await expect(dm.getByTestId("map-edit-armed")).toBeInViewport({ ratio: 1 });
      await info.attach("sample-result.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      // Ctrl and Meta are actual Chromium key events, not native-Mac evidence.
      if (!mobile)
        for (const key of ["Control", "Meta"]) {
          await chooseBuildTool(dm, "scatter");
          await dm.keyboard.down(key);
          await dm.mouse.click(target.from.x, target.from.y);
          await dm.keyboard.up(key);
          await expect(dm.getByTestId("build-tool-scatter")).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          expect(commands()).toHaveLength(sampleCount);
        }

      await armSize(dm, mobile, 3);
      await openBuildTools(dm, mobile);
      const pin = dm.getByRole("button", {
        name: mobile ? "☆ Pin Grass" : "Pin Grass",
        exact: true,
      });
      await terrainReach(
        dm,
        [1, 3, 5]
          .map((size) => dm.getByRole("button", { name: `${size} × ${size}`, exact: true }))
          .concat(pin),
        info,
        "size-and-pin-reach.json",
      );
      await activate(pin, mobile);
      expect(
        await dm.evaluate(() =>
          JSON.parse(localStorage.getItem("herobyte:brush-deck:pins") ?? "[]"),
        ),
      ).toEqual(["grass"]);
      await closeBuildTools(dm, mobile);
      if (mobile) {
        await terrainReach(
          dm,
          await dock(dm).getByRole("button").all(),
          info,
          "phone-five-slot-reach.json",
        );
        await dm.setViewportSize({ width: 812, height: 375 });
        await expect(dm.getByTestId("map-edit-armed")).toBeInViewport({ ratio: 1 });
        await info.attach("landscape-armed.png", {
          body: await dm.screenshot(),
          contentType: "image/png",
        });
      }
      expect(playerWire.received.filter((m) => "t" in m && m.t === "map-studio-document")).toEqual(
        [],
      );
      await info.attach("player-terrain.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
      await info.attach("terrain-commands.json", {
        body: JSON.stringify(paints()),
        contentType: "application/json",
      });
      await cdp?.detach();
    } finally {
      await context.close();
      await observer.close();
    }
  });
}
