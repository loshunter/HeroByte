// DM path 5: Walls, doors and fog (docs/website/video-scripts.md).
// A DM on a fresh private table; off camera a room is built with the player's staging zone inside
// its west half, then a player joins (filmed beside the DM from chapter 2). Both cameras frame the
// same world, so one world point maps to the same place on both screens.
//
// World plan (px, 50 px grid): a long room (150,100)-(1050,450), so a 30 ft radius visibly falls
// short of its far end; a dividing wall on x=500 in three segments, with door gaps at y 200-250
// (door 1) and y 350-400 (door 2). The player spawns at (425,275), in the west part.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-5
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { setStagingZone, closeTopWindow } from "../../../apps/e2e/docs-shots.helpers";
import { enterDMMode } from "../../../apps/e2e/table-role.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, glide, key, rest, select } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-5-walls-doors-and-fog";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TAIL = 2.0;
type Pt = { x: number; y: number };
type When = { at?: number; ms?: number };
type ToScreen = (w: Pt) => Pt;

const FRAME = { world: { x: 600, y: 275 }, scale: 1.05, xf: 0.565, yf: 0.47 };
const DOOR1 = { a: { x: 500, y: 200 }, b: { x: 500, y: 250 } };
const DOOR2 = { a: { x: 500, y: 350 }, b: { x: 500, y: 400 } };
const mid = (d: { a: Pt; b: Pt }) => ({ x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 });

/** Frame FRAME.world at (xf, yf) of the canvas; returns a world->screen mapper. */
async function frame(page: Page): Promise<ToScreen> {
  const cam = await page.evaluate((f) => {
    const data = window.__HERO_BYTE_E2E__!;
    const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
    const next = { x: board.width * f.xf - f.world.x * f.scale, y: board.height * f.yf - f.world.y * f.scale, scale: f.scale };
    data.setCam!(next);
    return { ...next, left: board.left, top: board.top };
  }, FRAME);
  return (w: Pt) => ({ x: cam.left + cam.x + w.x * cam.scale, y: cam.top + cam.y + w.y * cam.scale });
}

async function clickAt(rec: Recording, to: Pt, label: string, when: When & { alt?: boolean } = {}) {
  const ms = when.ms ?? 450;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000, rec.page);
  await glide(rec.page, to, ms);
  rec.mark("click", label, { box: { x: to.x - 40, y: to.y - 40, width: 80, height: 80 }, at: when.at });
  if (when.alt) await rec.page.keyboard.down("Alt");
  await rec.page.mouse.click(to.x, to.y, { delay: 70 });
  if (when.alt) await rec.page.keyboard.up("Alt");
}

async function dragTo(rec: Recording, from: Pt, to: Pt, label: string, when: When = {}) {
  const ms = when.ms ?? 900;
  if (when.at !== undefined) await rec.clock.at(when.at - 0.4, rec.page);
  await glide(rec.page, from, 350);
  rec.mark("drag", label, { box: { x: from.x - 30, y: from.y - 30, width: 60, height: 60 } });
  await rec.page.mouse.down();
  await rec.page.waitForTimeout(120);
  await glide(rec.page, to, ms);
  await rec.page.waitForTimeout(80);
  await rec.page.mouse.up();
  rec.mark("drop", label, { box: { x: Math.min(from.x, to.x) - 30, y: Math.min(from.y, to.y) - 30, width: Math.abs(to.x - from.x) + 60, height: Math.abs(to.y - from.y) + 60 } });
}

/** Off-camera drag: no marks. */
async function quietDrag(page: Page, from: Pt, to: Pt) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

const settled = async (page: Page) => {
  await expect(page.getByText("saving…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/Painting terrain/)).toBeHidden({ timeout: 30_000 });
};

test("record: DM path 5", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const dmContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  for (const c of [dmContext, playerContext]) {
    await addCursor(c);
    c.setDefaultTimeout(30_000);
  }
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();
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
  const buildMap = () => dm.getByRole("button", { name: "🏗️ Build map" });
  const doors = () => dm.evaluate(() => (window.__HERO_BYTE_E2E__!.snapshot!.compiledScene?.doors ?? []).map((d) => ({ id: d.id, x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2, state: d.state })));
  const dmSend = (message: unknown) => dm.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);

  try {
    // --- Off camera: the table, a staging zone inside the west half, the room, the player.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Fog Night");
    await dm.getByLabel("New table password", { exact: true }).fill("fog-night");
    await dm.getByLabel("New DM password", { exact: true }).fill("fog-night-dm");
    await dm.getByRole("button", { name: "Create private table", exact: true }).click();
    await expect(dm.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
    await enterDMMode(dm, "fog-night-dm");
    const dismiss = dm.getByRole("region", { name: "Next steps for the host" }).getByRole("button", { name: "Dismiss next steps", exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await setStagingZone(dm, { x: 8, y: 5, w: 1, h: 1 });
    await closeTopWindow(dm);
    await buildMap().click();
    await dm.getByRole("button", { name: /START LIVE MAP/i }).click();
    await expect(dm.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
    const at = await frame(dm);
    await dm.getByRole("button", { name: "Room", exact: true }).click();
    await dm.getByRole("searchbox", { name: "Search brushes" }).fill("flag");
    await dm.getByRole("button", { name: "Flagstone Floor", exact: true }).click();
    await dm.getByRole("button", { name: "Stone", exact: true }).click();
    await quietDrag(dm, at({ x: 150, y: 100 }), at({ x: 1050, y: 450 }));
    await dm.waitForFunction(() => (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0) > 0, undefined, { timeout: 20_000 });
    await settled(dm);
    await player.goto(dm.url().replace(/^https?:\/\/[^/]+/, ""));
    await player.getByPlaceholder("Table password").fill("fog-night");
    await player.getByRole("button", { name: /Enter Table/i }).click();
    await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await player.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene), undefined, { timeout: 20_000 });
    const pat = await frame(player);
    await frame(dm);
    await rest(dm);

    // 1. Walls
    await chapter(1, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "Wall", exact: true }), "Wall", { at: cue("Wall draws one", 0.2) });
      await dragTo(rec, at({ x: 500, y: 100 }), at(DOOR1.a), "wall", { at: cue("Drag from point to point") });
      rec.mark("note", "never see walls", { at: cue("Players never see walls") });
      await focus(rec, dm.getByRole("button", { name: "📐 Pin walls overlay" }), "Pin walls overlay", { at: cue("Pinwall's", -0.3) });
      await rest(dm);
    });

    // 2. Doors
    await chapter(2, { dm, player }, async ({ cue, recs: { dm: rec, player: prec } }) => {
      await dragTo(rec, at(DOOR1.b), at(DOOR2.a), "wall", { at: cue("leave a gap", -0.2) });
      await click(rec, dm.getByRole("button", { name: "Door", exact: true }), "Door", { at: cue("then drag the door", -0.3), ms: 300 });
      await dragTo(rec, at(DOOR1.a), at(DOOR1.b), "door", { at: cue("across the gap"), ms: 700 });
      await dm.waitForFunction(() => (window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.length ?? 0) > 0, undefined, { timeout: 20_000 });
      rec.mark("note", "closed", { at: cue("Doors start closed") });
      await click(rec, dm.getByRole("button", { name: "Done building" }), "Done building", { at: cue("At the table", -0.2), ms: 300 });
      await clickAt(prec, pat(mid(DOOR1)), "door", { at: cue("open or close it", -0.2) });
      await rest(player);
    });

    // Off camera: the third wall segment and a second door, then back to Select.
    const shut = pat(mid(DOOR1));
    await player.mouse.click(shut.x, shut.y);
    await buildMap().click();
    await dm.getByRole("button", { name: "Wall", exact: true }).click();
    await quietDrag(dm, at(DOOR2.b), at({ x: 500, y: 450 }));
    await settled(dm);
    await dm.getByRole("button", { name: "Door", exact: true }).click();
    await quietDrag(dm, at(DOOR2.a), at(DOOR2.b));
    await expect.poll(async () => (await doors()).length).toBe(2);
    await settled(dm);
    await expect.poll(async () => (await doors()).every((d) => d.state === "closed")).toBe(true);

    // 3. Locked and secret
    await chapter(3, { dm, player }, async ({ cue, recs: { dm: rec, player: prec } }) => {
      await click(rec, dm.getByRole("button", { name: "👆 Select" }), "Select", { at: cue("pick it with Select", 0.2), ms: 300 });
      await clickAt(rec, at(mid(DOOR1)), "door 1", { ms: 350 });
      await click(rec, dm.getByRole("button", { name: "🔍 Inspect" }), "Inspect", { at: cue("open Inspect", 0.2), ms: 300 });
      await select(rec, dm.getByRole("combobox", { name: "Door state" }), "Door state", "locked", { at: cue("Choose its state", 0.2) });
      await click(rec, dm.getByRole("button", { name: "Save changes" }), "Save changes", { at: cue("Save changes", 0.1), ms: 300 });
      await focus(rec, dm.getByRole("combobox", { name: "Door state" }), "states", { at: cue("Closed, Open") });
      const d1 = pat(mid(DOOR1));
      prec.mark("focus", "gold lock", { box: { x: d1.x - 60, y: d1.y - 60, width: 120, height: 120 }, at: cue("small gold lock") });
      await clickAt(prec, d1, "locked door", { at: cue("Clicking it does nothing", 0.4) });
      // Door 2 goes secret while Wren says the DM can still open the locked one.
      await clickAt(rec, at(mid(DOOR2)), "door 2", { at: cue("You can still open it", 0.3), ms: 350 });
      await select(rec, dm.getByRole("combobox", { name: "Door state" }), "Door state", "secret", { ms: 250 });
      await click(rec, dm.getByRole("button", { name: "Save changes" }), "Save changes", { ms: 250 });
      const d2 = at(mid(DOOR2));
      rec.mark("focus", "dashed seam", { box: { x: d2.x - 70, y: d2.y - 70, width: 140, height: 140 }, at: cue("dashed seam") });
      await click(rec, dm.getByRole("button", { name: "Done building" }), "Done building", { at: cue("At the table", -0.3), ms: 300 });
      await clickAt(rec, d2, "Alt-click", { at: cue("reveal it", -0.6), alt: true });
      rec.mark("key", "Alt", { key: "Alt+click", at: cue("reveal it", -0.6) });
      await rest(dm);
    });

    // 4. Turn on fog
    await chapter(4, { dm, player }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("in the DM menu", 0.1) });
      await click(rec, dm.getByRole("button", { name: "Maps", exact: true }), "Maps", { at: cue("under Maps", 0.1) });
      const fog = dm.getByRole("button", { name: /FOG DISABLED/ });
      await fog.scrollIntoViewIfNeeded();
      await focus(rec, fog, "Fog of War", { at: cue("It needs a built map") });
      await click(rec, fog, "FOG", { at: cue("Players then see", -0.3) });
      await player.waitForFunction(() => window.__HERO_BYTE_E2E__?.snapshot?.fogEnabled === true, undefined, { timeout: 15_000 });
      rec.mark("note", "dm sees all", { at: cue("You still see everything") });
      await rest(dm);
    });

    // Off camera: door 1 opens, so the long east part shows how far a radius reaches.
    const door1 = (await doors()).find((d) => d.y < 260)!;
    await dmSend({ t: "set-door-state", doorId: door1.id, state: "open" });
    await player.waitForTimeout(1500);

    // 5. Make it dark
    await chapter(5, { dm, player }, async ({ cue, recs: { dm: rec } }) => {
      const def = dm.getByLabel("Default sight radius in feet");
      await def.scrollIntoViewIfNeeded();
      await focus(rec, def, "Table Sight Default", { at: cue("Table Sight Default") });
      await click(rec, def.locator("xpath=ancestor::*[.//button[normalize-space()='30 ft']][1]").getByRole("button", { name: "30 ft", exact: true }), "30 ft", { at: cue("Set 30 feet", 0.2) });
      await closeTopWindow(dm);
      await click(rec, dm.getByRole("button", { name: "Player 2: details" }), "Player 2", { at: cue("A single token", 0.1), ms: 350 });
      await click(rec, dm.getByTitle("Open player settings", { exact: true }).first(), "⚙", { at: cue("token settings", -0.2), ms: 350 });
      const own = dm.getByLabel("Sight radius in feet");
      await own.scrollIntoViewIfNeeded();
      await focus(rec, own, "Sight Radius", { at: cue("30, 60 or 120", -0.3) });
      await click(rec, own.locator("xpath=ancestor::*[.//button[normalize-space()='120 ft']][1]").getByRole("button", { name: "120 ft", exact: true }), "120 ft", { at: cue("120 feet", 0.1) });
      rec.mark("note", "token wins", { at: cue("A token you set yourself") });
      await rest(dm);
    });

    // 6. Check it
    await closeTopWindow(dm);
    await closeTopWindow(dm);
    await chapter(6, { dm, player }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "👁 Player View" }), "Player View", { at: cue("Player view shows", 0.2) });
      await rest(dm);
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
