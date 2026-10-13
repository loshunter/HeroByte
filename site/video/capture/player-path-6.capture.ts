// Player path 6: Fog, doors and what you can see (docs/website/video-scripts.md).
// Off camera the DM kicks in a small dungeon (fog comes on, the party at the entrance) and, through
// the e2e seam, drives the door nearest the party (closed; then locked; then secret, in chapter 4)
// and sets and clears a sight limit on the player's token for chapter 2.
// The player's computer is recorded throughout.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts player-path-6
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, glide, rest } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "player-path-6-fog-doors-and-what-you-can-see";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TABLE_PASSWORD = "fog-night";
const DM_PASSWORD = "fog-night-dm";
const TAIL = 2.0;
type Pt = { x: number; y: number };
type When = { at?: number; ms?: number };
type Door = { id: string; x1: number; y1: number; x2: number; y2: number; state: string };

/** Frame a world point (px) at (xf, yf) of the canvas at `scale`; returns a world->screen mapper. */
async function frameWorld(page: Page, world: Pt, scale = 1.9, xf = 0.5, yf = 0.45) {
  const cam = await page.evaluate(
    ({ world, scale, xf, yf }) => {
      const data = window.__HERO_BYTE_E2E__!;
      const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
      const next = { x: board.width * xf - world.x * scale, y: board.height * yf - world.y * scale, scale };
      data.setCam!(next);
      return { ...next, left: board.left, top: board.top };
    },
    { world, scale, xf, yf },
  );
  return (w: Pt) => ({ x: cam.left + cam.x + w.x * cam.scale, y: cam.top + cam.y + w.y * cam.scale });
}

async function ownToken(page: Page) {
  return page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__!;
    const t = data.snapshot!.tokens.find((tk) => tk.owner === data.uid)!;
    return { id: t.id, x: (t.x + 0.5) * data.gridSize, y: (t.y + 0.5) * data.gridSize, g: data.gridSize };
  });
}

async function clickAt(rec: Recording, to: Pt, label: string, when: When = {}) {
  const ms = when.ms ?? 450;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000, rec.page);
  await glide(rec.page, to, ms);
  rec.mark("click", label, { box: { x: to.x - 40, y: to.y - 40, width: 80, height: 80 }, at: when.at });
  await rec.page.mouse.click(to.x, to.y, { delay: 70 });
}

async function dragTo(rec: Recording, from: Pt, to: Pt, label: string, when: When = {}) {
  const ms = when.ms ?? 900;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000 - 0.4, rec.page);
  await glide(rec.page, from, 350);
  rec.mark("drag", label, { box: { x: from.x - 30, y: from.y - 30, width: 60, height: 60 } });
  await rec.page.mouse.down();
  await rec.page.waitForTimeout(120);
  await glide(rec.page, to, ms);
  await rec.page.waitForTimeout(80);
  await rec.page.mouse.up();
  rec.mark("drop", label, { box: { x: to.x - 40, y: to.y - 40, width: 80, height: 80 }, at: when.at });
}

test("record: Player path 6", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const dmContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const dm = await dmContext.newPage();
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  await addCursor(playerContext);
  const player = await playerContext.newPage();
  for (const c of [dmContext, playerContext]) c.setDefaultTimeout(30_000);
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
  const dmSend = (message: unknown) => dm.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);

  try {
    // --- Off camera: a table and a kicked-in dungeon.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Fog Night");
    await dm.getByLabel("New table password", { exact: true }).fill(TABLE_PASSWORD);
    await dm.getByLabel("New DM password", { exact: true }).fill(DM_PASSWORD);
    await dm.getByRole("button", { name: "Create private table", exact: true }).click();
    const card = dm.getByRole("region", { name: "Next steps for the host" });
    await card.getByRole("button", { name: "Enter DM mode", exact: true }).click();
    await dm.locator("input[type='password']:visible").first().fill(DM_PASSWORD);
    await dm.getByRole("dialog", { name: "Enter DM mode" }).getByRole("button", { name: "Enter DM mode", exact: true }).click();
    await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: "Dismiss next steps", exact: true }).click();
    const link = dm.url().replace(/^https?:\/\/[^/]+/, "");
    // The player sits down first, so the dungeon's arrival puts their token at the entrance too.
    await player.goto(link);
    await player.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
    await player.getByRole("button", { name: /Enter Table/i }).click();
    await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await dm.getByTitle("Author the live map on the table").click();
    await dm.getByRole("button", { name: /START LIVE MAP/i }).click();
    await expect(dm.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
    await dm.keyboard.press("Escape");
    const board = (await dm.locator(".konvajs-content").boundingBox())!;
    await dm.mouse.click(board.x + board.width * 0.8, board.y + board.height * 0.45);
    await dm.keyboard.press("g");
    const panel = dm.getByRole("dialog", { name: "Kick in a door" });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await panel.getByLabel("Recipe").selectOption("dungeon");
    await panel.getByLabel("Size").selectOption("small");
    await panel.getByLabel("Name").fill("The Quiet Halls");
    await dm.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await dm.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Quiet Halls";
    }, undefined, { timeout: 40_000 });
    await dmSend({ t: "set-fog-enabled", enabled: true });
    await player.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.length), undefined, { timeout: 20_000 });
    await player.waitForTimeout(1_200);

    // The door nearest the player's token: the one the lesson can show, lit by the room.
    const me = await ownToken(player);
    const doors = (await dm.evaluate(() => (window.__HERO_BYTE_E2E__!.snapshot!.compiledScene?.doors ?? []) as unknown[])) as Door[];
    const mid = (d: Door) => ({ x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 });
    const byDistance = [...doors].sort((a, b) => Math.hypot(mid(a).x - me.x, mid(a).y - me.y) - Math.hypot(mid(b).x - me.x, mid(b).y - me.y));
    const [near] = byDistance;
    if (!near) throw new Error("the dungeon has no doors");
    await dmSend({ t: "set-door-state", doorId: near.id, state: "closed" });
    await player.waitForTimeout(1_000);
    let toScreen = await frameWorld(player, { x: (me.x + mid(near).x) / 2, y: (me.y + mid(near).y) / 2 });
    await rest(player);

    // 1. Fog follows your tokens
    await chapter(1, { player }, async ({ cue, recs: { player: rec } }) => {
      const at = toScreen(me);
      rec.mark("focus", "lit area", { box: { x: at.x - 260, y: at.y - 200, width: 520, height: 400 }, at: cue("fog of war hides") });
      rec.mark("focus", "token", { box: { x: at.x - 80, y: at.y - 80, width: 160, height: 160 }, at: cue("Vision comes from") });
      // Toward the near door: two steps that way.
      const d = mid(near);
      const len = Math.hypot(d.x - me.x, d.y - me.y) || 1;
      const step = Math.min(len - me.g * 0.8, me.g * 3);
      const target = { x: me.x + ((d.x - me.x) / len) * step, y: me.y + ((d.y - me.y) / len) * step };
      await dragTo(rec, at, toScreen(target), "move token", { at: cue("Move and your view", 0.8), ms: 1100 });
      await rest(player);
    });

    // 2. Sight limits (the DM sets 15 ft for this chapter, then clears it)
    await chapter(2, { player }, async ({ cue, recs: { player: rec } }) => {
      await rec.clock.at(cue("Your DM can give", 0.4), player);
      await dmSend({ t: "set-token-vision-radius", tokenId: me.id, radius: 15 });
      const now = await ownToken(player);
      toScreen = await frameWorld(player, now);
      const at = toScreen(now);
      rec.mark("focus", "sight limit", { box: { x: at.x - 200, y: at.y - 160, width: 400, height: 320 }, at: cue("Past it you see nothing") });
      await rest(player);
      await rec.clock.at(cue("Nicely", 0.6), player);
      await dmSend({ t: "set-token-vision-radius", tokenId: me.id, radius: null });
    });

    // 3. Places you have been: walk back to the entrance; where you were stays dim.
    await chapter(3, { player }, async ({ cue, recs: { player: rec } }) => {
      const now = await ownToken(player);
      toScreen = await frameWorld(player, { x: (now.x + me.x) / 2, y: (now.y + me.y) / 2 });
      await dragTo(rec, toScreen(now), toScreen(me), "walk back", { at: cue("Somewhere you've already seen", 1.2), ms: 1100 });
      const back = toScreen(now);
      rec.mark("focus", "dim memory", { box: { x: back.x - 220, y: back.y - 160, width: 440, height: 320 }, at: cue("only a memory") });
      await rest(player);
    });

    // 4. Doors
    await chapter(4, { player }, async ({ cue, recs: { player: rec } }) => {
      toScreen = await frameWorld(player, mid(near));
      await clickAt(rec, toScreen(mid(near)), "door", { at: cue("open or close it", -0.6) });
      await player.waitForTimeout(1_400);
      await clickAt(rec, toScreen(mid(near)), "door", { at: cue("Everyone hears it", 0.6), ms: 300 });
      // The door the player can see does the rest: the DM locks it (a gold square; a click does
      // nothing), then makes it secret (it turns to wall). Doors deeper in are under fog.
      const d = toScreen(mid(near));
      await rec.clock.at(cue("gold square", -0.8), player);
      await dmSend({ t: "set-door-state", doorId: near.id, state: "locked" });
      rec.mark("focus", "locked door", { box: { x: d.x - 70, y: d.y - 70, width: 140, height: 140 }, at: cue("gold square") });
      await clickAt(rec, d, "locked door", { at: cue("Only the DM can open", 0.4) });
      await rec.clock.at(cue("Secret doors exist", -0.2), player);
      await dmSend({ t: "set-door-state", doorId: near.id, state: "secret" });
      rec.mark("focus", "secret door", { box: { x: d.x - 90, y: d.y - 90, width: 180, height: 180 }, at: cue("Secret doors exist", 0.4) });
      await rest(player);
    });

    // 5. The world map
    await chapter(5, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, player.getByRole("button", { name: "🗺 WORLD" }), "WORLD", { at: cue("World opens", 0.2) });
      await player.waitForTimeout(800);
      await focus(rec, player.getByText(/you are here/i).first(), "you are here", { at: cue("Marks", -0.6) }).catch(() => {});
      rec.mark("note", "sprites", { at: cue("Door and stair sprites") });
      await rest(player);
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
