/**
 * Save Game State, end to end — the DM clicks the button and a session file
 * the loader accepts actually downloads, with a toast that says its weight.
 *
 * Why this spec exists: the server's `session-file` reply was silently dropped
 * by the client router for as long as the forward-compat guard existed (it was
 * never on the control list), and NOTHING was red — no unit test routed the
 * frame and no e2e clicked Save. A dropped frame type is the class of bug only
 * a real click can see. Found live on 2026-09-14.
 */
import { expect, test } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";
import { selectDMTab } from "./docs-shots.helpers";

test.describe("Session Save - Smoke Tests", () => {
  test("Save Game State downloads a file the loader accepts, and the toast says its weight", async ({
    page,
  }) => {
    await joinDefaultRoomAsDM(page);
    await selectDMTab(page, "Session");

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      page.getByRole("button", { name: /Save Game State/i }).click(),
    ]);

    // The toast: the weight beside the map count, under the load limit.
    await expect(page.getByText(/MB of the 1\.00 MB a load accepts/)).toBeVisible({
      timeout: 10_000,
    });

    // The file: the envelope the loaders read (schemaVersion, snapshot,
    // mapDocuments), not a bare snapshot and not an error page.
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const file = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      schemaVersion?: number;
      snapshot?: { drawings?: unknown };
      mapDocuments?: unknown;
    };
    expect(file.schemaVersion).toBe(1);
    expect(Array.isArray(file.mapDocuments)).toBe(true);
    expect(Array.isArray(file.snapshot?.drawings)).toBe(true);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
});
