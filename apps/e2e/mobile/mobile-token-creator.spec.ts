/**
 * The token creator on a phone (C4): ⚙️ EDIT → "Token picture…" opens the
 * full-screen creator, a real two-finger pinch zooms (CDP touch: Playwright's
 * own touch is tap-only), a drag moves, every control clears the 44px floor,
 * and Accept sets the token's picture through the wire.
 */
import { expect, test, type Page } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag, touchPinch } from "./touch.helpers";

const ASSET = /\/assets\/[0-9a-f]{64}$/;

/** A real 600×400 PNG drawn in the page. */
async function drawPicture(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#406080";
    context.fillRect(0, 0, 600, 400);
    context.fillStyle = "#e0c070";
    context.fillRect(200, 100, 200, 200);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  return Buffer.from(base64, "base64");
}

const ownTokenImage = (page: Page) =>
  page.evaluate(() => {
    const seam = window.__HERO_BYTE_E2E__;
    return seam?.snapshot?.tokens.find((t) => t.owner === seam.uid)?.imageUrl ?? null;
  });

test.describe("mobile token creator", () => {
  test.describe.configure({ timeout: 90_000 });

  test("a phone frames a picture full-screen with pinch and drag, and sets it", async ({
    page,
  }) => {
    await joinMobileTable(page);
    await page.getByRole("button", { name: /Party/i }).click();
    await page.getByRole("button", { name: /EDIT/i }).click();
    await page.getByRole("button", { name: "Token picture…" }).click();

    const creator = page.locator('[data-mobile-surface="token-creator"]');
    const panel = creator.getByRole("tabpanel", { name: "Picture" });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    // Full-screen: the creator's window spans the viewport edge to edge.
    const viewport = page.viewportSize()!;
    // The window is "Art & frame" since C5a gave it the Frame tab (a token to frame).
    const close = creator.getByRole("button", { name: /^Close 🖼️ Art & frame/ });
    const windowBox = (await close
      .locator("xpath=ancestor::*[contains(@style,'position: fixed')][1]")
      .boundingBox())!;
    expect(windowBox).toMatchObject({ x: 0, y: 0 });
    expect(windowBox.width).toBe(viewport.width);
    expect(windowBox.height).toBe(viewport.height);

    // ✕ before any picture: back to the settings window, nothing changed.
    const imageBefore = await ownTokenImage(page);
    await close.click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Token picture…" })).toBeVisible();
    expect(await ownTokenImage(page)).toBe(imageBefore);
    await page.getByRole("button", { name: "Token picture…" }).click();
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("Token picture file").setInputFiles({
      name: "camera-roll.png",
      mimeType: "image/png",
      buffer: await drawPicture(page),
    });
    await expect(creator.getByRole("button", { name: /Rotate/ })).toBeVisible();

    // Every control a finger presses clears the floor, under each backdrop's controls.
    const sweep = async (when: string) => {
      const controls = creator.locator(
        "button:visible, select:visible, input:visible:not([type=file])",
      );
      for (const control of await controls.all()) {
        const box = (await control.boundingBox())!;
        const name =
          (await control.getAttribute("aria-label")) ??
          (await control.textContent()) ??
          (await control.getAttribute("type"));
        expect(box.height, `${when}: ${name} is ${box.height}px tall`).toBeGreaterThanOrEqual(44);
      }
      const closeBox = (await close.boundingBox())!;
      expect(closeBox.width, `${when}: ✕ width`).toBeGreaterThanOrEqual(44);
    };
    await sweep("auto");
    const backdrop = creator.getByLabel("Backdrop", { exact: true });
    await backdrop.selectOption("solid");
    await sweep("solid");
    await backdrop.selectOption("gradient");
    await sweep("gradient");
    await backdrop.selectOption("auto");

    const crop = creator.getByTestId("token-creator-crop");
    await crop.scrollIntoViewIfNeeded();
    const box = (await crop.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const zoom = creator.getByRole("slider", { name: "Zoom" });
    await expect(zoom).toHaveAttribute("aria-valuetext", "100%");

    const cdp = await openTouch(page);
    await touchPinch(
      cdp,
      [
        { x: cx - 30, y: cy },
        { x: cx + 30, y: cy },
      ],
      [
        { x: cx - 90, y: cy },
        { x: cx + 90, y: cy },
      ],
    );
    const zoomed = Number.parseInt((await zoom.getAttribute("aria-valuetext"))!, 10);
    // Fingers three times as far apart: about three times the zoom.
    expect(zoomed).toBeGreaterThan(250);
    expect(zoomed).toBeLessThan(350);

    const left = () => crop.locator("img").evaluate((img) => parseFloat(img.style.left));
    const before = await left();
    await touchDrag(cdp, { x: cx, y: cy }, [{ x: cx + 40, y: cy + 20 }]);
    // A finger 40 px right moves the picture right.
    expect((await left()) - before).toBeGreaterThan(5);

    await creator.getByRole("button", { name: "Use this picture" }).click();
    await expect.poll(() => ownTokenImage(page), { timeout: 15_000 }).toMatch(ASSET);
    await expect(panel).toHaveCount(0);
    // Back on the settings sheet, which now shows the picture.
    await expect(page.getByAltText("Token preview")).toHaveAttribute(
      "src",
      (await ownTokenImage(page))!,
    );
  });
});
