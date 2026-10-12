// DM path 1: Create a private table (docs/website/video-scripts.md).
// One browser, the would-be DM's, recorded throughout (the "dm" view). It makes Sunday Game, finds
// it again from a second tab, builds a tavern on the Main Hall (off camera) and saves the Main Hall
// as a private table of its own, then opens that table's Security.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-1
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { enterDMMode } from "../../../apps/e2e/table-role.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, hover, rest, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-1-create-a-private-table";
const OUT = path.resolve(here, "..", "footage", LESSON);
const MAIN_HALL = process.env.E2E_ROOM_PASSWORD ?? "Fun1";
const MAIN_HALL_DM = process.env.E2E_DM_PASSWORD ?? "FunDM";
const TAIL = 2.0;

test("record: DM path 1", async ({ browser }) => {
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

  try {
    await dm.goto("/");
    const enter = dm.getByRole("button", { name: /Enter Table/i });
    await expect(enter).toBeVisible({ timeout: 20_000 });
    await expect(dm.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 });
    await rest(dm);

    // 1. Main Hall or private table
    await chapter(1, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await focus(rec, dm.getByText("⚠ PUBLIC TEST TABLE"), "Main Hall", { at: cue("starts with the main hall") });
      await focus(rec, dm.getByRole("button", { name: "▦ New Table" }), "New Table", { at: cue("make a private table") });
      await rest(dm);
    });

    // 2. The NEW TABLE form
    let link = "";
    await chapter(2, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "▦ New Table" }), "NEW TABLE", { at: cue("Press New Table", 0.3) });
      await type(rec, dm.getByLabel("New table name", { exact: true }), "Table name", "Sunday Game", { at: cue("A name helps", 0.2), delay: 60 });
      await type(rec, dm.getByLabel("New table password", { exact: true }), "Table password", "sunday-game", { at: cue("The table password is", 0.3), delay: 60 });
      await type(rec, dm.getByLabel("New DM password", { exact: true }), "DM password", "sunday-game-dm", { at: cue("The DM password is optional", 0.3), delay: 50 });
      await click(rec, dm.getByRole("button", { name: "Create private table", exact: true }), "CREATE PRIVATE TABLE", { at: cue("Press Create Private Table", 0.3) });
      await expect(dm.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
      link = dm.url().replace(/^https?:\/\/[^/]+/, "");
      await focus(rec, dm.getByRole("region", { name: "Next steps for the host" }), "next steps", { at: cue("random table code") });
      await focus(rec, dm.getByRole("button", { name: /^Table menu/ }), "ordinary player", { at: cue("ordinary player", -0.6) });
      await rest(dm);
    });

    // 3. Finding it again: the same browser, a fresh tab, at the table's link.
    const t2 = await context.newPage();
    await t2.goto(link);
    await expect(t2.getByRole("button", { name: /Enter Table/i })).toBeVisible({ timeout: 20_000 });
    await rest(t2);
    await chapter(3, { dm: t2 }, async ({ cue, recs: { dm: rec } }) => {
      await focus(rec, t2.getByRole("combobox", { name: "Table" }), "Table picker", { at: cue("lists your tables by name", -0.6) });
      await focus(rec, t2.getByRole("combobox", { name: "Table" }), "remembers", { at: cue("remembers up to") });
      await focus(rec, t2.getByRole("button", { name: /^Forget / }), "Forget this table", { at: cue("Forget this table removes") });
      await hover(rec, t2.getByRole("button", { name: /^Forget / }), "Forget this table", { at: cue("Forget this table removes", 0.6) });
    });
    await t2.close();

    // Off camera: on the Main Hall, as its DM, kick in a tavern worth keeping.
    await dm.goto("/");
    await dm.getByPlaceholder("Table password").fill(MAIN_HALL);
    await expect(enter).toBeEnabled({ timeout: 20_000 });
    await enter.click();
    await expect(dm.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await enterDMMode(dm, MAIN_HALL_DM);
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
    await panel.getByLabel("Name").fill("The Copper Kettle");
    await dm.getByRole("button", { name: "🚪 Generate & enter" }).click();
    await dm.waitForFunction(() => {
      const data = window.__HERO_BYTE_E2E__;
      const node = data?.snapshot?.atlasNodes?.find((n) => n.id === data.snapshot?.currentAtlasNodeId);
      return node?.name === "The Copper Kettle";
    }, undefined, { timeout: 40_000 });
    await dm.waitForTimeout(1_000);
    await rest(dm);

    // 4. Keeping a Main Hall build
    const menuTab = (name: string) => dm.getByRole("button", { name, exact: true });
    await chapter(4, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("In the DM menu", 0.2) });
      await click(rec, menuTab("Table"), "Table", { at: cue("open Table", 0.2) });
      const security = dm.getByRole("region", { name: "Security" });
      await focus(rec, security, "Security", { at: cue("then Security", 0.1) });
      await type(rec, security.getByRole("textbox", { name: "Table name" }), "Table name", "Copper Kettle Campaign", { at: cue("Give it a name", 0.2), delay: 35 });
      await type(rec, security.getByRole("textbox", { name: /^Table password/ }), "Table password", "copper-kettle", { delay: 35, ms: 250 });
      await type(rec, security.getByRole("textbox", { name: /^DM password/ }), "DM password", "copper-kettle-dm", { delay: 35, ms: 250 });
      await click(rec, security.getByRole("button", { name: "Save & Go There" }), "SAVE & GO THERE", { at: cue("press Save and go there", 0.3) });
      await expect(dm.getByRole("button", { name: /^Table menu: Copper Kettle Campaign/ }).or(dm.getByPlaceholder("Table password"))).toBeVisible({ timeout: 30_000 });
      rec.mark("note", "arrived", { at: cue("Everything comes across") });
      await rest(dm);
    });

    // Off camera: in as the copy's DM.
    const pw = dm.getByPlaceholder("Table password");
    if (await pw.isVisible().catch(() => false)) {
      await pw.fill("copper-kettle");
      await dm.getByRole("button", { name: /Enter Table/i }).click();
    }
    await expect(dm.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 30_000 });
    await enterDMMode(dm, "copper-kettle-dm");
    const dismiss = dm.getByRole("region", { name: "Next steps for the host" }).getByRole("button", { name: "Dismiss next steps", exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await rest(dm);

    // 5. Changing the password
    await chapter(5, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("On a private table", 0.2) });
      await click(rec, menuTab("Table"), "Table", { ms: 350 });
      const security = dm.getByRole("region", { name: "Security" });
      await focus(rec, security.getByRole("button", { name: /Change table password/i }).first(), "Change table password", { at: cue("has change table password", 0.2) });
      await focus(rec, security.getByRole("button", { name: /Reset to default/i }).first(), "Reset to default", { at: cue("Reset to default gives", 0.1) });
      await hover(rec, security.getByRole("button", { name: /Reset to default/i }).first(), "Reset to default", { at: cue("Don't use it", 0.1) });
      await rest(dm);
    });
  } finally {
    await context.close();
  }
});
