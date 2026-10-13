// Player path 3: Your character card (docs/website/video-scripts.md).
// The DM sets the table up off camera (a private table, a generated tavern) and a second player
// joins on a phone, so there is another player's colour for the picker to stop at and a token for
// the DM to lock. The player's computer is recorded for chapters 1-6, the phone for chapter 7.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts player-path-3
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { ownRosterRow } from "../../../apps/e2e/party.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, centreOwnToken, click, drag, focus, glide, hover, key, rest, tap, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "player-path-3-your-character-card";
const OUT = path.resolve(here, "..", "footage", LESSON);
const ASSETS = path.join(here, "assets");
const TABLE_PASSWORD = "card-night";
const DM_PASSWORD = "card-night-dm";
const TAIL = 2.0;
const PHONE = { width: 390, height: 844 };

type When = { at?: number; ms?: number };

/** Click a control that opens the file picker, and hand it `file`. */
async function upload(rec: Recording, target: Locator, label: string, file: string, when: When = {}) {
  const chooser = rec.page.waitForEvent("filechooser");
  await click(rec, target, label, when);
  await (await chooser).setFiles(path.join(ASSETS, file));
}

/** A real mouse double-click on a map point (Konva hears it), landing at `at`. */
async function doubleClick(rec: Recording, to: { x: number; y: number }, label: string, when: When = {}) {
  const ms = when.ms ?? 450;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000, rec.page);
  await glide(rec.page, to, ms);
  rec.mark("click", label, { box: { x: to.x - 30, y: to.y - 30, width: 60, height: 60 }, at: when.at });
  await rec.page.mouse.dblclick(to.x, to.y, { delay: 60 });
}

/** A real mouse click on a map point, landing at `at`. */
async function clickAt(rec: Recording, to: { x: number; y: number }, label: string, when: When = {}) {
  const ms = when.ms ?? 450;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000, rec.page);
  await glide(rec.page, to, ms);
  rec.mark("click", label, { box: { x: to.x - 30, y: to.y - 30, width: 60, height: 60 }, at: when.at });
  await rec.page.mouse.click(to.x, to.y, { delay: 70 });
}

/**
 * Put the viewer's own token at (xf, yf) of the map canvas and return its centre (CSS px): to the
 * right of the settings window (which opens over the map's left third) and above the Party.
 */
async function frameOwnToken(page: Page, scale = 1.4, xf = 0.66, yf = 0.4) {
  return page.evaluate(
    ({ want, xf, yf }) => {
      const data = window.__HERO_BYTE_E2E__!;
      const token = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
      const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
      const g = data.gridSize;
      const size = { tiny: 0.5, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 }[token.size ?? "medium"] ?? 1;
      const wx = (token.x + size / 2) * g;
      const wy = (token.y + size / 2) * g;
      data.setCam!({ x: board.width * xf - wx * want, y: board.height * yf - wy * want, scale: want });
      return { x: board.left + board.width * xf, y: board.top + board.height * yf, cell: g * want };
    },
    { want: scale, xf, yf },
  );
}

/** On-screen centre (CSS px) of any token, with the camera left where it is. */
async function tokenOnScreen(page: Page, tokenId: string) {
  return page.evaluate((id) => {
    const data = window.__HERO_BYTE_E2E__!;
    const token = data.snapshot!.tokens.find((t) => t.id === id)!;
    const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
    const g = data.gridSize;
    const cam = data.cam!;
    return { x: board.left + cam.x + (token.x + 0.5) * g * cam.scale, y: board.top + cam.y + (token.y + 0.5) * g * cam.scale, cell: g * cam.scale };
  }, tokenId);
}

test("record: Player path 3", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const { context: dmContext, page: dm } = await (async () => {
    const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
    return { context, page: await context.newPage() };
  })();
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, acceptDownloads: true });
  await addCursor(playerContext);
  const player = await playerContext.newPage();
  const phoneContext = await browser.newContext({ viewport: PHONE, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  await addCursor(phoneContext, true);
  const phone = await phoneContext.newPage();
  dm.on("dialog", (d) => void d.accept());
  player.on("dialog", (d) => void d.accept());
  // A missed control fails in seconds, not at the 15-minute test timeout.
  for (const c of [dmContext, playerContext, phoneContext]) c.setDefaultTimeout(30_000);

  type Ctx = { cue: (phrase: string, offset?: number, nth?: number) => number; recs: Record<string, Recording> };
  async function chapter(n: number, pages: Record<string, Page>, run: (c: Ctx) => Promise<void>) {
    const { cue, duration } = chapters(n);
    const clock = new Clock(`ch${n}`);
    const recs = Object.fromEntries(Object.entries(pages).map(([who, page]) => [who, new Recording(page, path.join(OUT, `ch${n}`, who), clock)]));
    for (const rec of Object.values(recs)) await rec.start();
    await run({ cue, recs });
    const last = Object.values(pages)[0]!;
    await clock.at(Math.max(duration, clock.now()) + TAIL, last);
    for (const rec of Object.values(recs)) await rec.stop(clock.now());
  }

  try {
    // --- Off camera: the DM makes the table and kicks in a small tavern.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Card Night");
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
    await panel.getByLabel("Size").selectOption("small");
    await panel.getByLabel("Name").fill("The Gilded Card");
    await dm.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await dm.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Gilded Card";
    }, undefined, { timeout: 40_000 });
    const link = dm.url().replace(/^https?:\/\/[^/]+/, "");

    // A second player on a phone: another colour on the table, a token for the DM to lock.
    await phone.goto(link);
    await phone.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
    await phone.getByRole("button", { name: /Enter Table/i }).click();
    await phone.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.tokens?.some((t) => t.owner === window.__HERO_BYTE_E2E__?.uid)), undefined, { timeout: 20_000 });
    const phoneTokenId = await phone.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      return data.snapshot!.tokens.find((t) => t.owner === data.uid)!.id;
    });
    await phone.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      const own = data.snapshot!.characters.find((c) => c.ownedByPlayerUID === data.uid)!;
      data.sendMessage!({ t: "update-character-name", characterId: own.id, name: "Bram" });
    });

    // The player opens the invite and gets in (the lesson starts at the table).
    await player.goto(link);
    await player.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
    await player.getByRole("button", { name: /Enter Table/i }).click();
    await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await player.waitForTimeout(1_000);
    await frameOwnToken(player);
    // Off camera: the DM locks Bram's token, for chapter 5's lock badge.
    await dm.evaluate((id) => {
      const data = window.__HERO_BYTE_E2E__!;
      data.sendMessage!({ t: "lock-selected", uid: data.uid!, objectIds: [`token:${id}`] });
    }, phoneTokenId);
    // Off camera: step Kael's token off Bram's, two cells up into the tavern.
    {
      const at = await frameOwnToken(player);
      await player.mouse.move(at.x, at.y);
      await player.mouse.down();
      await player.mouse.move(at.x - at.cell, at.y - at.cell * 2, { steps: 12 });
      await player.mouse.up();
      await player.waitForTimeout(600);
      await frameOwnToken(player);
    }
    await rest(player);
    const row = ownRosterRow(player);
    const inspector = player.locator(".party-inspector");

    // 1. Open your card
    await chapter(1, { player }, async ({ cue, recs: { player: rec } }) => {
      await focus(rec, player.getByRole("heading", { name: "Party" }), "Party", { at: cue("lists characters") });
      await click(rec, row.locator(".party-roster__select"), "your row", { at: cue("Select your row", 0.3) });
      await expect(inspector).toBeVisible();
      await focus(rec, inspector, "card", { at: cue("card opens") });
      await key(rec, "Escape", "Esc", { at: cue("Escape", 0.1) });
      const bram = player.locator(".party-roster__select", { hasText: "Bram" }).first();
      await click(rec, bram, "Bram's row", { at: cue("Select another row", 0.2) });
      await click(rec, row.locator(".party-roster__select"), "your row", { at: cue("to switch", 0.3), ms: 400 });
      await click(rec, player.getByRole("button", { name: "▦ Cards" }), "Cards", { at: cue("Cards shows", 0.1) });
      await player.waitForTimeout(1_600);
      await click(rec, player.getByRole("button", { name: "☰ Roster" }), "Roster", { ms: 400 });
      await rest(player);
    });

    // 2. Name, HP and temp HP
    if (!(await inspector.isVisible())) await row.locator(".party-roster__select").click();
    await chapter(2, { player }, async ({ cue, recs: { player: rec } }) => {
      const name = await player.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        return data.snapshot!.characters.find((c) => c.ownedByPlayerUID === data.uid)!.name;
      });
      const nameSpan = inspector.locator('span[style*="cursor: pointer"]', { hasText: name }).first();
      await click(rec, nameSpan, "name", { at: cue("Click the name", 0.2) });
      await type(rec, player.locator(".party-inspector input:visible").first(), "name field", "Kael the Quick", { delay: 55 });
      await player.keyboard.press("Enter");
      await click(rec, inspector.getByRole("button", { name: /^Set max HP/ }), "max HP", { at: cue("Click either", 0.3) });
      await type(rec, inspector.getByLabel("Max HP"), "Max HP", "30", { ms: 200, delay: 90 });
      await player.keyboard.press("Enter");
      await click(rec, inspector.getByRole("button", { name: /^Set current HP/ }), "current HP", { at: cue("type a new value", 0.2), ms: 400 });
      await type(rec, inspector.getByLabel("Current HP"), "Current HP", "22", { ms: 200, delay: 90 });
      await player.keyboard.press("Enter");
      rec.mark("note", "saved", { at: cue("click away saves") });
      const bar = (await inspector.locator(".jrpg-hp-bar").first().boundingBox())!;
      await drag(rec, { x: bar.x + bar.width * 0.7, y: bar.y + bar.height / 2 }, { x: bar.x + bar.width * 0.12, y: bar.y + bar.height / 2 }, "HP bar down", { at: cue("goes green", 0.9), ms: 1100 });
      await drag(rec, { x: bar.x + bar.width * 0.12, y: bar.y + bar.height / 2 }, { x: bar.x + bar.width * 0.72, y: bar.y + bar.height / 2 }, "HP bar up", { ms: 700 });
      await click(rec, inspector.getByRole("button", { name: /^Set temp HP/ }), "Temp HP", { at: cue("Temp HP is", 0.3) });
      await type(rec, inspector.getByLabel("Temp HP"), "Temp HP field", "5", { ms: 200, delay: 90 });
      await player.keyboard.press("Enter");
      const at = await frameOwnToken(player);
      await drag(rec, { x: at.x + 300, y: at.y + 60 }, { x: at.x - 160, y: at.y - 140 }, "pan away", { at: cue("used up before", 0.6), ms: 600 });
      await click(rec, inspector.getByRole("button", { name: "Focus camera on token" }), "⚔️", { at: cue("sword button", 0.3) });
      await rest(player);
    });

    // 3. Portrait and token art
    const settings = player.locator("[data-mobile-surface='settings']").first();
    let portraitUrl = "";
    await chapter(3, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, inspector.getByRole("button", { name: "Open player settings" }), "⚙️", { at: cue("The gear opens", 0.2) });
      await expect(settings.getByRole("region", { name: "Character" })).toBeVisible();
      const portraitField = settings.getByRole("textbox", { name: "Portrait Image URL" });
      const tokenField = settings.getByRole("textbox", { name: "Token Image URL" });
      await focus(rec, portraitField, "Portrait Image URL", { at: cue("Your portrait") });
      await focus(rec, tokenField, "Token Image URL", { at: cue("your token are", 0.2) });
      const uploads = settings.getByRole("button", { name: "⬆ Upload image" });
      await upload(rec, uploads.nth(0), "UPLOAD IMAGE (portrait)", "rogue-portrait.png", { at: cue("Upload image sends", 0.3) });
      await expect(portraitField).toHaveValue(/\S/, { timeout: 15_000 });
      portraitUrl = await portraitField.inputValue();
      await upload(rec, uploads.nth(1), "UPLOAD IMAGE (token)", "rogue-token.png", { at: cue("a PNG", 0.2) });
      await expect(tokenField).toHaveValue(/\S/, { timeout: 15_000 });
      rec.mark("note", "token art", { at: cue("megabytes") });
      await type(rec, tokenField, "Token Image URL", portraitUrl, { at: cue("paste a link", 0.1), delay: 4 });
      await click(rec, settings.getByRole("button", { name: "Apply", exact: true }), "Apply", { at: cue("press Apply", 0.3), ms: 400 });
      await focus(rec, tokenField, "links", { at: cue("Links work from") });
      await click(rec, settings.getByRole("button", { name: "Clear", exact: true }), "Clear", { at: cue("Clear takes", 0.2) });
      await rest(player);
    });

    // 4. Conditions and size
    await chapter(4, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, settings.getByRole("button", { name: "No Effects" }), "Status Effects", { at: cue("Status effects is", 0.3) });
      for (const [i, name] of ["Prone", "Poisoned", "Frightened", "Burning"].entries()) {
        await click(rec, player.getByRole("checkbox", { name: new RegExp(name) }), name, { ms: 260, at: i === 0 ? cue("checklist", 0.2) : undefined });
      }
      await key(rec, "Escape", "Esc", { ms: 200 });
      const at = await frameOwnToken(player);
      rec.mark("focus", "token conditions", { box: { x: at.x - at.cell * 1.2, y: at.y - at.cell * 1.4, width: at.cell * 2.4, height: at.cell * 2.6 }, at: cue("Up to three") });
      await click(rec, settings.getByRole("button", { name: "Large", exact: true }), "Large", { at: cue("Token size runs", 0.4) });
      await rest(player);
    });

    // 5. Your token on the map
    await chapter(5, { player }, async ({ cue, recs: { player: rec } }) => {
      const at = await frameOwnToken(player);
      rec.mark("focus", "token", { box: { x: at.x - at.cell * 1.5, y: at.y - at.cell * 1.6, width: at.cell * 3, height: at.cell * 3.2 }, at: cue("Every token wears") });
      const picker = settings.getByRole("slider", { name: /colour$/ });
      await focus(rec, picker, "Colour", { at: cue("Your color is") });
      // Drag the handle into Bram's striped patch: it stops at the edge and names him.
      const swatch = settings.getByRole("img", { name: "Bram's colour" });
      const handle = (await picker.boundingBox())!;
      const into = (await swatch.boundingBox())!;
      await drag(rec, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: into.x + into.width / 2, y: into.y + into.height / 2 }, "colour handle", { at: cue("let go", 0.1), ms: 1200, hold: 200 });
      await click(rec, settings.getByRole("button", { name: /^Suggested colour 1/ }), "dashed ring", { at: cue("dashed ring", 0.2) });
      await focus(rec, swatch, "striped patch", { at: cue("striped patches") });
      const now = await frameOwnToken(player);
      await doubleClick(rec, now, "double-click token", { at: cue("Double click your token", 0.5) });
      await doubleClick(rec, now, "double-click token", { at: cue("nobody else is using", 0.2), ms: 250 });
      await click(rec, settings.getByRole("button", { name: /^Close / }), "close settings", { ms: 350 });
      await click(rec, player.getByRole("button", { name: /TRANSFORM/i }), "TRANSFORM", { at: cue("With TRANSFORM", 0.2) });
      const again = await frameOwnToken(player);
      await clickAt(rec, again, "token", { at: cue("click a token", 0.3) });
      rec.mark("focus", "handles", { box: { x: again.x - again.cell * 1.6, y: again.y - again.cell * 1.6, width: again.cell * 3.2, height: again.cell * 3.2 }, at: cue("scale and rotate") });
      await key(rec, "Escape", "Esc", { ms: 200 });
      await click(rec, player.getByRole("button", { name: /MOVE/i }).first(), "MOVE", { ms: 300 });
      const bram = await tokenOnScreen(player, phoneTokenId);
      rec.mark("focus", "lock badge", { box: { x: bram.x - bram.cell, y: bram.y - bram.cell, width: bram.cell * 2, height: bram.cell * 2 }, at: cue("lock badge") });
      await rest(player);
    });

    // 6. Save, load, add a character
    if (!(await inspector.isVisible())) await row.locator(".party-roster__select").click();
    await inspector.getByRole("button", { name: "Open player settings" }).click();
    await expect(settings.getByRole("button", { name: "Save character" })).toBeVisible();
    await chapter(6, { player }, async ({ cue, recs: { player: rec } }) => {
      const download = player.waitForEvent("download");
      await click(rec, settings.getByRole("button", { name: "Save character" }), "Save character", { at: cue("Save Character downloads", 0.4) });
      await download;
      await hover(rec, settings.getByRole("button", { name: "Load character…" }), "Load character…", { at: cue("Load Character brings", 0.3) });
      await focus(rec, settings.getByText(/It never saves or restores the table/), "one character", { at: cue("one character, never") });
      await focus(rec, settings.getByText(/replaces the ones you have on the map/), "warning", { at: cue("One warning") });
      await click(rec, settings.getByRole("button", { name: "➕ Add Character" }), "Add Character", { at: cue("Add Character gives", 0.3) });
      await type(rec, player.getByPlaceholder("Enter character name..."), "character name", "Pip", { delay: 90 });
      await click(rec, player.getByRole("button", { name: "Create", exact: true }), "Create", { ms: 350 });
      await expect(player.locator(".party-roster__select", { hasText: "Pip" })).toBeVisible({ timeout: 15_000 });
      await focus(rec, player.locator(".party-roster__select", { hasText: "Pip" }).first(), "second row", { at: cue("Up to five") });
      await rest(player);
    });

    // 7. On a phone
    await player.keyboard.press("Escape");
    await frameOwnToken(player);
    await rest(player);
    await chapter(7, { player, phone }, async ({ cue, recs: { phone: p } }) => {
      const nav = phone.getByRole("navigation", { name: /Mobile actions/i });
      await tap(p, nav.getByRole("button", { name: "Party", exact: true }), "PARTY", { at: cue("open party", 0.2) });
      const sheet = phone.getByRole("dialog", { name: "Party Members" });
      await expect(sheet).toBeVisible();
      const hp = sheet.getByRole("button", { name: /^Set current HP/ }).first();
      await tap(p, hp, "your HP", { at: cue("Tap or drag", 0.3) });
      await phone.keyboard.press("Control+A");
      await phone.keyboard.type("64", { delay: 120 });
      await phone.keyboard.press("Enter");
      await tap(p, sheet.getByRole("button", { name: "⚙️ EDIT" }).first(), "EDIT", { at: cue("Edit holds", 0.1) });
      const edit = phone.getByRole("region", { name: "Character" });
      await expect(edit).toBeVisible();
      p.mark("focus", "edit sheet", { box: { x: 0, y: 60, width: PHONE.width, height: PHONE.height * 0.7 }, at: cue("your color") });
      await tap(p, phone.getByRole("button", { name: /^Close 🎮/ }), "close edit", { at: cue("Double tap", -1.4) });
      await tap(p, sheet.getByRole("button", { name: "Close Party Members" }), "close party", { at: cue("Double tap", -0.6) });
      const own = await centreOwnToken(phone);
      await tap(p, own, "token", { at: cue("Double tap", 0.1) });
      await phone.waitForTimeout(90);
      await tap(p, own, "token");
      p.mark("focus", "token art", { box: { x: own.x - 60, y: own.y - 60, width: 120, height: 120 }, at: cue("Token art is set") });
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
    await phoneContext.close();
  }
});
