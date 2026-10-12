// DM path 3: Three ways to get a map on the table (docs/website/video-scripts.md).
// One DM browser on a fresh private table: an uploaded battlemap (capture/assets/battlemap.png, a
// generated 1400x980 floor on a 70 px grid, so the alignment visibly changes the 50 px table grid),
// then a live map started over it, then a kicked-in tavern.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-3
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { enterDMMode } from "../../../apps/e2e/table-role.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, glide, key, rest, select, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-3-three-ways-to-get-a-map-on-the-table";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TAIL = 2.0;
type Pt = { x: number; y: number };

test("record: DM path 3", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  await addCursor(context);
  context.setDefaultTimeout(30_000);
  const dm = await context.newPage();
  dm.on("dialog", (d) => void d.accept());

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
  /** World px -> screen, with the camera framing the battlemap left of the DM window. */
  const frameMap = () =>
    dm.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
      const cam = { x: 40, y: 30, scale: 0.6 };
      data.setCam!(cam);
      return { left: board.left, top: board.top, ...cam };
    });
  const at = (f: { left: number; top: number; x: number; y: number; scale: number }, w: Pt) => ({ x: f.left + f.x + w.x * f.scale, y: f.top + f.y + w.y * f.scale });

  try {
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Map Night");
    await dm.getByLabel("New table password", { exact: true }).fill("map-night");
    await dm.getByLabel("New DM password", { exact: true }).fill("map-night-dm");
    await dm.getByRole("button", { name: "Create private table", exact: true }).click();
    await expect(dm.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
    await enterDMMode(dm, "map-night-dm");
    const dismiss = dm.getByRole("region", { name: "Next steps for the host" }).getByRole("button", { name: "Dismiss next steps", exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await rest(dm);

    // 1. Three ways
    await chapter(1, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await focus(rec, dm.getByRole("button", { name: "🏗️ Build map" }), "Build map", { at: cue("build it here") });
      rec.mark("note", "one rule", { at: cue("One rule") });
      await rest(dm);
    });

    // 2. A: bring your own art
    const maps = () => dm.getByRole("region", { name: "Current table map" });
    await chapter(2, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("Open the DM menu", 0.2) });
      await click(rec, dm.getByRole("button", { name: "Maps", exact: true }), "Maps", { at: cue("then Maps", 0.1) });
      await focus(rec, maps(), "Current table map", { at: cue("Everything we need") });
      const chooser = dm.waitForEvent("filechooser");
      await click(rec, maps().getByRole("button", { name: "⬆ Upload image" }), "UPLOAD IMAGE", { at: cue("upload your image", 0.2) });
      await (await chooser).setFiles(path.join(here, "assets", "battlemap.png"));
      await expect(dm.getByText(/On table:/)).not.toContainText("no map yet", { timeout: 20_000 });
      const f = await frameMap();
      rec.mark("focus", "battlemap", { box: { x: f.left + f.x, y: f.top + f.y, width: 1400 * f.scale, height: 980 * f.scale }, at: cue("stored with your table") });
      await focus(rec, maps().getByRole("textbox", { name: "Map Background URL" }), "paste a link", { at: cue("paste a link instead") });
      const advanced = dm.getByText(/Advanced: map position/).first();
      await click(rec, advanced, "Advanced", { at: cue("Open Advanced", 0.2) });
      const lock = dm.getByRole("button", { name: /MAP LOCKED/ });
      await focus(rec, lock, "MAP LOCKED", { at: cue("starts locked") });
      await click(rec, lock, "MAP LOCKED", { at: cue("Press Map Locked", 0.3) });
      await click(rec, dm.getByRole("button", { name: "Start Alignment" }), "START ALIGNMENT", { at: cue("press Start Alignment", 0.2) });
      // Two opposite corners of one printed square: image px (140,140) and (210,210).
      const f2 = await frameMap();
      const c1 = at(f2, { x: 140, y: 140 });
      const c2 = at(f2, { x: 210, y: 210 });
      await rec.clock.at(cue("Click two opposite", 0.3), dm);
      await glide(dm, c1, 450);
      rec.mark("click", "corner 1", { box: { x: c1.x - 30, y: c1.y - 30, width: 60, height: 60 } });
      await dm.mouse.click(c1.x, c1.y, { delay: 70 });
      await glide(dm, c2, 450);
      rec.mark("click", "corner 2", { box: { x: c2.x - 30, y: c2.y - 30, width: 60, height: 60 } });
      await dm.mouse.click(c2.x, c2.y, { delay: 70 });
      await click(rec, dm.getByRole("button", { name: "Apply Alignment" }), "APPLY ALIGNMENT", { at: cue("Press Apply Alignment", 0.3) });
      await focus(rec, maps().getByRole("slider", { name: "Square size" }), "Square Size", { at: cue("Set Square Size") });
      await click(rec, dm.getByRole("button", { name: /MAP UNLOCKED/ }), "MAP LOCKED again", { at: cue("lock the map again", 0.2) });
      await rest(dm);
    });

    // 3. B: build it here
    await dm.getByRole("button", { name: "Close Dungeon Master Tools" }).click();
    await chapter(3, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "🏗️ Build map" }), "Build map", { at: cue("Open build map", 0.2) });
      await click(rec, dm.getByRole("button", { name: /START LIVE MAP/i }), "START LIVE MAP", { at: cue("Start live map", 0.2) });
      await expect(dm.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
      await focus(rec, dm.getByText("● LIVE"), "LIVE", { at: cue("The live badge") });
      await rest(dm);
    });

    // 4. C: kick in a door
    await chapter(4, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await key(rec, "Escape", "Esc", { at: cue("Close the editor", 0.2) });
      const board = (await dm.locator(".konvajs-content").boundingBox())!;
      const spot = { x: board.x + board.width * 0.78, y: board.y + board.height * 0.5 };
      await glide(dm, spot, 400);
      rec.mark("click", "map", { box: { x: spot.x - 30, y: spot.y - 30, width: 60, height: 60 }, at: cue("click the map", 0.2) });
      await dm.mouse.click(spot.x, spot.y);
      await key(rec, "g", "G", { at: cue("press G", 0.1) });
      const panel = dm.getByRole("dialog", { name: "Kick in a door" });
      await expect(panel).toBeVisible({ timeout: 15_000 });
      await focus(rec, panel.getByLabel("Name"), "name", { at: cue("name already filled in", -0.4) });
      await type(rec, panel.getByLabel("Name"), "Name", "The Rusty Anchor", { at: cue("Type a better one", 0.2), delay: 45 });
      await select(rec, panel.getByLabel("Recipe"), "Recipe", "building", { at: cue("Pick the recipe", 0.2) });
      await select(rec, panel.getByLabel("Kind"), "Kind", "tavern", { at: cue("a tavern", 0.1) });
      await select(rec, panel.getByLabel("Size"), "Size", "small", { at: cue("Pick a size", 0.1) });
      await focus(rec, dm.getByRole("button", { name: "🚪 Generate & enter" }), "Generate & enter", { at: cue("Reroll only", -0.6) });
      await click(rec, dm.getByRole("button", { name: "🚪 Generate & enter" }), "GENERATE & ENTER", { at: cue("Seconds later", -0.8) });
      await dm.waitForFunction(() => {
        const data = window.__HERO_BYTE_E2E__;
        const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
        return node?.name === "The Rusty Anchor";
      }, undefined, { timeout: 40_000 });
      rec.mark("note", "arrived", { at: cue("somewhere new") });
      await rest(dm);
    });

    // 5. Mixing them
    await chapter(5, { dm }, async ({ cue, recs: { dm: rec } }) => {
      rec.mark("note", "fog on art", { at: cue("Want fog on your own art") });
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("Every map can join", -0.4), ms: 350 });
      await click(rec, dm.getByRole("button", { name: "World", exact: true }), "World", { at: cue("World tab", -0.3), ms: 350 });
      await rest(dm);
    });
  } finally {
    await context.close();
  }
});
