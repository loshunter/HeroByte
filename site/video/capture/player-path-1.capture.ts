// Player path 1: Join a table (docs/website/video-scripts.md).
// Off camera a host makes two private tables (Friday Crew with a generated tavern, Sunday Game) and
// the player's browser visits Sunday Game first, so its Table picker knows two tables. Chapter 4
// records two tabs of that one browser side by side (the new tab is the main view).
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts player-path-1
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { holdableSocket } from "../../../apps/e2e/socket-drop.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, centreOwnToken, click, focus, hover, rest, select, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "player-path-1-join-a-table";
const OUT = path.resolve(here, "..", "footage", LESSON);
const FRIDAY = "friday-table";
const SUNDAY = "sunday-table";
const MAIN_HALL = process.env.E2E_ROOM_PASSWORD ?? "Fun1";
const TAIL = 2.0;

async function makeTable(page: Page, name: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /New Table/i }).click();
  await page.getByLabel("New table name", { exact: true }).fill(name);
  await page.getByLabel("New table password", { exact: true }).fill(password);
  await page.getByLabel("New DM password", { exact: true }).fill(`${password}-dm`);
  await page.getByRole("button", { name: "Create private table", exact: true }).click();
  return page.getByRole("region", { name: "Next steps for the host" });
}

test("record: Player path 1", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const hostContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const host = await hostContext.newPage();
  const host2 = await hostContext.newPage();
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  await addCursor(playerContext);
  const p = await playerContext.newPage();
  for (const c of [hostContext, playerContext]) c.setDefaultTimeout(30_000);
  host.on("dialog", (d) => void d.accept());
  const socket = await holdableSocket(p);

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
    // --- Off camera: Friday Crew (with a tavern to land on) and Sunday Game.
    const card = await makeTable(host, "Friday Crew", FRIDAY);
    await card.getByRole("button", { name: "Enter DM mode", exact: true }).click();
    await host.locator("input[type='password']:visible").first().fill(`${FRIDAY}-dm`);
    await host.getByRole("dialog", { name: "Enter DM mode" }).getByRole("button", { name: "Enter DM mode", exact: true }).click();
    await expect(host.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: "Dismiss next steps", exact: true }).click();
    await host.getByTitle("Author the live map on the table").click();
    await host.getByRole("button", { name: /START LIVE MAP/i }).click();
    await expect(host.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
    await host.keyboard.press("Escape");
    const board = (await host.locator(".konvajs-content").boundingBox())!;
    await host.mouse.click(board.x + board.width * 0.8, board.y + board.height * 0.45);
    await host.keyboard.press("g");
    const panel = host.getByRole("dialog", { name: "Kick in a door" });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await panel.getByLabel("Recipe").selectOption("building");
    await panel.getByLabel("Kind").selectOption("tavern");
    await panel.getByLabel("Size").selectOption("small");
    await panel.getByLabel("Name").fill("The Open Door");
    await host.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await host.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Open Door";
    }, undefined, { timeout: 40_000 });
    const friday = host.url().replace(/^https?:\/\/[^/]+/, "");
    const sundayCard = await makeTable(host2, "Sunday Game", SUNDAY);
    await sundayCard.getByRole("button", { name: "Dismiss next steps", exact: true }).click();
    const sunday = host2.url().replace(/^https?:\/\/[^/]+/, "");
    const sundayCode = new URL(`http://x${sunday}`).searchParams.get("room")!;
    const fridayCode = new URL(`http://x${friday}`).searchParams.get("room")!;

    // The player's browser already knows Sunday Game, then opens the Friday Crew invite.
    await p.goto(sunday);
    await p.getByPlaceholder("Table password").fill(SUNDAY);
    await p.getByRole("button", { name: /Enter Table/i }).click();
    await expect(p.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await p.goto(friday);
    const password = p.getByPlaceholder("Table password");
    const enter = p.getByRole("button", { name: /Enter Table/i });
    await expect(enter).toBeVisible({ timeout: 20_000 });
    await rest(p);

    // 1. The join screen
    await chapter(1, { player: p }, async ({ cue, recs: { player: rec } }) => {
      await focus(rec, p.getByRole("heading", { name: "Join Your Table" }), "join screen", { at: cue("Use Chrome") });
      await expect(p.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 });
      await focus(rec, p.getByText(/Connection status/), "Connection status", { at: cue("connection status line") });
      await type(rec, password, "Table password", "Friday-Table", { at: cue("Type the table password", 0.3), delay: 70 });
      await click(rec, enter, "ENTER TABLE", { at: cue("press Enter", 0.3) });
      await expect(p.getByText("Invalid table password")).toBeVisible({ timeout: 15_000 });
      await focus(rec, p.getByText("Invalid table password"), "error", { at: cue("Get it wrong", 0.3) });
      await focus(rec, password, "typed text", { at: cue("What you typed stays") });
      await focus(rec, password, "case", { at: cue("case sensitive", -0.4) });
      await expect(enter).toBeEnabled({ timeout: 20_000 });
      await type(rec, password, "Table password", FRIDAY, { at: cue("On a built map", -1.8), delay: 45 });
      await click(rec, enter, "ENTER TABLE", { ms: 350 });
      await expect(p.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      await p.waitForFunction(() => Boolean(document.querySelector('[data-testid="map-board"] canvas') && window.__HERO_BYTE_E2E__?.snapshot?.tokens?.some((t) => t.owner === window.__HERO_BYTE_E2E__?.uid)), undefined, { timeout: 20_000 });
      const at = await centreOwnToken(p);
      rec.mark("focus", "your token", { box: { x: at.x - at.cell * 1.5, y: at.y - at.cell * 1.5, width: at.cell * 3, height: at.cell * 3 }, at: cue("the view starts") });
      await rest(p);
    });

    // 2. Switching tables, codes, forgetting (the join screen of the Main Hall address). This
    // tab kept both passwords; a fresh one has not, and picking a table would just walk in.
    await p.evaluate(() => sessionStorage.clear());
    await p.goto("/");
    await expect(enter).toBeVisible({ timeout: 20_000 });
    const picker = p.getByRole("combobox", { name: "Table" });
    const code = p.getByRole("textbox", { name: "Table code" });
    await rest(p);
    await chapter(2, { player: p }, async ({ cue, recs: { player: rec } }) => {
      await focus(rec, picker, "Table picker", { at: cue("A table picker appears") });
      await select(rec, picker, "Table picker", sundayCode, { at: cue("Choose the table", 0.3) });
      await type(rec, password, "Table password", SUNDAY, { at: cue("type its password", 0.2), delay: 45 });
      await hover(rec, enter, "ENTER TABLE", { at: cue("type its password", 1.6), ms: 350 });
      await type(rec, code, "Table code", fridayCode, { at: cue("table code box", 0.1), delay: 30 });
      await hover(rec, p.getByRole("button", { name: "Join", exact: true }), "JOIN", { at: cue("Then press Join", 0.2) });
      await focus(rec, p.getByRole("button", { name: /^Forget / }), "Forget this table", { at: cue("Forget this table drops") });
      await focus(rec, picker, "remembered tables", { at: cue("remembers up to") });
      await rest(p);
    });
    // Off camera: clear the code, and in.
    await code.fill("");
    await enter.click();
    await expect(p.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await rest(p);

    // 3. It remembers you
    await chapter(3, { player: p }, async ({ cue, recs: { player: rec } }) => {
      rec.mark("focus", "reload", { box: { x: 0, y: 0, width: VIEW.width, height: 120 }, at: cue("a reload drops you") });
      await rec.clock.at(cue("a reload drops you", 0.3), p);
      await p.reload();
      await expect(p.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      rec.mark("note", "back in");
      await rec.clock.at(cue("If your connection blips", 0.6), p);
      await socket.drop();
      const notice = p.getByText(/Reconnecting/).first();
      await expect(notice).toBeVisible({ timeout: 15_000 });
      // Its label cycles while it retries: take the box now, pinned to the phrase.
      rec.mark("focus", "Reconnecting", { box: (await notice.boundingBox()) ?? undefined, at: cue("You'll see reconnecting") });
      await rec.clock.at(cue("then re authenticating", -0.4), p);
      await socket.release();
      rec.mark("note", "released");
      await expect(p.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 30_000 });
      await rest(p);
    });

    // 4. One tab, one device: a second tab of the same browser, beside the first.
    const t2 = await playerContext.newPage();
    await t2.goto(sunday);
    const t2Enter = t2.getByRole("button", { name: /Enter Table/i });
    await expect(t2Enter).toBeVisible({ timeout: 20_000 });
    await t2.getByPlaceholder("Table password").fill(SUNDAY);
    await expect(t2Enter).toBeEnabled({ timeout: 20_000 });
    await rest(t2);
    // Chapter 4 deletes the browser's session key to show the held screen; the storage is shared
    // by both tabs, so keep a copy to put back for chapter 5.
    let keys: Record<string, string> = {};
    await chapter(4, { dm: t2, player: p }, async ({ cue, recs }) => {
      const r2 = recs.dm;
      const r1 = recs.player;
      await click(r2, t2Enter, "ENTER TABLE", { at: cue("Open the same table", 0.6) });
      await expect(t2.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      await expect(p.getByText("Opened in another tab")).toBeVisible({ timeout: 20_000 });
      await focus(r1, p.getByText("Opened in another tab"), "paused", { at: cue("older tab pauses") });
      await click(r1, p.getByRole("button", { name: "Reclaim This Tab" }), "RECLAIM THIS TAB", { at: cue("Press Reclaim", 0.4) });
      await expect(p.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      // This browser cannot prove it is still the seat: the second tab, with its session key gone.
      await r2.clock.at(cue("can't prove", 0.2), t2);
      // The key as the Reclaim just left it (it re-mints), for chapter 5.
      keys = await t2.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith("herobyte-session-token:"))));
      await t2.evaluate(() => {
        for (const key of Object.keys(localStorage)) if (key.startsWith("herobyte-session-token:")) localStorage.removeItem(key);
      });
      await t2.reload();
      await expect(t2.getByText("Held in another window")).toBeVisible({ timeout: 20_000 });
      await focus(r2, t2.getByText("Held in another window"), "Held", { at: cue("Held in another window") });
      await click(r2, t2.getByRole("button", { name: "Try Again" }), "TRY AGAIN", { at: cue("Try again once", 0.3) });
      const fresh = t2.getByRole("button", { name: "Start a Fresh Session" });
      await expect(fresh).toBeVisible({ timeout: 20_000 });
      await focus(r2, fresh, "START A FRESH SESSION", { at: cue("start a fresh session appears") });
      await hover(r2, fresh, "START A FRESH SESSION", { at: cue("last resort", -0.6) });
    });
    await t2.close();
    await p.evaluate((saved) => {
      for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
    }, keys);

    // 5. The Main Hall
    await chapter(5, { player: p }, async ({ cue, recs: { player: rec } }) => {
      await rec.clock.at(cue("Every server starts", 0.2), p);
      await p.goto("/");
      await expect(enter).toBeVisible({ timeout: 20_000 });
      rec.mark("note", "join screen");
      await focus(rec, p.getByText("⚠ PUBLIC TEST TABLE"), "public test table", { at: cue("It's a public test table") });
      await type(rec, password, "Table password", MAIN_HALL, { at: cue("passwords are fixed", 0.2), delay: 80 });
      await expect(enter).toBeEnabled({ timeout: 20_000 });
      await click(rec, enter, "ENTER TABLE", { ms: 350 });
      await expect(p.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      await focus(rec, p.getByText(/PUBLIC TEST TABLE/).first(), "marker", { at: cue("public test table marker") });
      await rest(p);
    });
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
