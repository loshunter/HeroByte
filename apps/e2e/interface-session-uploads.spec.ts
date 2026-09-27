import { expect, test } from "./fixtures";
import { armGrass, createAndJoin, mapContent } from "./u2-cancel.helpers";
import { chooseBuildTool } from "./build-palette.helpers";
import { observeGeneration } from "./u3a-generate.helpers";
import { canvasHit, targetCell, terrainReach } from "./u4b-terrain.helpers";

test("U5 blocked-storage upload survives picker reopening and reaches the player", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(120_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } });
  const playerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 720 },
  });
  // Inject only the storage-write failure; uploads and all UI actions stay real.
  await dmContext.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "herobyte-my-stuff")
        throw new DOMException("Storage blocked", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  const dm = await dmContext.newPage(),
    player = await playerContext.newPage();
  const wire = observeGeneration(dm),
    playerWire = observeGeneration(player);
  try {
    await createAndJoin(dm, player, false, "U5 session uploads");
    await dm.getByRole("button", { name: /Hide entities/i }).click();
    await armGrass(dm, false, true);
    await chooseBuildTool(dm, "place", false);
    const toggle = dm.getByTestId("build-settings").getByRole("button", { name: /^[▸▾] / });
    await toggle.click();
    await dm.getByRole("button", { name: "My uploads", exact: true }).click();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    );
    const upload = async (name: string) => {
      await dm
        .locator('.collection-browser input[type="file"]')
        .setInputFiles({ name, mimeType: "image/png", buffer: png });
      await expect(
        dm.getByRole("button", { name: name.replace(".png", ""), exact: true }),
      ).toBeVisible();
    };
    await upload("Amber torch.png");
    expect(await dm.evaluate(() => localStorage.getItem("herobyte-my-stuff"))).toBeNull();
    await toggle.click();
    await expect(dm.getByRole("searchbox", { name: "Search objects" })).toHaveCount(0);
    await toggle.click();
    await dm.getByRole("button", { name: "My uploads", exact: true }).click();
    await expect(dm.getByRole("button", { name: "Amber torch", exact: true })).toBeVisible();
    await upload("Copper torch.png");
    await chooseBuildTool(dm, "select", false);
    await chooseBuildTool(dm, "place", false);
    if ((await dm.getByRole("searchbox", { name: "Search objects" }).count()) === 0)
      await toggle.click();
    await dm.getByRole("button", { name: "My uploads", exact: true }).click();
    const copper = dm.getByRole("button", { name: "Copper torch", exact: true });
    await expect(copper).toBeVisible();
    await expect(dm.getByRole("button", { name: "Amber torch", exact: true })).toHaveCount(0);
    await copper.click();
    await expect(copper.locator("img")).toHaveJSProperty("naturalWidth", 1);
    await expect(dm.getByRole("group", { name: "Selected object" })).toContainText("Copper torch");
    await terrainReach(dm, [copper], info, "session-upload-reach.json");
    await info.attach("session-upload-reopened.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
    await dm.getByRole("button", { name: "▦ Grid tile", exact: true }).click();
    await expect(dm.getByRole("button", { name: "◆ Free stamp", exact: true })).toBeVisible();
    const point = await targetCell(dm, wire.document(), false);
    await canvasHit(dm, point.from);
    await dm.mouse.click(point.from.x, point.from.y);
    await expect.poll(() => wire.document().elements.length).toBe(1);
    const document = wire.document();
    const element = document.elements[0]!;
    expect(element.type).toBe("stamp");
    if (element.type !== "stamp") throw new Error("Expected the uploaded stamp");
    expect(element.data.assetId).toMatch(/^upload:[a-f0-9]{64}$/);
    await expect
      .poll(async () =>
        (await mapContent(player)).elements?.layers.flatMap((layer) => layer.elements),
      )
      .toContainEqual(
        expect.objectContaining({
          id: element.id,
          data: expect.objectContaining({ assetId: element.data.assetId }),
        }),
      );
    await expect
      .poll(async () => (await mapContent(player)).elements)
      .toEqual((await mapContent(dm)).elements);
    await chooseBuildTool(dm, "select", false);
    await canvasHit(dm, point.from);
    await dm.mouse.click(point.from.x, point.from.y);
    await dm.getByRole("button", { name: "🔍 Inspect", exact: true }).click();
    const summary = dm.locator(".properties-summary");
    await expect(summary).toContainText("Copper torch");
    await summary.scrollIntoViewIfNeeded();
    await expect(summary).toBeVisible();
    expect(await dm.evaluate(() => localStorage.getItem("herobyte-my-stuff"))).toBeNull();
    expect(
      playerWire.received.filter((frame) => "t" in frame && frame.t === "map-studio-document"),
    ).toEqual([]);
    await info.attach("session-upload-properties.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
    await info.attach("session-upload-player.png", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
    await info.attach("session-upload-evidence.json", {
      body: JSON.stringify({
        element,
        dm: await mapContent(dm),
        player: await mapContent(player),
        sent: wire.sent,
      }),
      contentType: "application/json",
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
