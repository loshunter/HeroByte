/**
 * The token creator (C4), driven through real input on a disposable private
 * table: a player picks a file, moves and zooms it, accepts, and both screens
 * show the uploaded WebP; a transparent picture keeps or loses its
 * transparency by backdrop; the DM's NPC picture rides the NPC's record, so
 * an NPC edit afterwards keeps it. The pictures are drawn in the browser, so
 * the bake decodes real pixels.
 */

import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";
import { openCharacterDetails, openOwnCharacterSettings, rosterRow } from "./party.helpers";
import {
  createTableAsDM,
  joinTable,
  ownCharacters,
  placeNpcTokens,
  send,
  tokenOf,
} from "./u7-party.helpers";

const DESKTOP = { viewport: { width: 1440, height: 900 } };
const ASSET = /\/assets\/[0-9a-f]{64}$/;

/** A PNG drawn in the page: an opaque 600×400 scene, or a disc on transparency. */
async function drawPicture(page: Page, transparent: boolean): Promise<Buffer> {
  const base64 = await page.evaluate(async (clear) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    if (!clear) {
      const sky = context.createLinearGradient(0, 0, 600, 400);
      sky.addColorStop(0, "#3b5f8a");
      sky.addColorStop(1, "#c9784a");
      context.fillStyle = sky;
      context.fillRect(0, 0, 600, 400);
    }
    context.fillStyle = "#e8d8a8";
    context.beginPath();
    context.arc(300, 200, 120, 0, Math.PI * 2);
    context.fill();
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, transparent);
  return Buffer.from(base64, "base64");
}

/** A token's picture as this page's snapshot holds it. */
const tokenImage = (page: Page, tokenId: string) =>
  page.evaluate(
    (id) => window.__HERO_BYTE_E2E__?.snapshot?.tokens.find((t) => t.id === id)?.imageUrl ?? null,
    tokenId,
  );

/** Decode an uploaded picture in the page: its type, size, edge and transparent pixel count. */
const inspectAsset = (page: Page, url: string) =>
  page.evaluate(async (address) => {
    const response = await fetch(address, { cache: "no-store" });
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) clear += 1;
    return {
      type: response.headers.get("content-type"),
      bytes: blob.size,
      width: bitmap.width,
      height: bitmap.height,
      clear,
    };
  }, url);

async function openCreator(settings: Locator | Page, page: Page) {
  await settings.getByRole("button", { name: "Token picture…" }).click();
  const creator = page.getByRole("tabpanel", { name: "Picture" });
  await expect(creator).toBeVisible({ timeout: 15_000 });
  return creator;
}

/** Home on the zoom slider: half the fit size, a margin all round. */
async function zoomAllTheWayOut(page: Page) {
  await page.getByRole("slider", { name: "Zoom" }).focus();
  await page.keyboard.press("Home");
}

async function pick(page: Page, buffer: Buffer) {
  await page.getByLabel("Token picture file").setInputFiles({
    name: "art.png",
    mimeType: "image/png",
    buffer,
  });
  await expect(page.getByRole("button", { name: /Rotate/ })).toBeVisible();
}

test.describe("token creator", () => {
  test.describe.configure({ timeout: 90_000 });

  test("a player frames a picture, accepts, and both screens show the WebP", async ({
    page: dm,
    browser,
  }) => {
    const desk = await browser.newContext(DESKTOP);
    try {
      const player = await desk.newPage();
      await dm.setViewportSize(DESKTOP.viewport);
      const roomUrl = await createTableAsDM(dm, "c4-creator");
      await joinTable(player, roomUrl);
      await expect.poll(async () => (await ownCharacters(player))[0]?.tokenId).toBeTruthy();
      const tokenId = (await ownCharacters(player))[0]!.tokenId!;

      const settings = await openOwnCharacterSettings(player);
      await openCreator(settings, player);
      await pick(player, await drawPicture(player, false));

      // Escape closes the creator alone: the settings window behind it stays.
      await player.keyboard.press("Escape");
      await expect(player.getByRole("tabpanel", { name: "Picture" })).toHaveCount(0);
      await expect(settings.getByRole("button", { name: "Token picture…" })).toBeVisible();
      expect(await tokenImage(player, tokenId)).toBeNull();
      await openCreator(settings, player);
      await pick(player, await drawPicture(player, false));

      // Drag right and wheel up on the crop area: the picture moves right and grows.
      const crop = player.getByTestId("token-creator-crop");
      const box = (await crop.boundingBox())!;
      const zoom = player.getByRole("slider", { name: "Zoom" });
      await expect(zoom).toHaveAttribute("aria-valuetext", "100%");
      const left = () => crop.locator("img").evaluate((img) => parseFloat(img.style.left));
      const leftBefore = await left();
      await player.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await player.mouse.down();
      await player.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
      await player.mouse.up();
      // 40 px on a 280 px square: about +14% of the square.
      expect((await left()) - leftBefore).toBeGreaterThan(10);
      await player.mouse.wheel(0, -300);
      const zoomed = Number.parseInt((await zoom.getAttribute("aria-valuetext"))!, 10);
      expect(zoomed).toBeGreaterThanOrEqual(150);

      await player.getByRole("button", { name: "Use this picture" }).click();
      await expect.poll(() => tokenImage(player, tokenId), { timeout: 15_000 }).toMatch(ASSET);
      const url = (await tokenImage(player, tokenId))!;
      // The other client gets the same picture through the broadcast.
      await expect.poll(() => tokenImage(dm, tokenId)).toBe(url);

      const asset = await inspectAsset(player, url);
      expect(asset.type).toBe("image/webp");
      expect(asset.width).toBe(512);
      expect(asset.height).toBe(512);
      // An opaque picture covering the square bakes with no transparent pixel.
      expect(asset.clear).toBe(0);
      test.info().annotations.push({ type: "bytes", description: `opaque 512: ${asset.bytes}` });
      // The creator closed; the settings window shows the new picture.
      await expect(player.getByRole("tabpanel", { name: "Picture" })).toHaveCount(0);
      await expect(settings.getByAltText("Token preview")).toHaveAttribute("src", url);
    } finally {
      await desk.close();
    }
  });

  test("transparent art: a backdrop fills it, 'None' keeps it", async ({ page: dm, browser }) => {
    const desk = await browser.newContext(DESKTOP);
    try {
      const player = await desk.newPage();
      await dm.setViewportSize(DESKTOP.viewport);
      const roomUrl = await createTableAsDM(dm, "c4-backdrop");
      await joinTable(player, roomUrl);
      await expect.poll(async () => (await ownCharacters(player))[0]?.tokenId).toBeTruthy();
      const tokenId = (await ownCharacters(player))[0]!.tokenId!;
      const art = await drawPicture(player, true);

      const settings = await openOwnCharacterSettings(player);
      await openCreator(settings, player);
      await pick(player, art);
      // Zoom out so the disc sits inside the square with room all round.
      await zoomAllTheWayOut(player);
      await player.getByLabel("Backdrop", { exact: true }).selectOption("solid");
      await player.getByRole("button", { name: "Use this picture" }).click();
      await expect.poll(() => tokenImage(player, tokenId), { timeout: 15_000 }).toMatch(ASSET);
      const filled = await inspectAsset(player, (await tokenImage(player, tokenId))!);
      expect(filled.clear).toBe(0);

      await openCreator(settings, player);
      await pick(player, art);
      await zoomAllTheWayOut(player);
      await player.getByLabel("Backdrop", { exact: true }).selectOption("none");
      const before = await tokenImage(player, tokenId);
      await player.getByRole("button", { name: "Use this picture" }).click();
      await expect.poll(() => tokenImage(player, tokenId), { timeout: 15_000 }).not.toBe(before);
      const kept = await inspectAsset(player, (await tokenImage(player, tokenId))!);
      expect(kept.clear).toBeGreaterThan(512 * 512 * 0.3);
      test.info().annotations.push({
        type: "bytes",
        description: `transparent 512, solid: ${filled.bytes}; none: ${kept.bytes}`,
      });
    } finally {
      await desk.close();
    }
  });

  test("the DM's NPC picture survives an NPC edit", async ({ page: dm }) => {
    await dm.setViewportSize(DESKTOP.viewport);
    await createTableAsDM(dm, "c4-npc");
    await send(dm, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7 });
    await placeNpcTokens(dm, 1);
    const tokenId = (await tokenOf(dm, "Goblin"))!;

    const inspector = await openCharacterDetails(dm, rosterRow(dm, "Goblin"));
    await inspector.getByRole("button", { name: "NPC settings: Goblin" }).click();
    // The NPC window is the only one open, so its button is the page's only one.
    await openCreator(dm, dm);
    await pick(dm, await drawPicture(dm, false));
    await dm.getByRole("button", { name: "Use this picture" }).click();

    const npc = () =>
      dm.evaluate(
        () =>
          window.__HERO_BYTE_E2E__?.snapshot?.characters.find((c) => c.name === "Goblin") ?? null,
      );
    await expect
      .poll(async () => (await npc())?.tokenImage ?? null, { timeout: 15_000 })
      .toMatch(ASSET);
    const url = (await npc())!.tokenImage!;
    await expect.poll(() => tokenImage(dm, tokenId)).toBe(url);

    // An NPC edit through the card (a full-record send, usePartyNpcActions): the
    // server copies the record's picture onto the token, so it must still be there.
    await dm.getByRole("button", { name: "Close NPC Settings" }).click();
    await inspector.getByRole("button", { name: "Set current HP: 7" }).click();
    await inspector.getByLabel("Current HP").fill("3");
    await inspector.getByLabel("Current HP").press("Enter");
    await expect.poll(async () => (await npc())?.hp).toBe(3);
    expect((await npc())?.tokenImage).toBe(url);
    expect(await tokenImage(dm, tokenId)).toBe(url);
  });
});
