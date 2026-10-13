// DM path 8: Backups and keeping your work (docs/website/video-scripts.md).
// A DM on a fresh private table with the battlemap, a live map in the Map library, two goblins and a
// seated player (filmed beside the DM while a restore lands). The browser's own confirm and tooltip
// never reach a page recording, so the capture logs their text for the edit's popups.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-8
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { closeTopWindow, selectDMTab, setStagingZone } from "../../../apps/e2e/docs-shots.helpers";
import { openOwnCharacterSettings } from "../../../apps/e2e/party.helpers";
import { enterDMMode } from "../../../apps/e2e/table-role.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, hover, rest } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-8-backups-and-keeping-your-work";
const OUT = path.resolve(here, "..", "footage", LESSON);
const FILES = path.join(OUT, "files");
const TAIL = 2.0;

test("record: DM path 8", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const dmContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, acceptDownloads: true });
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  for (const c of [dmContext, playerContext]) {
    await addCursor(c);
    c.setDefaultTimeout(30_000);
  }
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();

  type Ctx = { cue: (phrase: string, offset?: number, nth?: number) => number; recs: Record<string, Recording> };
  async function chapter(n: number, pages: Record<string, Page>, run: (c: Ctx) => Promise<void>) {
    const { cue, duration } = chapters(n);
    const clock = new Clock(`ch${n}`);
    const recs = Object.fromEntries(Object.entries(pages).map(([who, page]) => [who, new Recording(page, path.join(OUT, `ch${n}`, who), clock)]));
    for (const rec of Object.values(recs)) await rec.start();
    await run({ cue, recs });
    await clock.at(Math.max(duration, clock.now()) + TAIL, Object.values(pages)[0]!);
    for (const rec of Object.values(recs)) await rec.stop(clock.now());
  }
  const send = (message: unknown) => dm.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);
  const npcCount = (page: Page) => page.evaluate(() => (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter((c) => c.type === "npc").length);
  const backups = () => dm.getByRole("region", { name: "Backups" });

  try {
    await mkdir(FILES, { recursive: true });
    const wrongKind = path.join(FILES, "the-crypt-map.json");
    await writeFile(wrongKind, JSON.stringify({ schemaVersion: 1, id: "map-1", name: "The crypt", layers: [], elements: [] }));

    // --- Off camera: the table, its map, a live map, two goblins, a drawing, a player.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Campaign Night");
    await dm.getByLabel("New table password", { exact: true }).fill("campaign-night");
    await dm.getByLabel("New DM password", { exact: true }).fill("campaign-night-dm");
    await dm.getByRole("button", { name: "Create private table", exact: true }).click();
    await expect(dm.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
    await enterDMMode(dm, "campaign-night-dm");
    const dismiss = dm.getByRole("region", { name: "Next steps for the host" }).getByRole("button", { name: "Dismiss next steps", exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await dm.getByRole("button", { name: /DM MENU/i }).click();
    await dm.getByRole("button", { name: "Maps", exact: true }).click();
    const chooser = dm.waitForEvent("filechooser");
    await dm.getByRole("region", { name: "Current table map" }).getByRole("button", { name: "⬆ Upload image" }).click();
    await (await chooser).setFiles(path.join(here, "assets", "battlemap.png"));
    await expect(dm.getByText(/On table:/)).not.toContainText("no map yet", { timeout: 20_000 });
    await setStagingZone(dm, { x: 9, y: 7, w: 2, h: 2 });
    await closeTopWindow(dm);
    await dm.getByTitle("Author the live map on the table").click();
    await dm.getByRole("button", { name: /START LIVE MAP/i }).click();
    await expect(dm.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
    await dm.getByRole("button", { name: "Done building" }).click();
    for (const name of ["Goblin 1", "Goblin 2"]) await send({ t: "create-npc", name, hp: 7, maxHp: 7 });
    await expect.poll(() => npcCount(dm)).toBe(2);
    await send({ t: "draw", drawing: { id: "dm8-line", type: "freehand", points: [{ x: 420, y: 300 }, { x: 560, y: 360 }, { x: 700, y: 320 }], color: "#ff0000", width: 4, opacity: 1 } });
    await player.goto(dm.url().replace(/^https?:\/\/[^/]+/, ""));
    await player.getByPlaceholder("Table password").fill("campaign-night");
    await player.getByRole("button", { name: /Enter Table/i }).click();
    await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await rest(dm);

    // 1. Three kinds of file
    await chapter(1, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("It's in the DM menu", 0.2) });
      await click(rec, dm.getByRole("button", { name: "Table", exact: true }), "Table", { at: cue("under Table", 0.1) });
      await focus(rec, backups(), "Backups", { at: cue("under Table", 0.8) });
      await closeTopWindow(dm);
      const settings = await openOwnCharacterSettings(dm);
      const save = settings.getByRole("button", { name: "Save character" });
      await save.scrollIntoViewIfNeeded();
      await focus(rec, save, "Save character", { at: cue("that character's settings") });
      await closeTopWindow(dm);
      await selectDMTab(dm, "Maps");
      const imp = dm.getByRole("button", { name: "Import editable map (.json)" });
      await imp.scrollIntoViewIfNeeded();
      await focus(rec, imp, "editable map", { at: cue("in the Map Library") });
      await rest(dm);
    });

    // 2. Download a table backup
    await chapter(2, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await dm.getByRole("button", { name: "Table", exact: true }).click();
      const download = backups().getByRole("button", { name: "Download table backup" });
      await download.scrollIntoViewIfNeeded();
      const saved = dm.waitForEvent("download");
      await click(rec, download, "Download table backup", { at: cue("Download Table Backup saves", 0.3) });
      const file = await saved;
      const backup = path.join(FILES, file.suggestedFilename());
      await file.saveAs(backup);
      console.log("BACKUP FILE", file.suggestedFilename());
      const toast = dm.getByText(/a restore accepts/).first();
      await expect(toast).toBeVisible();
      console.log("BACKUP TOAST", await toast.textContent());
      await focus(rec, toast, "toast", { at: cue("as one file") });
      rec.mark("note", "secrets", { at: cue("It still holds") });
      await rest(dm);
    });

    // Off camera: the table changes after the backup (a third goblin, the drawing gone).
    await send({ t: "create-npc", name: "Goblin 3", hp: 7, maxHp: 7 });
    await expect.poll(() => npcCount(player)).toBe(3);
    const backupFile = path.join(FILES, (await import("node:fs")).readdirSync(FILES).find((f) => f !== "the-crypt-map.json")!);

    // 3. Restore one
    await chapter(3, { dm, player }, async ({ cue, recs: { dm: rec } }) => {
      const restore = backups().getByRole("button", { name: "Restore table backup…" });
      await restore.scrollIntoViewIfNeeded();
      dm.once("dialog", (dialog) => {
        console.log("RESTORE CONFIRM", JSON.stringify(dialog.message()));
        rec.mark("note", "confirm");
        setTimeout(() => void dialog.accept(), 3200);
      });
      const picker = dm.waitForEvent("filechooser");
      await click(rec, restore, "Restore table backup", { at: cue("Restore Table Backup replaces", 0.3) });
      await (await picker).setFiles(backupFile);
      await expect.poll(() => npcCount(player), { timeout: 20_000 }).toBe(2);
      rec.mark("note", "restored", { at: cue("become the files") });
      const wrong = dm.waitForEvent("filechooser");
      await click(rec, restore, "Restore table backup", { at: cue("Hand it the wrong kind", 0.2) });
      await (await wrong).setFiles(wrongKind);
      const refusal = dm.getByText(/That is an editable map, not a table backup/).first();
      await expect(refusal).toBeVisible();
      await focus(rec, refusal, "refusal", { at: cue("by name") });
      rec.mark("note", "too big", { at: cue("If the table would end up") });
      await rest(dm);
    });

    // 4. How big a campaign can get
    await chapter(4, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "Maps", exact: true }), "Maps", { at: cue("A backup has to restore", 0.6) });
      const line = dm.getByText("Room for more maps.").first();
      await line.scrollIntoViewIfNeeded();
      console.log("WEIGHT TOOLTIP", await line.getAttribute("title"));
      await focus(rec, line, "Room for more maps", { at: cue("The line beside the map list") });
      await hover(rec, line, "tooltip", { at: cue("Its tooltip") });
      rec.mark("note", "delete", { at: cue("Delete a map") });
      await rest(dm);
    });

    // 5. Habits that save campaigns
    await chapter(5, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await dm.getByRole("button", { name: "Table", exact: true }).click();
      const name = backups().getByLabel("Backup file name");
      await name.scrollIntoViewIfNeeded();
      console.log("BACKUP NAME", await name.inputValue());
      await focus(rec, name, "file name", { at: cue("The file name already") });
      await focus(rec, backups().getByRole("button", { name: "Download table backup" }), "Download", { at: cue("Download one before") });
      rec.mark("note", "free hosting", { at: cue("On free hosting") });
      rec.mark("note", "main hall", { at: cue("Building on the main hall") });
      await rest(dm);
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
