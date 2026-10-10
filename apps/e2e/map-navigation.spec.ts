import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte map navigation", () => {
  test("player can pan the map by dragging", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.cam);
    });

    const initialCam = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return { x: data?.cam?.x ?? 0, y: data?.cam?.y ?? 0 };
    });

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    const dragDistance = 100;

    // Hold space and drag to pan
    await page.keyboard.down("Space");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dragDistance, startY + dragDistance, { steps: 15 });
    await page.mouse.up();
    await page.keyboard.up("Space");

    // Wait for camera to update
    await page.waitForFunction(
      ({ initX, initY }) => {
        const data = window.__HERO_BYTE_E2E__;
        const cam = data?.cam;
        return cam && (cam.x !== initX || cam.y !== initY);
      },
      initialCam,
      { timeout: 3000 },
    );

    const finalCam = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return { x: data?.cam?.x ?? 0, y: data?.cam?.y ?? 0 };
    });

    // Camera position should have changed
    expect(finalCam.x !== initialCam.x || finalCam.y !== initialCam.y).toBe(true);
  });

  test("player can zoom in and out with mouse wheel", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      return Boolean(data?.cam);
    });

    const initialScale = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.cam?.scale ?? 1;
    });

    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Zoom in with mouse wheel
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -100); // Negative delta = zoom in

    await page.waitForFunction(
      (initScale) => {
        const data = window.__HERO_BYTE_E2E__;
        return (data?.cam?.scale ?? 1) > initScale;
      },
      initialScale,
      { timeout: 3000 },
    );

    const zoomedInScale = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.cam?.scale ?? 1;
    });

    expect(zoomedInScale).toBeGreaterThan(initialScale);

    // Zoom out with mouse wheel
    await page.mouse.wheel(0, 100); // Positive delta = zoom out

    await page.waitForFunction(
      (prevScale) => {
        const data = window.__HERO_BYTE_E2E__;
        return (data?.cam?.scale ?? 1) < prevScale;
      },
      zoomedInScale,
      { timeout: 3000 },
    );

    const zoomedOutScale = await page.evaluate(() => {
      return window.__HERO_BYTE_E2E__?.cam?.scale ?? 1;
    });

    expect(zoomedOutScale).toBeLessThan(zoomedInScale);
  });

  test("snap button toggles grid snapping", async ({ page }) => {
    await joinDefaultRoom(page);

    const snapButton = page.getByRole("button", { name: "Snap" });
    await expect(snapButton).toBeVisible();

    // Check button variant/class instead of state
    // The button should have "primary" variant when snap is on
    const initialVariant = await snapButton.getAttribute("class");
    expect(initialVariant).toBeTruthy();

    // Toggle snap
    await snapButton.click();
    await page.waitForTimeout(300);

    const newVariant = await snapButton.getAttribute("class");
    expect(newVariant).toBeTruthy();
    expect(newVariant).not.toBe(initialVariant);

    // Toggle again to verify it switches back
    await snapButton.click();
    await page.waitForTimeout(300);

    const finalVariant = await snapButton.getAttribute("class");
    expect(finalVariant).toBe(initialVariant);
  });

  test("player can reset camera to default position", async ({ page }) => {
    await joinDefaultRoom(page);

    await page.waitForFunction(() => {
      return Boolean(window.__HERO_BYTE_E2E__?.cam);
    });

    // Get initial camera position
    const initialCam = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return { x: data?.cam?.x ?? 0, y: data?.cam?.y ?? 0, scale: data?.cam?.scale ?? 1 };
    });

    // Pan the camera away from initial position
    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await page.keyboard.down("Space");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY + 200, { steps: 15 });
    await page.mouse.up();
    await page.keyboard.up("Space");

    await page.waitForTimeout(500);

    const movedCam = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__;
      return { x: data?.cam?.x ?? 0, y: data?.cam?.y ?? 0, scale: data?.cam?.scale ?? 1 };
    });

    // Verify camera actually moved
    const hasMoved = movedCam.x !== initialCam.x || movedCam.y !== initialCam.y;
    expect(hasMoved).toBe(true);

    // The header's Reset view puts the camera back at the map's top-left, 100% zoom.
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const cam = window.__HERO_BYTE_E2E__?.cam;
          return cam ? { x: cam.x, y: cam.y, scale: cam.scale } : null;
        }),
      )
      .toEqual({ x: 0, y: 0, scale: 1 });
  });
});
