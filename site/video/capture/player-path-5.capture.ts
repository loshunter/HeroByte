// Player path 5: Draw, measure and ping (docs/website/video-scripts.md).
// A DM's table off camera (a generated tavern, fog off). The player's computer for chapters 1-5,
// a phone (a second player) for chapter 6.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts player-path-5
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, centreOwnToken, click, focus, glide, key, rest, tap } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "player-path-5-draw-measure-and-ping";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TABLE_PASSWORD = "draw-night";
const DM_PASSWORD = "draw-night-dm";
const TAIL = 2.0;
const PHONE = { width: 390, height: 844 };
type Pt = { x: number; y: number };
type When = { at?: number; ms?: number };

/** A mouse stroke through `points` (real input: Konva hears it), its release landing at `at`. */
async function stroke(rec: Recording, points: Pt[], label: string, when: When = {}) {
  const ms = when.ms ?? 900;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000 - 0.4, rec.page);
  await glide(rec.page, points[0]!, 350);
  rec.mark("drag", label, { box: { x: points[0]!.x - 30, y: points[0]!.y - 30, width: 60, height: 60 } });
  await rec.page.mouse.down();
  const per = ms / Math.max(1, points.length - 1);
  for (const pt of points.slice(1)) await glide(rec.page, pt, per);
  await rec.page.waitForTimeout(80);
  await rec.page.mouse.up();
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const box = { x: Math.min(...xs) - 30, y: Math.min(...ys) - 30, width: Math.max(...xs) - Math.min(...xs) + 60, height: Math.max(...ys) - Math.min(...ys) + 60 };
  rec.mark("drop", label, { box, at: when.at });
}

/** A mouse click at a map point (no locator), landing at `at`. */
async function clickAt(rec: Recording, to: Pt, label: string, when: When & { double?: boolean } = {}) {
  const ms = when.ms ?? 450;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000, rec.page);
  await glide(rec.page, to, ms);
  rec.mark("click", label, { box: { x: to.x - 30, y: to.y - 30, width: 60, height: 60 }, at: when.at });
  if (when.double) await rec.page.mouse.dblclick(to.x, to.y, { delay: 60 });
  else await rec.page.mouse.click(to.x, to.y, { delay: 70 });
}

/** A one-finger drag on a touch page, through CDP (Playwright's touchscreen only taps). */
async function touchDrag(rec: Recording, points: Pt[], label: string, when: When = {}) {
  const ms = when.ms ?? 800;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000, rec.page);
  const cdp = await rec.page.context().newCDPSession(rec.page);
  const send = (type: string, pt?: Pt) =>
    cdp.send("Input.dispatchTouchEvent", { type: type as "touchStart", touchPoints: pt ? [{ x: pt.x, y: pt.y }] : [] });
  rec.mark("drag", label, { box: { x: points[0]!.x - 30, y: points[0]!.y - 30, width: 60, height: 60 } });
  await send("touchStart", points[0]);
  const steps = 18;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (let s = 1; s <= steps; s += 1) {
      await send("touchMove", { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
      await rec.page.waitForTimeout(ms / steps / (points.length - 1));
    }
  }
  await send("touchEnd");
  await cdp.detach();
  const last = points[points.length - 1]!;
  rec.mark("drop", label, { box: { x: last.x - 30, y: last.y - 30, width: 60, height: 60 }, at: when.at });
}

test("record: Player path 5", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const dmContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const dm = await dmContext.newPage();
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  await addCursor(playerContext);
  const player = await playerContext.newPage();
  const phoneContext = await browser.newContext({ viewport: PHONE, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  await addCursor(phoneContext, true);
  const phone = await phoneContext.newPage();
  for (const c of [dmContext, playerContext, phoneContext]) c.setDefaultTimeout(30_000);
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

  try {
    // --- Off camera: the DM makes the table and kicks in a small tavern; fog off.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Draw Night");
    await dm.getByLabel("New table password", { exact: true }).fill(TABLE_PASSWORD);
    await dm.getByLabel("New DM password", { exact: true }).fill(DM_PASSWORD);
    await dm.getByRole("button", { name: "Create private table", exact: true }).click();
    const card = dm.getByRole("region", { name: "Next steps for the host" });
    await card.getByRole("button", { name: "Enter DM mode", exact: true }).click();
    await dm.locator("input[type='password']:visible").first().fill(DM_PASSWORD);
    await dm.getByRole("dialog", { name: "Enter DM mode" }).getByRole("button", { name: "Enter DM mode", exact: true }).click();
    await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: "Dismiss next steps", exact: true }).click();
    await dm.getByTitle("Author the live map on the table").click();
    await dm.getByRole("button", { name: /START LIVE MAP/i }).click();
    await expect(dm.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
    await dm.keyboard.press("Escape");
    const board = (await dm.locator(".konvajs-content").boundingBox())!;
    await dm.mouse.click(board.x + board.width * 0.8, board.y + board.height * 0.45);
    await dm.keyboard.press("g");
    const panel = dm.getByRole("dialog", { name: "Kick in a door" });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await panel.getByLabel("Recipe").selectOption("building");
    await panel.getByLabel("Kind").selectOption("tavern");
    await panel.getByLabel("Size").selectOption("medium");
    await panel.getByLabel("Name").fill("The Chalk Line");
    await dm.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await dm.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Chalk Line";
    }, undefined, { timeout: 40_000 });
    await dm.evaluate(() => window.__HERO_BYTE_E2E__!.sendMessage!({ t: "set-fog-enabled", enabled: false }));
    const link = dm.url().replace(/^https?:\/\/[^/]+/, "");

    await player.goto(link);
    await player.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
    await player.getByRole("button", { name: /Enter Table/i }).click();
    await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await player.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.characters?.some((c) => c.ownedByPlayerUID === window.__HERO_BYTE_E2E__?.uid)), undefined, { timeout: 20_000 });
    await player.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      const own = data.snapshot!.characters.find((c) => c.ownedByPlayerUID === data.uid)!;
      data.sendMessage!({ t: "update-character-name", characterId: own.id, name: "Kael the Quick" });
    });
    await player.waitForTimeout(800);
    const home = await centreOwnToken(player, 1.2);
    await rest(player);
    const tools = player.getByRole("group", { name: "Play tools" });
    // The desktop toolbox: a window of three regions; its buttons carry an emoji before the name.
    const box = player.getByRole("region", { name: "Drawing tool" }).locator("..");
    const tool = (name: string) => player.getByRole("button", { name: new RegExp(`${name}$`) });
    const c = home.cell;
    const A = (dx: number, dy: number) => ({ x: home.x + dx * c, y: home.y + dy * c });

    // 1. Draw
    await chapter(1, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, tools.getByRole("button", { name: "✏️ Draw" }), "Draw", { at: cue("Press Draw", 0.3) });
      await expect(box).toBeVisible();
      await focus(rec, box, "toolbox", { at: cue("The toolbox runs") });
      await click(rec, tool("Freehand"), "Freehand", { at: cue("Pick freehand", 0.2), ms: 350 });
      await focus(rec, box.getByRole("region", { name: "Drawing settings" }), "Settings", { at: cue("Settings has color", -0.2) });
      await click(rec, player.getByRole("button", { name: "Red drawing color" }), "Red", { ms: 300 });
      // A very confident arrow: a shaft, then its head.
      await stroke(rec, [A(1.2, 1.4), A(2.6, 0.6), A(4.0, -0.4)], "arrow", { at: cue("finish the stroke", -2.6), ms: 900 });
      await stroke(rec, [A(3.3, -0.6), A(4.0, -0.4), A(3.7, 0.3)], "arrow head", { ms: 500 });
      await click(rec, tool("Circle"), "Circle", { at: cue("can be filled", -0.4), ms: 350 });
      const filled = player.getByRole("checkbox", { name: /Filled/i });
      if (await filled.isVisible().catch(() => false)) await click(rec, filled, "Filled", { ms: 300 });
      await stroke(rec, [A(-3.6, -1.0), A(-2.2, -1.0)], "circle", { at: cue("finish the stroke", 0.4), ms: 600 });
      await click(rec, tools.getByRole("button", { name: "✥ Move" }), "Move", { at: cue("Press Move", 0.3) });
      await rest(player);
    });

    // 2. Undo and erase
    await chapter(2, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, tools.getByRole("button", { name: "✏️ Draw" }), "Draw", { at: cue("Undo and redo", -0.6), ms: 350 });
      await key(rec, "Control+z", "Ctrl+Z", { at: cue("Ctrl Z", 0.1) });
      await key(rec, "Control+y", "Ctrl+Y", { at: cue("Ctrl Y", 0.1) });
      await click(rec, tool("Erase drawings"), "Erase drawings", { at: cue("Erase drawings cuts", 0.2), ms: 350 });
      await stroke(rec, [A(2.4, -0.6), A(2.8, 1.6)], "erase arrow", { at: cue("a freehand line", 0.4), ms: 600 });
      // The eraser hits a circle near its outline: cross its edge.
      await stroke(rec, [A(-2.9, -2.4), A(-2.9, -1.4)], "erase circle", { at: cue("Other shapes go whole", 0.3), ms: 500 });
      await click(rec, tools.getByRole("button", { name: "✥ Move" }), "Move", { at: cue("You can erase your own", 0.2), ms: 350 });
      await rest(player);
    });

    // 3. Area templates
    await chapter(3, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, tools.getByRole("button", { name: "✏️ Draw" }), "Draw", { at: cue("area templates", -0.4), ms: 350 });
      await click(rec, tool("AoE Cone"), "AoE Cone", { at: cue("cone", 0.1), ms: 350 });
      await stroke(rec, [A(0, 0), A(3, 0)], "cone", { at: cue("snaps to whole squares", 0.2), ms: 900 });
      await focus(rec, box, "label", { at: cue("labeled with its size") });
      await click(rec, tool("AoE Burst"), "AoE Burst", { at: cue("Everyone sees it", -0.6), ms: 300 });
      await stroke(rec, [A(-2, 2), A(-2, 4)], "burst", { at: cue("standing in it", 0.2), ms: 700 });
      await click(rec, tools.getByRole("button", { name: "✥ Move" }), "Move", { ms: 300 });
      await rest(player);
    });

    // 4. Measure
    await chapter(4, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, tools.getByRole("button", { name: "📏 Measure" }), "Measure", { at: cue("Press measure", 0.3) });
      await clickAt(rec, A(0, 0), "start", { at: cue("Click a start point", 0.3) });
      await glide(player, A(3, 3), 1200);
      rec.mark("focus", "distance", { box: { x: A(0, 0).x - 20, y: A(0, 0).y - 20, width: c * 3 + 160, height: c * 3 + 60 }, at: cue("with the distance") });
      await clickAt(rec, A(3, 3), "freeze", { at: cue("Click again to freeze", 0.3), ms: 200 });
      await clickAt(rec, A(1, -2), "fresh start", { at: cue("A third click", 0.3) });
      await glide(player, A(-2, -1), 900);
      await click(rec, tools.getByRole("button", { name: "📏 Measure" }), "Measure off", { at: cue("diagonal rule", 0.2), ms: 400 });
      await rest(player);
    });

    // 5. Ping
    await chapter(5, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, tools.getByRole("button", { name: "👆 Ping" }), "Ping", { at: cue("Ping plants", -0.6), ms: 350 });
      await clickAt(rec, A(2, -1), "ping", { at: cue("colored burst", 0.1) });
      await click(rec, tools.getByRole("button", { name: "✥ Move" }), "Move", { at: cue("You can also", -0.2), ms: 350 });
      await clickAt(rec, A(-2, 1), "double-click", { at: cue("double click", 0.3), double: true });
      await rest(player);
    });

    // 6. On a phone (a second player)
    await phone.goto(link);
    await phone.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
    await phone.getByRole("button", { name: /Enter Table/i }).click();
    await phone.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.tokens?.some((t) => t.owner === window.__HERO_BYTE_E2E__?.uid)), undefined, { timeout: 20_000 });
    await phone.waitForTimeout(800);
    await chapter(6, { player, phone }, async ({ cue, recs: { phone: p } }) => {
      const nav = phone.getByRole("navigation", { name: /Mobile actions/i });
      await tap(p, nav.getByRole("button", { name: "Tools", exact: true }), "TOOLS", { at: cue("open Tools", 0.1) });
      await tap(p, phone.getByRole("dialog", { name: "Map tools" }).getByRole("button", { name: "Draw", exact: true }), "Draw", { at: cue("then draw", 0.1) });
      const tb = phone.getByRole("toolbar", { name: "Drawing tools" });
      await expect(tb).toBeVisible();
      await tap(p, tb.getByRole("button", { name: "Hide drawing controls" }), "Hide controls", { at: cue("Hide Controls", 0.2) });
      const at = await centreOwnToken(phone);
      await touchDrag(p, [{ x: at.x - 90, y: at.y + 60 }, { x: at.x, y: at.y - 40 }, { x: at.x + 90, y: at.y + 10 }], "phone line", { at: cue("Your tool stays on", 0.4), ms: 900 });
      await focus(p, phone.getByRole("region", { name: "Drawing history" }), "small row", { at: cue("The small row") });
      await tap(p, phone.getByRole("button", { name: "Done drawing" }), "Done", { at: cue("Cancel and Done", 0.4) });
      const empty = { x: at.x + 110, y: at.y - 160 };
      await tap(p, empty, "double tap", { at: cue("Double tap", 0.2) });
      await phone.waitForTimeout(80);
      await tap(p, empty, "double tap");
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
    await phoneContext.close();
  }
});
