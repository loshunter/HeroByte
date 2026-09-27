import { expect, test } from "./fixtures";
import { chooseBuildTool } from "./build-palette.helpers";
import { activate, armGrass, createAndJoin, mapContent } from "./u2-cancel.helpers";
import { observeGeneration } from "./u3a-generate.helpers";
import { closeBuildTools, openBuildTools } from "./u3b-palette.helpers";
import { canvasHit, terrainReach } from "./u4b-terrain.helpers";
import {
  dragAmbientLight,
  placePropertyDoor,
  paintPropertyFloor,
  propertyFieldReach,
  propertyWire,
  publicRevision,
  toggleProperties,
} from "./u5-properties.helpers";

for (const phone of [false, true]) {
  test(`U5 ${phone ? "phone" : "desktop"} properties wait for both receipts and Lighting reaches the player`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(180_000);
    const viewport = phone ? { width: 375, height: 812 } : { width: 1280, height: 720 };
    const dmContext = await browser.newContext({
      baseURL,
      viewport,
      hasTouch: phone,
      isMobile: phone,
    });
    const playerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 720 },
    });
    const dm = await dmContext.newPage(),
      player = await playerContext.newPage();
    dm.setDefaultTimeout(12_000);
    const wire = await propertyWire(dm),
      playerWire = observeGeneration(player);
    try {
      await createAndJoin(dm, player, phone, `U5 properties ${phone ? "phone" : "desktop"}`);
      if (!phone) await dm.getByRole("button", { name: /Hide entities/i }).click();
      await armGrass(dm, phone, true);
      await publicRevision([dm, player], await paintPropertyFloor(dm, phone, wire));
      const { door, document } = await placePropertyDoor(dm, phone, wire);
      await publicRevision([dm, player], document);
      expect((await mapContent(player)).scene?.doors).toContainEqual(
        expect.objectContaining({ id: door.id, state: "closed" }),
      );
      await expect(dm.getByText("Properties · Door", { exact: true })).toBeVisible();
      const advanced = dm.getByRole("button", { name: "Position and scale", exact: true });
      await expect(advanced).toHaveAttribute("aria-expanded", "false");
      await dm.getByLabel("Door width (px)", { exact: true }).fill("75");
      await dm.getByLabel("Door state", { exact: true }).selectOption("locked");
      await activate(advanced, phone);
      const coordinate = dm.getByLabel("X (px)", { exact: true });
      await coordinate.focus();
      await coordinate.press("ControlOrMeta+A");
      await coordinate.pressSequentially("-25.5");
      await expect(coordinate).toHaveValue("-25.5");
      await dm.getByLabel("X (px)", { exact: true }).fill(String(door.transform.x + 25));
      if (phone) {
        const scaleX = dm.getByLabel("Scale X (×)", { exact: true });
        const scaleY = dm.getByLabel("Scale Y (×)", { exact: true });
        await scaleX.fill("20");
        await activate(dm.getByRole("button", { name: "Grow element", exact: true }), true);
        await expect(scaleX).toHaveValue("20.1");
        await expect(scaleY).toHaveValue("1.1");
        await scaleX.fill("0.05");
        await expect(
          dm.getByRole("button", { name: "Shrink element", exact: true }),
        ).toBeDisabled();
        await expect(scaleX).toHaveValue("0.05");
        await scaleX.fill("1");
        await scaleY.fill("1");
      }
      const beforeSave = wire.sent.length;
      const save = dm.getByRole("button", { name: "Save changes", exact: true });
      await expect(dm.getByText(/may need two Undo/)).toBeVisible();
      await terrainReach(dm, [advanced, save], info, "property-actions-reach.json");
      await propertyFieldReach(
        [
          dm.getByLabel("Door width (px)", { exact: true }),
          dm.getByLabel("Door state", { exact: true }),
          dm.getByLabel("X (px)", { exact: true }),
          dm.getByLabel("Y (px)", { exact: true }),
          dm.getByLabel("Scale X (×)", { exact: true }),
          dm.getByLabel("Scale Y (×)", { exact: true }),
          dm.getByLabel("Rotation (°)", { exact: true }),
          dm.getByLabel("Element layer", { exact: true }),
          dm.locator(".properties-checkbox"),
        ],
        info,
        "property-fields-reach.json",
      );
      wire.hold();
      await activate(save, phone);
      await expect.poll(() => wire.held()).toBeGreaterThan(0);
      const members = wire.sent.slice(beforeSave);
      expect(members.map(({ command }) => command.type)).toEqual(["update-element", "update-door"]);
      expect(members[0]!.command).toMatchObject({
        documentId: document.id,
        elementId: door.id,
        update: { transform: { x: door.transform.x + 25 } },
      });
      expect(members[1]!.command).toMatchObject({
        documentId: document.id,
        elementId: door.id,
        state: "locked",
        width: 75,
      });
      const moved = await wire.applied(members[0]!.command),
        complete = await wire.applied(members[1]!.command);
      expect(complete.revision).toBe(moved.revision + 1);
      await publicRevision([dm, player], complete);
      await expect(dm.getByRole("button", { name: "Saving changes…", exact: true })).toBeDisabled();
      await expect(dm.getByText("Changes saved.", { exact: true })).toHaveCount(0);
      wire.release();
      await expect(dm.getByText("Changes saved.", { exact: true })).toBeVisible();
      const saved = complete.elements.find((element) => element.id === door.id);
      expect(saved).toMatchObject({
        transform: { x: door.transform.x + 25 },
        data: { width: 75, state: "locked" },
      });
      expect((await mapContent(player)).scene?.doors).toContainEqual(
        expect.objectContaining({ id: door.id, state: "locked" }),
      );
      expect(wire.sent.slice(beforeSave)).toHaveLength(2);
      await info.attach("saved-properties.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      // A positive public door control above makes this privacy assertion non-vacuous.
      await dm.getByRole("checkbox", { name: "Hide element", exact: true }).check();
      const hideIndex = wire.sent.length;
      await activate(save, phone);
      await expect.poll(() => wire.sent.length).toBeGreaterThan(hideIndex);
      const hidden = await wire.applied(wire.sent[hideIndex]!.command);
      await publicRevision([dm, player], hidden);
      expect(
        (await mapContent(player)).scene?.doors.find((item) => item.id === door.id),
      ).toBeUndefined();
      expect(hidden.elements.find((item) => item.id === door.id)?.hidden).toBe(true);
      await toggleProperties(dm, phone);
      await chooseBuildTool(dm, "light", phone);
      const ambient = dm.getByRole("slider", { name: "Ambient light", exact: true });
      await expect(ambient).toHaveValue("1");
      await expect(ambient).toHaveAttribute("aria-valuetext", "100%");
      await expect(ambient).toHaveAccessibleDescription("Dark → Daylight");
      expect((await mapContent(player)).elements?.lighting?.ambient ?? 1).toBe(1);
      await expect(dm.getByText("Dark → Daylight", { exact: true })).toBeVisible();
      const lightIndex = wire.sent.length;
      await dragAmbientLight(dm, phone, () => wire.sent.length);
      await expect.poll(() => wire.sent.length).toBeGreaterThan(lightIndex);
      const night = await wire.applied(wire.sent[lightIndex]!.command);
      expect(wire.sent.slice(lightIndex)).toHaveLength(1);
      expect(wire.sent[lightIndex]!.command).toMatchObject({
        type: "update-layer",
        layerId: "lighting",
        update: { opacity: 0.2 },
      });
      await publicRevision([dm, player], night);
      for (const page of [dm, player])
        expect((await mapContent(page)).elements?.lighting?.ambient).toBeCloseTo(0.2);
      await closeBuildTools(dm, phone);
      const box = (await dm.getByTestId("map-board").locator("canvas").first().boundingBox())!;
      const point = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.3 };
      await canvasHit(dm, point);
      const poolIndex = wire.sent.length;
      if (phone) await dm.touchscreen.tap(point.x, point.y);
      else await dm.mouse.click(point.x, point.y);
      await expect.poll(() => wire.sent.length).toBeGreaterThan(poolIndex);
      const lit = await wire.applied(wire.sent[poolIndex]!.command);
      expect(lit.elements.filter((item) => item.type === "light")).toHaveLength(1);
      await publicRevision([dm, player], lit);
      expect((await mapContent(player)).scene?.lights).toEqual([]);
      expect((await mapContent(player)).elements?.lighting?.lights).toHaveLength(1);
      await openBuildTools(dm, phone);
      await expect(ambient).toHaveValue("0.2");
      await expect(ambient).toHaveAttribute("aria-valuetext", "20%");
      const layers = phone
        ? dm.getByTestId("mobile-layers-toggle")
        : dm.getByRole("button", { name: "🗂 Layers", exact: true });
      await activate(layers, phone);
      const layerPanel = phone
        ? dm.getByTestId("mobile-layers")
        : dm.getByRole("region", { name: "Layers", exact: true });
      await expect(
        layerPanel.getByRole("slider", { name: "Ambient light", exact: true }),
      ).toHaveValue("0.2");
      await expect(
        layerPanel.getByRole("slider", { name: "Ambient light", exact: true }),
      ).toHaveAttribute("aria-valuetext", "20%");
      await activate(layers, phone);

      const sizes = phone
        ? [{ width: 812, height: 375 }, { width: 820, height: 1180 }, viewport]
        : [{ width: 640, height: 360 }, viewport];
      for (const size of sizes) {
        await dm.setViewportSize(size);
        const navigation = dm.getByRole("navigation", { name: "Map edit actions", exact: true });
        const compact = phone || size.width === 640;
        // Viewport resizing returns before the responsive React layout commits.
        if (compact) await expect(navigation).toBeVisible();
        else await expect(navigation).toBeHidden();
        if (
          compact &&
          !(await dm.getByRole("dialog", { name: "Map tools", exact: true }).isVisible())
        )
          await activate(navigation.getByRole("button", { name: "Tool", exact: true }), phone);
        await propertyFieldReach(
          [ambient],
          info,
          `ambient-reach-${size.width}x${size.height}.json`,
        );
        await chooseBuildTool(dm, "select", phone);
        const toggle = compact
          ? dm.getByTestId("mobile-inspector-toggle")
          : dm.getByRole("button", { name: "🔍 Inspect", exact: true });
        if (
          !(await dm.getByRole("group", { name: "Selected properties", exact: true }).isVisible())
        )
          await activate(toggle, phone);
        if ((await advanced.getAttribute("aria-expanded")) === "false")
          await activate(advanced, phone);
        await dm.getByLabel("Door width (px)", { exact: true }).fill("80");
        await propertyFieldReach(
          [
            dm.getByLabel("Door width (px)", { exact: true }),
            dm.getByLabel("Element layer", { exact: true }),
            dm.getByLabel("X (px)", { exact: true }),
            dm.getByLabel("Y (px)", { exact: true }),
            dm.getByLabel("Scale X (×)", { exact: true }),
            dm.getByLabel("Scale Y (×)", { exact: true }),
            dm.getByLabel("Rotation (°)", { exact: true }),
            dm.locator(".properties-checkbox"),
          ],
          info,
          `properties-reach-${size.width}x${size.height}.json`,
        );
        await info.attach(`property-fields-${size.width}x${size.height}.png`, {
          body: await dm.screenshot(),
          contentType: "image/png",
        });
        await terrainReach(
          dm,
          [save, dm.getByRole("button", { name: "Discard changes", exact: true })],
          info,
          `save-reach-${size.width}x${size.height}.json`,
        );
        await activate(toggle, phone);
        await activate(toggle, phone);
        await expect(dm.getByLabel("Door width (px)", { exact: true })).toHaveValue("80");
        await activate(toggle, phone);
        await chooseBuildTool(dm, "light", phone);
      }
      await info.attach("lighting-dm.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await info.attach("lighting-player.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
      expect(
        playerWire.received.filter((frame) => "t" in frame && frame.t === "map-studio-document"),
      ).toEqual([]);
    } finally {
      wire.release();
      await info.attach("properties-command-receipts.json", {
        body: JSON.stringify({
          sent: wire.sent,
          receipts: wire.incoming.filter(
            (frame) => "t" in frame && frame.t === "map-studio-document",
          ),
        }),
        contentType: "application/json",
      });
      await dmContext.close();
      await playerContext.close();
    }
  });
}
