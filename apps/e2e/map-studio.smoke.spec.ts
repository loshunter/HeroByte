import { expect, test } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";

test.describe("Map Studio smoke", () => {
  test("DM creates a map from DM tools and edits it on the main canvas", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    await page.getByRole("button", { name: "🛠️ DM MENU" }).click();

    await expect(page.getByText("HeroByte Map Studio", { exact: true })).toBeVisible();
    await page.getByLabel("New map name").fill("Smoke Test Dungeon");
    await page.getByRole("button", { name: "CREATE EDITABLE MAP" }).click();

    const studioCanvas = page.getByRole("img", { name: "Smoke Test Dungeon studio canvas" });
    await expect(studioCanvas).toBeVisible();
    await expect(page.getByText("Tile Palette")).toBeVisible();
    await expect(page.getByRole("img", { name: /map preview/i })).toHaveCount(0);

    const bounds = await studioCanvas.boundingBox();
    expect(bounds).not.toBeNull();
    await page.getByRole("button", { name: "Zoom In" }).click();
    await page.getByRole("button", { name: "Pan" }).click();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width / 2 - 80, bounds!.y + bounds!.height / 2 - 40);
    await page.mouse.up();

    await page.getByRole("button", { name: "Room" }).click();
    await page.mouse.move(bounds!.x + bounds!.width / 2 - 50, bounds!.y + bounds!.height / 2 - 50);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width / 2 + 50, bounds!.y + bounds!.height / 2 + 50);
    await page.mouse.up();
    await expect(page.getByText(/Smoke Test Dungeon · 2048×2048 · r1/)).toBeVisible();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(
      'Published "Smoke Test Dungeon" to the live map.',
    );
    await page.waitForFunction(() => {
      const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
      return snapshot?.mapBackground?.startsWith("data:image/svg+xml") && snapshot.gridSize === 50;
    });
  });
});
