// Player quick start: Your first session as a player (docs/website/video-scripts.md).
// The DM sets the table up off camera (a private table, a generated tavern), then the player's
// computer and, for the d-pad, a phone are recorded in step with Wren's narration.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts player-quick-start
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "../../../apps/e2e/fixtures";
import { ownRosterRow } from "../../../apps/e2e/party.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, centreOwnToken, click, drag, focus, hover, key, rest, tap, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "player-quick-start-your-first-session-as-a-player";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TABLE_PASSWORD = "friday-table";
const DM_PASSWORD = "friday-dm-pass";
const TAIL = 2.0;
const PHONE = { width: 390, height: 844 };

test("record: Player quick start", async ({ browser }) => {
  test.setTimeout(600_000);
  const chapters = loadCues(LESSON);
  const desk = async (cursor = true) => {
    const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
    if (cursor) await addCursor(context);
    return { context, page: await context.newPage() };
  };
  const { context: dmContext, page: dm } = await desk(false);
  const { context: playerContext, page: player } = await desk();
  const phoneContext = await browser.newContext({ viewport: PHONE, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  await addCursor(phoneContext, true);
  const phone = await phoneContext.newPage();
  dm.on("dialog", (d) => void d.accept());

  type Ctx = { cue: (phrase: string, offset?: number) => number; recs: Record<string, Recording> };
  async function chapter(n: number, pages: Record<string, typeof dm>, run: (c: Ctx) => Promise<void>) {
    const { cue, duration } = chapters(n);
    const clock = new Clock(`ch${n}`);
    const recs = Object.fromEntries(Object.entries(pages).map(([who, page]) => [who, new Recording(page, path.join(OUT, `ch${n}`, who), clock)]));
    for (const rec of Object.values(recs)) await rec.start();
    await run({ cue, recs });
    await clock.at(Math.max(duration, clock.now()) + TAIL, player);
    for (const rec of Object.values(recs)) await rec.stop(clock.now());
  }

  try {
    // --- Off camera: the DM makes the table and kicks in a small tavern to play in.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Friday Crew");
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
    await panel.getByLabel("Name").fill("The Salt Hound");
    await dm.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await dm.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Salt Hound";
    }, undefined, { timeout: 40_000 });
    await dm.getByRole("button", { name: /DM MENU/i }).click();
    await dm.getByRole("button", { name: "Table", exact: true }).click();
    const link = (await dm.locator("code", { hasText: "/?room=" }).first().textContent())!.trim().replace(/^https?:\/\/[^/]+/, "");
    await dm.getByRole("button", { name: "Close Dungeon Master Tools" }).click();

    // The player opens the invite; the join screen is where the lesson starts.
    await player.goto(link);
    await expect(player.getByPlaceholder("Table password")).toBeEnabled({ timeout: 20_000 });
    await rest(player);

    // 1. Get in
    await chapter(1, { player }, async ({ cue, recs: { player: rec } }) => {
      await focus(rec, player.getByText(/Connection status/), "Connection status", { at: cue("connection status") });
      await type(rec, player.getByPlaceholder("Table password"), "Table password", TABLE_PASSWORD, { at: cue("Type the table password", 0.2), delay: 55 });
      await click(rec, player.getByRole("button", { name: /Enter Table/i }), "ENTER TABLE", { at: cue("Enter table", 0.1) });
      await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      rec.mark("note", "joined");
      await player.waitForTimeout(800);
      await centreOwnToken(player);
      await rest(player);
    });

    // 2. Find yourself
    const row = ownRosterRow(player);
    await chapter(2, { player }, async ({ cue, recs: { player: rec } }) => {
      const at = await centreOwnToken(player);
      rec.mark("focus", "token", { box: { x: at.x - at.cell, y: at.y - at.cell, width: at.cell * 2, height: at.cell * 2 }, at: cue("This is your token") });
      await focus(rec, row, "your row", { at: cue("Your character has a row") });
      await focus(rec, row.getByText("You", { exact: true }).first(), "You", { at: cue("reads") });
      // Lost it: pan the map away, then the target button brings it back.
      await drag(rec, { x: at.x + 260, y: at.y + 120 }, { x: at.x - 260, y: at.y - 40 }, "pan away", { at: cue("Lost your token", 0.6), ms: 600 });
      await click(rec, row.getByRole("button", { name: /^Focus / }), "Focus", { at: cue("target button", 0.2) });
      await rest(player);
      await click(rec, row.locator(".party-roster__select"), "row", { at: cue("Select your row", 0.2) });
      const inspector = player.locator(".party-inspector");
      await expect(inspector).toBeVisible();
      const name = await player.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        return data.snapshot!.players.find((p) => p.uid === data.uid)!.name;
      });
      // The card's own name (click to edit), not the window title that repeats it.
      const nameSpan = inspector.locator('span[style*="cursor: pointer"]', { hasText: name }).first();
      await click(rec, nameSpan, "name", { at: cue("Click your name", 0.3) });
      await type(rec, player.locator(".party-inspector input:visible").first(), "name field", "Aria", { delay: 70 });
      await player.keyboard.press("Enter");
      await click(rec, inspector.getByRole("button", { name: /^Set .*HP/i }).first(), "HP number", { at: cue("number in HP", 0.2) });
      await type(rec, inspector.getByLabel("Current HP"), "Current HP", "24", { ms: 200, delay: 90 });
      await player.keyboard.press("Enter");
      const bar = (await inspector.locator(".jrpg-hp-bar").first().boundingBox())!;
      await drag(rec, { x: bar.x + bar.width * 0.24, y: bar.y + bar.height / 2 }, { x: bar.x + bar.width * 0.85, y: bar.y + bar.height / 2 }, "HP bar", { at: cue("drag along the bar", 1.0), ms: 900 });
      await rest(player);
    });

    // The phone joins (off camera) as a second seat, ready for chapter 3's d-pad.
    await phone.goto(link);
    await phone.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
    await phone.getByRole("button", { name: /Enter Table/i }).click();
    await phone.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.tokens?.length), undefined, { timeout: 20_000 });
    await phone.waitForTimeout(1_200);
    await player.keyboard.press("Escape"); // close the card before moving
    await player.waitForTimeout(300);

    // 3. Move
    await chapter(3, { player, phone }, async ({ cue, recs }) => {
      const rec = recs.player;
      const at = await centreOwnToken(player);
      await drag(rec, at, { x: at.x + at.cell * 3.4, y: at.y + at.cell * 0.3 }, "token", { at: cue("move it", 0.2) });
      await click(rec, player.getByRole("button", { name: "Snap" }), "Snap", { at: cue("Turn snap on", 0.4) });
      const now = await centreOwnToken(player);
      await drag(rec, now, { x: now.x + now.cell * 1.4, y: now.y + now.cell * 1.3 }, "token snaps", { at: cue("clicks to the grid", 0.4), ms: 600 });
      await rest(player);
      await key(rec, "d", "D", { at: cue("One press", 0.1) });
      await key(rec, "d", "D", { at: cue("One press", 0.6) });
      await key(rec, "s", "S", { at: cue("one sell", 0.2) });
      // The phone: Tools -> Select, tap the token, step with the d-pad.
      const p = recs.phone;
      const tokenAt = await centreOwnToken(phone);
      await tap(p, phone.getByRole("navigation", { name: /Mobile actions/i }).getByRole("button", { name: /Tools/i }), "TOOLS", { at: cue("open tools", 0.2) });
      await tap(p, phone.locator(".mobile-tool-sheet").getByRole("button", { name: /^.?\s*Select$/i }).first(), "Select", { at: cue("then select", 0.2) });
      await tap(p, tokenAt, "token", { at: cue("Tap your token", 0.2) });
      const pad = phone.getByRole("group", { name: "Move selection" });
      if (!(await pad.isVisible().catch(() => false))) {
        // A tap that missed: select through the seam so the d-pad still shows (noted for the edit).
        p.mark("note", "token selected by seam");
        await phone.evaluate(() => {
          const data = window.__HERO_BYTE_E2E__!;
          const own = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
          data.sendMessage!({ t: "select-object", uid: data.uid!, objectId: `token:${own.id}` });
        });
      }
      await expect(pad).toBeVisible({ timeout: 10_000 });
      await tap(p, pad.getByRole("button", { name: "Move right", exact: true }), "Move right", { at: cue("use the D", 0.3) });
      await tap(p, pad.getByRole("button", { name: "Move right", exact: true }), "Move right");
      await phone.waitForTimeout(300);
      await tap(p, pad.getByRole("button", { name: "Move down", exact: true }), "Move down");
    });

    // 4. Roll
    await chapter(4, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, player.getByRole("button", { name: "⚂ Dice" }), "Dice", { at: cue("Press DICE", 0.4) });
      await expect(player.getByText("⚂ DICE ROLLER")).toBeVisible();
      await click(rec, player.getByRole("button", { name: "Add d20", exact: true }), "Add d20", { at: cue("Click a die", 0.6) });
      await click(rec, player.getByRole("button", { name: "Add d20", exact: true }), "Add d20", { at: cue("Click again", 0.4), ms: 300 });
      await click(rec, player.getByRole("button", { name: "Add +1 modifier" }), "+1", { at: cue("modifier chip", 0.1) });
      const mode = player.getByRole("group", { name: "Roll mode" });
      const who = player.getByRole("group", { name: "Who sees this roll" });
      await focus(rec, mode, "Roll mode", { at: cue("Pick normal") });
      await hover(rec, mode.getByRole("button").nth(0), "NORMAL", { at: cue("Pick normal", 0.4), ms: 350 });
      await hover(rec, mode.getByRole("button").nth(1), "ADV", { at: cue("ADV", 0.1), ms: 300 });
      await hover(rec, mode.getByRole("button").nth(2), "DIS", { at: cue("DIS", 0.1), ms: 300 });
      await focus(rec, who, "Who sees this roll", { at: cue("who sees it") });
      await hover(rec, who.getByRole("button").nth(0), "TABLE", { at: cue("the table", 0.1), ms: 300 });
      await hover(rec, who.getByRole("button").nth(1), "DM", { at: cue("the DM", 0.1), ms: 300 });
      await hover(rec, who.getByRole("button").nth(2), "ME", { at: cue("only you", 0.1), ms: 300 });
      await click(rec, player.getByRole("button", { name: "Roll dice" }), "ROLL!", { at: cue("Press Roll", 0.5) });
      await expect(player.getByText("TOTAL")).toBeVisible({ timeout: 10_000 });
      await rest(player);
      await click(rec, player.getByRole("group", { name: "Roll now" }).getByRole("button").first(), "Roll now d20", { at: cue("Roll Now row", 0.3) });
      await rest(player);
      await click(rec, player.getByTestId("roller-hand-entry-open"), "I ROLLED IT", { at: cue("I rolled it", 0.3) });
      await type(rec, player.getByTestId("roller-hand-entry-input"), "hand entry", "17", { at: cue("type what you got", 0.1), delay: 120 });
      await click(rec, player.getByTestId("roller-hand-entry-submit"), "enter", { ms: 300 });
      await click(rec, player.getByRole("button", { name: "📜 Chat & Rolls" }), "Chat & Rolls", { at: cue("The log", 0.1), ms: 400 });
      await click(rec, player.getByRole("tab", { name: "ROLLS", exact: true }), "ROLLS", { ms: 300 });
      await focus(rec, player.getByTestId("roll-entered-badge").first(), "BY HAND", { at: cue("by hand") });
      await rest(player);
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
    await phoneContext.close();
  }
});
