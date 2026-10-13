// Player path 2: The table at a glance (docs/website/video-scripts.md).
// A DM's table off camera (a generated tavern); the DM also joins voice, with Chromium's fake
// microphone (a steady tone), so the call has a count and a speaker. The player's computer is
// recorded for chapters 1-5, a phone (a second player) for chapter 6.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts player-path-2
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { ownRosterRow } from "../../../apps/e2e/party.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, centreOwnToken, click, drag, focus, glide, hover, rest, select, tap, type } from "./rec";

test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "player-path-2-the-table-at-a-glance";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TABLE_PASSWORD = "tour-night";
const DM_PASSWORD = "tour-night-dm";
const TAIL = 2.0;
const PHONE = { width: 390, height: 844 };

test("record: Player path 2", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const dmContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, permissions: ["microphone"] });
  const dm = await dmContext.newPage();
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, permissions: ["microphone"] });
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
    // --- Off camera: the DM makes the table and kicks in a small tavern.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Tour Night");
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
    await panel.getByLabel("Name").fill("The Wandering Lamp");
    await dm.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await dm.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Wandering Lamp";
    }, undefined, { timeout: 40_000 });
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
    await centreOwnToken(player, 1.3);
    await rest(player);
    const tools = player.getByRole("group", { name: "Play tools" });
    const panels = player.getByRole("group", { name: "Panels & settings" });

    // 1. Toolbar, map, Party
    await chapter(1, { player }, async ({ cue, recs: { player: rec } }) => {
      await focus(rec, tools, "Play tools", { at: cue("two groups", 0.2) });
      await focus(rec, panels, "Panels & settings", { at: cue("Panels and settings") });
      await hover(rec, tools.getByRole("button", { name: /Ping/ }), "Ping", { at: cue("Hover any button", 0.3) });
      await hover(rec, tools.getByRole("button", { name: /Measure/ }), "Measure", { ms: 400 });
      await click(rec, tools.getByRole("button", { name: /Draw/ }), "Draw", { at: cue("Tools take turns", 0.3) });
      await click(rec, tools.getByRole("button", { name: /Measure/ }), "Measure", { at: cue("Picking one", 0.4) });
      await click(rec, tools.getByRole("button", { name: /Move/ }), "Move", { at: cue("Press Move", 0.2) });
      const at = await centreOwnToken(player, 1.3);
      rec.mark("focus", "map", { box: { x: at.x - 380, y: at.y - 220, width: 760, height: 440 }, at: cue("The map is shared") });
      await focus(rec, player.getByRole("list", { name: "Party roster" }), "Party", { at: cue("The Party at the bottom") });
      await click(rec, player.getByRole("button", { name: "▦ Cards" }), "Cards", { at: cue("Cards shows", 0.1) });
      await click(rec, player.getByRole("button", { name: "☰ Roster" }), "Roster", { at: cue("Roster goes back", 0.1) });
      await click(rec, player.getByRole("button", { name: /Hide party/ }), "Hide party", { at: cue("Hide party folds", 0.1) });
      await click(rec, player.getByRole("button", { name: /Show party/ }), "Show party", { ms: 450 });
      await focus(rec, player.getByRole("button", { name: "🗺 WORLD" }), "WORLD", { at: cue("also holds World") });
      await rest(player);
    });

    // 2. The Table menu
    const tableButton = player.getByRole("button", { name: /^Table menu/ });
    const menu = player.getByRole("dialog", { name: "Table menu" });
    await chapter(2, { player }, async ({ cue, recs: { player: rec } }) => {
      await focus(rec, tableButton, "Table button", { at: cue("Top left is") });
      await click(rec, tableButton, "Table button", { at: cue("It opens a menu", 0.2) });
      await expect(menu).toBeVisible();
      await focus(rec, menu.getByRole("region", { name: "Your role" }), "Your role", { at: cue("Your role is here") });
      await focus(rec, menu.getByRole("region", { name: "Preferences" }), "Preferences", { at: cue("Preferences are yours") });
      await click(rec, menu.getByRole("button", { name: "📺 CRT" }), "CRT", { at: cue("scan lines", -0.6) });
      await player.waitForTimeout(2_000);
      await click(rec, menu.getByRole("button", { name: "📺 CRT" }), "CRT off", { ms: 350 });
      await focus(rec, menu.getByRole("group", { name: "Sound & motion" }), "Sound & motion", { at: cue("Sound and motion") });
      await player.keyboard.press("Escape");
      await rest(player);
    });

    // 3. Moving around the map
    await chapter(3, { player }, async ({ cue, recs: { player: rec } }) => {
      const at = await centreOwnToken(player, 1.3);
      const empty = { x: at.x + 240, y: at.y - 150 };
      await drag(rec, empty, { x: empty.x - 220, y: empty.y + 90 }, "pan", { at: cue("Drag empty map space", 0.8), ms: 800 });
      await click(rec, tools.getByRole("button", { name: /Ping/ }), "Ping", { at: cue("Middle mouse", -0.6), ms: 350 });
      // A middle-button drag pans with a tool armed.
      await glide(player, empty, 400);
      rec.mark("drag", "middle drag", { box: { x: empty.x - 30, y: empty.y - 30, width: 60, height: 60 } });
      await player.mouse.down({ button: "middle" });
      await glide(player, { x: empty.x + 200, y: empty.y - 60 }, 700);
      await player.mouse.up({ button: "middle" });
      rec.mark("drop", "middle drag", { box: { x: empty.x + 170, y: empty.y - 90, width: 60, height: 60 }, at: cue("even with the tool", 0.6) });
      await click(rec, tools.getByRole("button", { name: /Move/ }), "Move", { ms: 300 });
      await glide(player, { x: at.x, y: at.y }, 400);
      rec.mark("focus", "wheel", { box: { x: at.x - 200, y: at.y - 140, width: 400, height: 280 }, at: cue("The wheel zooms") });
      for (let i = 0; i < 5; i += 1) {
        await player.mouse.wheel(0, -120);
        await player.waitForTimeout(110);
      }
      await player.waitForTimeout(500);
      for (let i = 0; i < 5; i += 1) {
        await player.mouse.wheel(0, 120);
        await player.waitForTimeout(110);
      }
      await click(rec, tools.getByRole("button", { name: "Reset view" }), "Reset", { at: cue("Reset puts the view", 0.2) });
      const row = ownRosterRow(player);
      await click(rec, row.getByRole("button", { name: /^Focus / }), "🎯", { at: cue("press the target", 0.3) });
      await rest(player);
    });

    // 4. Chat and whispers
    await chapter(4, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, panels.getByRole("button", { name: "📜 Chat & Rolls" }), "Chat & Rolls", { at: cue("Open chat and", 0.3) });
      const chat = player.getByRole("tabpanel", { name: "CHAT" });
      await expect(chat).toBeVisible();
      await focus(rec, player.getByRole("tab", { name: "CHAT", exact: true }), "CHAT tab", { at: cue("Chat is the first tab") });
      const to = chat.getByRole("combobox", { name: "Send to" });
      await select(rec, to, "Send to", "Everyone", { at: cue("Choose Everyone", 0.3) });
      await type(rec, chat.getByRole("textbox", { name: "Chat message" }), "Chat message", "Ready when you are", { delay: 45 });
      await click(rec, chat.getByRole("button", { name: "SEND" }), "SEND", { at: cue("Press Send", 0.2) });
      const whisper = await to.locator("option", { hasText: "Whisper to" }).first().textContent();
      await select(rec, to, "Whisper", whisper!.trim(), { at: cue("Whisper to someone", 0.3) });
      await type(rec, chat.getByRole("textbox", { name: "Chat message" }), "Chat message", "Bring snacks", { delay: 55 });
      await player.keyboard.press("Enter");
      rec.mark("note", "whispered");
      await focus(rec, chat, "chat log", { at: cue("Being the DM") });
      await click(rec, player.getByRole("button", { name: /^Close .*CHAT/i }), "close chat", { ms: 400 }).catch(() => {});
      await rest(player);
    });

    // The DM is in the call before the player joins, so there is a count to read.
    await dm.getByRole("group", { name: "Voice chat" }).first().getByRole("button", { name: /Join voice/ }).click();
    await player.waitForTimeout(2_000);

    // 5. Voice
    const voice = player.getByRole("group", { name: "Voice chat" }).first();
    await chapter(5, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, voice.getByRole("button", { name: /Join voice/ }), "Join voice", { at: cue("Press Join voice", 0.3) });
      await focus(rec, voice, "voice controls", { at: cue("Allow the microphone") });
      await focus(rec, voice.getByText(/in call/), "count", { at: cue("Before you join", 0.2) });
      await click(rec, voice.getByRole("button", { name: /Mute/ }), "Mute", { at: cue("Mute keeps you", 0.2) });
      await click(rec, voice.getByRole("button", { name: /Unmute/ }), "Unmute", { at: cue("You still hear", 0.4), ms: 400 });
      await hover(rec, voice.getByRole("button", { name: "Leave voice" }), "Leave voice", { at: cue("Leave voice hangs up", 0.1) });
      await click(rec, player.getByRole("button", { name: "▦ Cards" }), "Cards", { at: cue("When someone talks", 0.1) });
      await focus(rec, player.locator(".party-cards, [class*='party-card']").first(), "speaking card", { at: cue("glows in their", -0.2) }).catch(() => {});
      await click(rec, voice.getByRole("button", { name: "Leave voice" }), "Leave voice", { at: cue("Wear headphones", 0.6) });
      await click(rec, player.getByRole("button", { name: "☰ Roster" }), "Roster", { ms: 400 });
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
      await focus(p, nav, "dock", { at: cue("dock of five") });
      await tap(p, nav.getByRole("button", { name: "Party", exact: true }), "PARTY", { at: cue("open full screen", -0.4) });
      const sheet = phone.getByRole("dialog", { name: "Party Members" });
      await expect(sheet).toBeVisible();
      await tap(p, sheet.getByRole("button", { name: "Close Party Members" }), "close", { at: cue("Close them", 0.4) });
      await tap(p, nav.getByRole("button", { name: "Party", exact: true }), "PARTY", { at: cue("Voice is at the top", -0.6) });
      await focus(p, sheet.getByRole("group", { name: "Voice chat" }), "voice row", { at: cue("Voice is at the top", 0.3) });
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
    await phoneContext.close();
  }
});
