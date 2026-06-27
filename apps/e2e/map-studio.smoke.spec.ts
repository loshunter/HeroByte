import { expect, test } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";

test.describe("Map Studio smoke", () => {
  test("DM can create a versioned map and add geometry", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    await page.getByRole("button", { name: "🛠️ DM MENU" }).click();

    await expect(page.getByText("HeroByte Map Studio", { exact: true })).toBeVisible();
    await page.getByLabel("New map name").fill("Smoke Test Dungeon");
    await page.getByRole("button", { name: "CREATE EDITABLE MAP" }).click();

    await expect(page.getByRole("img", { name: "Smoke Test Dungeon map preview" })).toBeVisible();
    await expect(page.getByText(/revision 0 · 0 elements/)).toBeVisible();

    await page.getByLabel("Grid type").selectOption("isometric");
    await page.getByLabel("Grid size").fill("64");
    await page.getByRole("button", { name: "APPLY GRID" }).click();
    await expect(page.getByText(/revision 1 · 0 elements/)).toBeVisible();

    await page.getByRole("button", { name: "ADD TO MAP" }).click();
    await expect(page.getByText(/revision 2 · 1 elements/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete shape 1" })).toBeVisible();

    await page.getByRole("button", { name: "Edit shape 1" }).click();
    await page.getByLabel("Element X").fill("320");
    await page.getByLabel("Element rotation").fill("45");
    await page.getByRole("button", { name: "APPLY ELEMENT" }).click();
    await expect(page.getByText(/revision 3 · 1 elements/)).toBeVisible();

    await page.getByRole("button", { name: "↶ UNDO" }).click();
    await expect(page.getByText(/revision 4 · 1 elements/)).toBeVisible();
    await page.getByRole("button", { name: "↷ REDO" }).click();
    await expect(page.getByText(/revision 5 · 1 elements/)).toBeVisible();

    await page.getByLabel("Wall start X").fill("64");
    await page.getByLabel("Wall start Y").fill("64");
    await page.getByLabel("Wall end X").fill("320");
    await page.getByLabel("Wall end Y").fill("64");
    await page.getByRole("button", { name: "ADD WALL" }).click();
    await expect(page.getByText(/revision 6 · 2 elements/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete wall 2" })).toBeVisible();

    await page.getByLabel("Structure type").selectOption("door");
    await page.getByLabel("Door X").fill("160");
    await page.getByLabel("Door Y").fill("64");
    await page.getByLabel("Door width").fill("64");
    await page.getByLabel("Door rotation").fill("0");
    await page.getByLabel("Door state").selectOption("locked");
    await page.getByRole("button", { name: "ADD DOOR" }).click();
    await expect(page.getByText(/revision 7 · 3 elements/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete door 3" })).toBeVisible();

    await page.getByRole("button", { name: "PUBLISH TO LIVE MAP" }).click();
    await expect(page.getByRole("status")).toHaveText("Published \"Smoke Test Dungeon\" to the live map.");
    await page.waitForFunction(() => {
      const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
      return snapshot?.mapBackground?.startsWith("data:image/svg+xml") && snapshot.gridSize === 64;
    });
  });
});
