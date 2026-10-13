// A table backup keeps uploaded art the table has already SHOWN. The map background is drawn
// from a plain image request (no Origin header), so the browser caches the asset reply without
// CORS headers, and that reply is immutable for a year. The backup then reads the same URL
// cross-origin; served from that cache, the read failed CORS and the image was dropped, with
// only a warning toast to say so. Found while filming the backups lesson (2026-10-12).
import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import { selectDMTab } from "./docs-shots.helpers";
import { DM_PASSWORD, createTable, dismissNextSteps, enterDMMode } from "./table-role.helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("a table backup includes a map image the table has already displayed", async ({
  page: dm,
}, testInfo) => {
  test.setTimeout(90_000);
  await createTable(dm, "backup-cached-image");
  await enterDMMode(dm, DM_PASSWORD);
  await dismissNextSteps(dm);

  await selectDMTab(dm, "Maps");
  const chooser = dm.waitForEvent("filechooser");
  await dm
    .getByRole("region", { name: "Current table map" })
    .getByRole("button", { name: "⬆ Upload image" })
    .click();
  await (await chooser).setFiles({ name: "floor.png", mimeType: "image/png", buffer: PNG });
  await expect(dm.getByText(/On table:/)).not.toContainText("no map yet", { timeout: 20_000 });
  // The table has drawn it: the browser has finished (and cached) its own request for the
  // UPLOAD, by its content hash. A bare "/assets/" also matched the app's own bundle
  // (vite serves /assets/index-*.js), which made this wait pass before the image loaded.
  await expect
    .poll(() =>
      dm.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some(
            (entry) =>
              /\/assets\/[a-f0-9]{64}(?:[?#]|$)/.test(entry.name) &&
              (entry as PerformanceResourceTiming).responseEnd > 0,
          ),
      ),
    )
    .toBe(true);

  await selectDMTab(dm, "Table");
  const backups = dm.getByRole("region", { name: "Backups" });
  const [download] = await Promise.all([
    dm.waitForEvent("download"),
    backups.getByRole("button", { name: "Download table backup" }).click(),
  ]);
  const saved = testInfo.outputPath("backup.json");
  await download.saveAs(saved);
  await expect(dm.getByText(/1 image included/)).toBeVisible();
  await expect(dm.getByText(/could not be saved/)).toHaveCount(0);
  const file = JSON.parse(await readFile(saved, "utf8")) as { assets?: { hash: string }[] };
  expect(file.assets ?? []).toHaveLength(1);
});
