// Player path 4: Roll dice (docs/website/video-scripts.md).
// A DM's table off camera (a generated tavern); the player's computer for chapters 1-5 and a phone
// (a second player) for chapter 6. The DM ends combat between chapters only when re-recording.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts player-path-4
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { ownRosterRow } from "../../../apps/e2e/party.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, centreOwnToken, click, clickPoint, focus, hover, key, rest, tap, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "player-path-4-roll-dice";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TABLE_PASSWORD = "dice-night";
const DM_PASSWORD = "dice-night-dm";
const TAIL = 2.0;
const PHONE = { width: 390, height: 844 };

test("record: Player path 4", async ({ browser }) => {
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
    // --- Off camera: the DM makes the table and kicks in a small tavern.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Dice Night");
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
    await panel.getByLabel("Name").fill("The Loaded Die");
    await dm.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await dm.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Loaded Die";
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
    await centreOwnToken(player, 1.4);
    await rest(player);
    const roller = player.locator("[data-testid='dice-build-strip']").locator("xpath=ancestor::*[.//button[@aria-label='Roll dice']][1]");
    const add = (die: string) => player.getByRole("button", { name: `Add ${die}`, exact: true });
    // The Roll Result window opens over the tray after a roll: close it before using the tray again.
    const closeResult = async (rec: Recording, at?: number) => {
      // Wait for the moment first: straight after a roll the window has not opened yet.
      if (at !== undefined) await rec.clock.at(at - 0.6, player);
      const close = player.getByRole("button", { name: /^Close .*ROLL RESULT/i });
      if (await close.isVisible().catch(() => false)) await click(rec, close, "close result", { at, ms: 350 });
    };

    // 1. Build and roll
    await chapter(1, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, player.getByRole("button", { name: "⚂ Dice" }), "Dice", { at: cue("Press Dice", 0.3) });
      await expect(player.getByText("⚂ DICE ROLLER")).toBeVisible();
      await click(rec, player.getByRole("button", { name: "📜 Chat & Rolls" }), "Chat & Rolls", { at: cue("Chat and Rolls holds", 0.2) });
      await click(rec, player.getByRole("tab", { name: "ROLLS", exact: true }), "ROLLS", { ms: 300 });
      await click(rec, add("d6"), "Add d6", { at: cue("Click dice to add", 0.4) });
      await focus(rec, roller, "tray", { at: cue("Nothing rolls yet") });
      await click(rec, add("d6"), "Add d6", { at: cue("Click again", 0.2), ms: 300 });
      await click(rec, add("d6"), "Add d6", { ms: 250 });
      await click(rec, player.locator(".dice-token").first(), "count badge", { at: cue("count badge", 0.3) });
      await type(rec, player.locator(".dice-token input[type='number']").first(), "count", "4", { ms: 150, delay: 120 });
      await player.keyboard.press("Enter");
      await click(rec, player.getByRole("button", { name: "Add +1 modifier" }), "+1", { at: cue("Add a plus one", 0.4) });
      const chip = player.getByRole("button", { name: /^Remove modifier/ }).locator("..");
      await clickPoint(rec, chip, 14, 12, "modifier chip", { at: cue("Click a chip", 0.3) });
      await player.keyboard.press("Control+A");
      await player.keyboard.type("3", { delay: 120 });
      await player.keyboard.press("Enter");
      await click(rec, player.getByRole("button", { name: "Roll dice" }), "ROLL!", { at: cue("Press Roll", 0.3) });
      rec.mark("note", "rolled", { at: cue("then the total") });
      await focus(rec, player.getByRole("tabpanel").first(), "log entry", { at: cue("critical banner", -1.2) });
      await rest(player);
    });

    // 2. Advantage and who sees it
    await chapter(2, { player }, async ({ cue, recs: { player: rec } }) => {
      await closeResult(rec, cue("Advantage rolls", -0.9));
      await click(rec, player.getByRole("button", { name: "CLEAR", exact: true }), "CLEAR", { at: cue("Advantage rolls", -0.2) });
      await click(rec, add("d20"), "Add d20", { ms: 300 });
      await click(rec, player.getByRole("group", { name: "Roll mode" }).getByRole("button", { name: "ADV" }), "ADV", { at: cue("keeps the higher", -0.2) });
      await click(rec, player.getByRole("button", { name: "Roll dice" }), "ROLL!", { at: cue("Disadvantage keeps", 0.1) });
      rec.mark("note", "struck", { at: cue("struck through") });
      await closeResult(rec, cue("Table means everyone", -0.7));
      const who = player.getByRole("group", { name: "Who sees this roll" });
      await click(rec, who.getByRole("button", { name: "TABLE" }), "TABLE", { at: cue("Table means everyone", 0.1), ms: 300 });
      await click(rec, who.getByRole("button", { name: "DM" }), "DM", { at: cue("DM means", 0.1), ms: 300 });
      await click(rec, who.getByRole("button", { name: "ME" }), "ME", { at: cue("Me means", 0.1), ms: 300 });
      await focus(rec, player.getByRole("status").filter({ hasText: /sees this roll|Only you/ }).first(), "who line", { at: cue("The line under") });
      await click(rec, who.getByRole("button", { name: "TABLE" }), "TABLE", { at: cue("hidden", -0.6), ms: 300 });
      await rest(player);
    });

    // 3. Quick rolls and macros
    await chapter(3, { player }, async ({ cue, recs: { player: rec } }) => {
      const now = player.getByRole("group", { name: "Roll now" });
      await focus(rec, now, "Roll now", { at: cue("now row") });
      await click(rec, now.getByRole("button", { name: "Roll ADV d20 now" }), "ADV d20", { at: cue("advantage", 0.2) });
      await closeResult(rec, cue("Build any", -0.8));
      await click(rec, player.getByRole("button", { name: "CLEAR", exact: true }), "CLEAR", { at: cue("Build any", -0.2), ms: 300 });
      await click(rec, add("d8"), "Add d8", { ms: 300 });
      for (let i = 0; i < 3; i += 1) await click(rec, player.getByRole("button", { name: "Add +1 modifier" }), "+1", { ms: 200 });
      await click(rec, now.getByRole("button", { name: "+ SAVE" }), "+ SAVE", { at: cue("press Save", 0.2) });
      await type(rec, player.getByLabel("Macro name"), "Macro name", "Longsword", { ms: 200, delay: 80 });
      await player.keyboard.press("Enter");
      await focus(rec, now.getByRole("button", { name: /Longsword/ }).first(), "Longsword", { at: cue("keep it", 0.4) });
      await focus(rec, now, "saved rolls", { at: cue("live in this browser") });
      await rest(player);
    });

    // 4. Rolling real dice
    await chapter(4, { player }, async ({ cue, recs: { player: rec } }) => {
      await closeResult(rec, cue("Rolling physical dice", -0.9));
      await click(rec, player.getByRole("button", { name: "CLEAR", exact: true }), "CLEAR", { at: cue("Rolling physical dice", -0.3), ms: 300 });
      await click(rec, player.getByTestId("roller-hand-entry-open"), "I ROLLED IT", { at: cue("Press I Rolled It", 0.4) });
      await type(rec, player.getByTestId("roller-hand-entry-input"), "hand entry", "17", { at: cue("type the total", 0.2), delay: 120 });
      await click(rec, player.getByTestId("roller-hand-entry-submit"), "RECORD", { ms: 300 });
      await closeResult(rec);
      await click(rec, add("d20"), "Add d20", { at: cue("Already rolled", 0.2), ms: 300 });
      await click(rec, player.getByRole("button", { name: "Roll dice" }), "ROLL!", { ms: 400 });
      await player.waitForTimeout(1_200);
      await click(rec, player.getByTestId("result-hand-entry-open"), "NOT WHAT I ROLLED", { at: cue("That's Not What I Rolled", 0.3) });
      await type(rec, player.getByTestId("result-hand-entry-input"), "correction", "12", { delay: 120, ms: 200 });
      await click(rec, player.getByTestId("result-hand-entry-submit"), "RECORD", { ms: 300 });
      await closeResult(rec);
      await focus(rec, player.getByTestId("roll-entered-badge").first(), "BY HAND", { at: cue("by hand", 0.1) });
      await focus(rec, player.getByTestId("roll-entered-badge").first(), "struck number", { at: cue("When you correct", 0.2) });
      await rest(player);
    });

    // 5. Initiative (the roller and the log closed: the card and the Party bar in view)
    for (const name of [/^Close .*ROLL RESULT/i, /^Close .*DICE ROLLER/i, /^Close .*CHAT/i]) {
      const close = player.getByRole("button", { name });
      if (await close.isVisible().catch(() => false)) await close.click();
    }
    const row = ownRosterRow(player);
    const inspector = player.locator(".party-inspector");
    await row.locator(".party-roster__select").click();
    await expect(inspector).toBeVisible();
    const modal = player.locator("[data-modal-overlay]");
    await chapter(5, { player }, async ({ cue, recs: { player: rec } }) => {
      await click(rec, inspector.getByRole("button", { name: "Set Initiative" }), "INIT", { at: cue("on your card", -0.4) });
      await expect(modal).toBeVisible();
      await focus(rec, modal.getByText(/No fight is running/), "no fight note", { at: cue("If no fight", -6) });
      await click(rec, modal.getByRole("button", { name: "Raise the modifier" }), "+ modifier", { at: cue("Set your modifier", 0.4), ms: 350 });
      await click(rec, modal.getByRole("button", { name: "Raise the modifier" }), "+ modifier", { ms: 250 });
      await click(rec, modal.getByRole("button", { name: "Roll d20 now" }), "ROLL D20 NOW", { at: cue("press Roll", 0.3) });
      await expect(modal).toBeHidden({ timeout: 15_000 });
      await focus(rec, player.getByText(/Combat Active/).first(), "Combat Active", { at: cue("lands in the log", 0.2) });
      await focus(rec, inspector.getByRole("button", { name: "Set Initiative" }), "hand entry", { at: cue("Or press Enter", 0.2) });
      await focus(rec, player.getByText(/Combat Active/).first(), "combat starts", { at: cue("If no fight", 0.2) });
      await hover(rec, player.getByRole("button", { name: "Previous turn" }), "PREV", { at: cue("and Next", -0.4) });
      await hover(rec, player.getByRole("button", { name: "Next turn" }), "NEXT", { ms: 300 });
      await focus(rec, inspector.getByText(/YOUR TURN/i).first(), "YOUR TURN", { at: cue("Your Turn", -0.3) });
      await rest(player);
    });

    // 6. On a phone (a second player): Dice, then INIT on its Party row.
    await phone.goto(link);
    await phone.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
    await phone.getByRole("button", { name: /Enter Table/i }).click();
    await phone.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.tokens?.some((t) => t.owner === window.__HERO_BYTE_E2E__?.uid)), undefined, { timeout: 20_000 });
    await phone.waitForTimeout(800);
    await chapter(6, { player, phone }, async ({ cue, recs: { phone: p } }) => {
      const nav = phone.getByRole("navigation", { name: /Mobile actions/i });
      await tap(p, nav.getByRole("button", { name: "Dice", exact: true }), "DICE", { at: cue("Dice opens", 0.2) });
      await tap(p, phone.getByRole("button", { name: "Add d20", exact: true }), "Add d20", { at: cue("full screen roller", 0.2) });
      await tap(p, phone.getByRole("button", { name: "Roll dice" }), "ROLL!");
      await phone.waitForTimeout(1_600);
      await tap(p, { x: PHONE.width / 2, y: 40 }, "outside the card", { at: cue("Tap outside", 0.4) });
      // The full-screen roller covers the dock: close it before Party.
      await tap(p, phone.getByRole("button", { name: "✕ CLOSE" }), "close roller", { at: cue("Initiative is", -0.6) });
      await tap(p, nav.getByRole("button", { name: "Party", exact: true }), "PARTY", { at: cue("Initiative is", 0.2) });
      const sheet = phone.getByRole("dialog", { name: "Party Members" });
      await focus(p, sheet.getByRole("button", { name: /^Set initiative for/ }).first(), "INIT", { at: cue("on your row", -0.3) });
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
    await phoneContext.close();
  }
});
