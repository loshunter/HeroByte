import { test } from "@playwright/test";
import { joinDefaultRoom } from "./helpers";

test.describe("HeroByte smoke", () => {
  test("user can join default room", async ({ page }) => {
    await joinDefaultRoom(page);
  });
});
