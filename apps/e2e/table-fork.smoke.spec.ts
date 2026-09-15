/**
 * "Save as a private table", end to end — the DM names the copy, sets its two
 * passwords, clicks Save & Go There, and the browser lands in the new room.
 *
 * Why this spec exists: the server's `table-forked` reply was silently dropped
 * by the client router for as long as the forward-compat guard existed (never
 * on the control list, like `session-file`), so every save ended in "The
 * server didn't confirm the save" — with the copy minted on the server, and
 * another orphan minted per retry. Nothing was red: no unit test routed the
 * frame and no e2e clicked the button. Found by the Weighed Campaign's review.
 */
import { expect, test } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";
import { selectDMTab } from "./docs-shots.helpers";

test.describe("Table Fork - Smoke Tests", () => {
  test("Save & Go There mints a private table and lands the DM in it", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    await selectDMTab(page, "Session");

    await page.locator("#fork-name").fill("Fork Smoke");
    await page.locator("#fork-pw").fill("smoke-table-pw");
    await page.locator("#fork-dm").fill("smoke-dm-password");

    await Promise.all([
      page.waitForURL(/room=/, { timeout: 15_000 }),
      page.getByRole("button", { name: /Save & Go There/i }).click(),
    ]);

    expect(new URL(page.url()).searchParams.get("room")).toBeTruthy();
  });
});
