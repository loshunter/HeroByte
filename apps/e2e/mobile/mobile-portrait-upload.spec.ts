/**
 * S3 mobile commitment (arc §7a): uploading a face works from a phone — the
 * camera-roll path is a plain <input type="file">, which Playwright drives
 * with setInputFiles (a CDP DOM.setFileInputFiles call, so the display:none
 * input needs no tap-through). The player-settings portrait field is the one
 * upload surface that exists on the mobile layout; the DM editors are
 * desktop-only by design (arc §6: no mobile DM menu this arc).
 *
 * The server side is real: the bytes go through POST /assets (credential
 * gated, magic-byte sniffed, quota'd) into the e2e asset store, and the
 * committed portrait must come back from the room snapshot, not from local
 * component state.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngBuffer(payload: string): Buffer {
  return Buffer.concat([Buffer.from(PNG_MAGIC), Buffer.from(payload)]);
}

test.describe("mobile portrait upload", () => {
  test("a phone uploads a portrait from the camera roll and the table sees it", async ({
    page,
  }) => {
    await joinMobileTable(page);

    // Party drawer → own row → settings.
    await page.getByRole("button", { name: /Party/i }).click();
    await page.getByRole("button", { name: /EDIT/i }).click();

    // The hidden file input is labeled after its field, so several ImageFields
    // on one screen stay distinguishable.
    const fileInput = page.getByLabel("Portrait Image URL upload");
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles({
      name: "camera-roll-photo.png",
      mimeType: "image/png",
      buffer: pngBuffer(`mobile-portrait-${Date.now()}`),
    });

    // Upload committed: the URL buffer now holds the stored asset's address.
    const urlInput = page.getByLabel("Portrait Image URL", { exact: true });
    await expect(urlInput).toHaveValue(/\/assets\/[a-f0-9]{64}$/, { timeout: 10_000 });
    const assetUrl = await urlInput.inputValue();

    // The bytes actually landed in the (e2e-isolated) store and serve publicly.
    const response = await page.request.get(assetUrl);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");

    // And the COMMIT went through the wire: the room snapshot's character —
    // not component state — carries the portrait.
    await page.waitForFunction((url) => {
      const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
      const characters = (snapshot?.characters ?? []) as { portrait?: string }[];
      const players = (snapshot?.players ?? []) as { portrait?: string }[];
      return characters.some((c) => c.portrait === url) || players.some((p) => p.portrait === url);
    }, assetUrl);
  });

  test("the upload control meets the touch hit-target guideline", async ({ page }) => {
    await joinMobileTable(page);
    await page.getByRole("button", { name: /Party/i }).click();
    await page.getByRole("button", { name: /EDIT/i }).click();

    const uploadButton = page.getByRole("button", { name: /Upload image/i });
    await expect(uploadButton).toBeVisible();
    const box = await uploadButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
