// U9 — backups say what they are before a file is chosen, and each picker says so
// when it is handed the wrong kind: a character file is one character; a table
// backup is the whole table; an editable map is one map. Real downloads, real
// files on disk, real pickers, in a disposable private table.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import { selectDMTab } from "./docs-shots.helpers";
import { openOwnCharacterSettings } from "./party.helpers";
import {
  DM_PASSWORD,
  createTable,
  dismissNextSteps,
  enterDMMode,
  joinWithLink,
  ownRecord,
  viewerIsDM,
} from "./table-role.helpers";
import { observeWire } from "./u2-cancel.helpers";
import { send } from "./u7-party.helpers";

// Observe-only reads of the dev seam.
const npcCount = (page: Page) =>
  page.evaluate(
    () =>
      (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter((c) => c.type === "npc").length,
  );
const drawingIds = (page: Page) =>
  page.evaluate(() => (window.__HERO_BYTE_E2E__?.snapshot?.drawings ?? []).map((d) => d.id).sort());
const seatIds = (page: Page) =>
  page.evaluate(() => (window.__HERO_BYTE_E2E__?.snapshot?.players ?? []).map((p) => p.uid).sort());

/** Files of each kind HeroByte knows, as the wrong-kind pickers must recognise them. */
async function writeKinds(dir: string) {
  await mkdir(dir, { recursive: true });
  const files = {
    character: path.join(dir, "a-character.json"),
    map: path.join(dir, "a-map.json"),
    table: path.join(dir, "a-table.json"),
  };
  await writeFile(files.character, JSON.stringify({ name: "Aria", hp: 9, maxHp: 9 }));
  await writeFile(
    files.map,
    JSON.stringify({ schemaVersion: 1, id: "map-1", name: "A map", layers: [], elements: [] }),
  );
  await writeFile(files.table, JSON.stringify({ schemaVersion: 1, snapshot: { players: [] } }));
  return files;
}

test.describe("U9 — table backup (the whole table)", () => {
  test.describe.configure({ timeout: 90_000 });

  test("downloads, restores after a change, cancels cleanly, and refuses a character or a map file by name", async ({
    page: dm,
    browser,
  }, testInfo) => {
    const wire = observeWire(dm);
    const playerContext = await browser.newContext();
    try {
      const player = await playerContext.newPage();
      const roomUrl = await createTable(dm, "u9-backups");
      await enterDMMode(dm, DM_PASSWORD);
      await dismissNextSteps(dm);
      await joinWithLink(player, roomUrl);
      const kinds = await writeKinds(testInfo.outputPath("kinds"));
      const loads = () => wire.sent.filter((frame) => frame.t === "load-session").length;

      // A drawing on the table when the backup is taken: a restore must bring it back
      // (the loader once dropped every drawing whenever the file had scene objects).
      await send(dm, {
        t: "draw",
        drawing: {
          id: "u9-line",
          type: "freehand",
          points: [
            { x: 40, y: 40 },
            { x: 140, y: 90 },
          ],
          color: "#ff0000",
          width: 3,
          opacity: 1,
        },
      });
      await expect.poll(() => drawingIds(player)).toEqual(["u9-line"]);

      await selectDMTab(dm, "Table");
      const backups = dm.getByRole("region", { name: "Backups" });
      // The scope is stated BEFORE anything is chosen.
      await expect(backups).toContainText("Table backup — the whole table");
      await expect(backups).toContainText(/Save character|Export editable map/);

      // Download: a real file, and a toast that says its weight.
      const [download] = await Promise.all([
        dm.waitForEvent("download"),
        backups.getByRole("button", { name: "Download table backup" }).click(),
      ]);
      const backup = testInfo.outputPath("backup.json");
      await download.saveAs(backup);
      expect(download.suggestedFilename()).toMatch(/\.json$/);
      await expect(dm.getByText(/a restore accepts/)).toBeVisible();

      // Change the table after the backup was taken.
      await send(dm, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7 });
      await expect.poll(() => npcCount(dm)).toBe(1);
      const chooser = backups.getByLabel("Choose a table backup file to restore");
      const seats = await seatIds(dm);

      // Wrong kinds are named and refused before anything is asked or sent.
      let asked = false;
      dm.on("dialog", (dialog) => {
        asked = true;
        void dialog.dismiss();
      });
      await chooser.setInputFiles(kinds.character);
      await expect(dm.getByText(/That is a character file, not a table backup/)).toBeVisible();
      await chooser.setInputFiles(kinds.map);
      await expect(dm.getByText(/That is an editable map, not a table backup/)).toBeVisible();
      expect(asked).toBe(false);
      expect(loads()).toBe(0);
      expect(await npcCount(dm)).toBe(1);
      dm.removeAllListeners("dialog");

      // Cancelled: the confirm names the backup; saying no changes nothing.
      const confirmText: string[] = [];
      dm.once("dialog", (dialog) => {
        confirmText.push(dialog.message());
        void dialog.dismiss();
      });
      await chooser.setInputFiles(backup);
      await expect(dm.getByText("Restore cancelled. The table has not changed.")).toBeVisible();
      expect(confirmText[0]).toContain("Restore table backup");
      expect(loads()).toBe(0);
      expect(await npcCount(dm)).toBe(1);

      // Valid: confirmed, the table goes back to the backup; everyone stays seated.
      dm.once("dialog", (dialog) => void dialog.accept());
      await chooser.setInputFiles(backup);
      await expect(dm.getByText(/Table backup ".*" restored\./)).toBeVisible();
      await expect.poll(() => npcCount(dm)).toBe(0);
      await expect.poll(() => npcCount(player)).toBe(0);
      await expect.poll(() => drawingIds(dm)).toEqual(["u9-line"]);
      await expect.poll(() => drawingIds(player)).toEqual(["u9-line"]);
      expect(loads()).toBe(1);
      expect(await seatIds(dm)).toEqual(seats);
      expect(await viewerIsDM(dm)).toBe(true);
    } finally {
      await playerContext.close();
    }
  });

  test("the editable-map picker names a table backup and a character file too", async ({
    page: dm,
  }, testInfo) => {
    await createTable(dm, "u9-map-import");
    await enterDMMode(dm, DM_PASSWORD);
    await dismissNextSteps(dm);
    const kinds = await writeKinds(testInfo.outputPath("kinds"));

    await selectDMTab(dm, "Maps");
    const importButton = dm.getByRole("button", { name: "Import editable map (.json)" });
    await importButton.scrollIntoViewIfNeeded();
    const chooser = importButton.locator("xpath=following-sibling::input[@type='file']");
    await chooser.setInputFiles(kinds.table);
    await expect(
      dm.getByText(/That is a table backup \(the whole table\), not an editable map/),
    ).toBeVisible();
    await chooser.setInputFiles(kinds.character);
    await expect(dm.getByText(/That is a character file, not an editable map/)).toBeVisible();
  });
});

test.describe("U9 — character file (one character and your drawings, never the table)", () => {
  test.describe.configure({ timeout: 90_000 });

  test("Save character, change, Load character; a table backup or a map is refused by name", async ({
    page: dm,
    browser,
  }, testInfo) => {
    const playerContext = await browser.newContext();
    try {
      const player = await playerContext.newPage();
      const roomUrl = await createTable(dm, "u9-character-file");
      await joinWithLink(player, roomUrl);
      const kinds = await writeKinds(testInfo.outputPath("kinds"));
      const mine = () => ownRecord(player);
      const original = await mine();

      const settings = await openOwnCharacterSettings(player);
      await expect(settings).toContainText("Character file");
      await expect(settings).toContainText("plus your own drawings");
      await expect(settings).toContainText("never saves or restores the table");
      const [download] = await Promise.all([
        player.waitForEvent("download"),
        settings.getByRole("button", { name: "Save character" }).click(),
      ]);
      const saved = testInfo.outputPath("hero.json");
      await download.saveAs(saved);
      expect(download.suggestedFilename()).toMatch(/character.*\.json$/);

      // Change the character, then load the file: the character is what was saved.
      const { id } = original!;
      await send(player, { t: "update-character-name", characterId: id, name: "Renamed Hero" });
      await send(player, { t: "update-character-hp", characterId: id, hp: 13, maxHp: 50 });
      await expect.poll(mine).toEqual({ id, name: "Renamed Hero", hp: 13, maxHp: 50 });
      const chooser = settings.getByLabel("Choose a character file to load");
      await chooser.setInputFiles(saved);
      await expect.poll(mine).toEqual(original);

      // Other kinds are named, and nothing is applied.
      const says: string[] = [];
      player.on("dialog", (dialog) => {
        says.push(dialog.message());
        void dialog.accept();
      });
      await chooser.setInputFiles(kinds.table);
      await expect.poll(() => says.length).toBe(1);
      expect(says[0]).toMatch(/table backup.*not a character file/);
      await chooser.setInputFiles(kinds.map);
      await expect.poll(() => says.length).toBe(2);
      expect(says[1]).toMatch(/editable map.*not a character file/);
      expect(await mine()).toEqual(original);
    } finally {
      await playerContext.close();
    }
  });
});
