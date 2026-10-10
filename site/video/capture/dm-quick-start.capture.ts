// DM quick start: Set up your table before game night (docs/website/video-scripts.md).
// One continuous session, recorded chapter by chapter in step with Wren's narration. Every action
// carries `at`, the moment in the narration it belongs to, so the edit can put it exactly there.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-quick-start
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "../../../apps/e2e/fixtures";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, clickPoint, focus, hover, key, rest, select, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-quick-start-set-up-your-table-before-game-night";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TABLE_PASSWORD = "sunday-table";
const DM_PASSWORD = "sunday-dm-pass";
const TAIL = 2.5; // seconds recorded after the narration (or the last action) ends

test("record: DM quick start", async ({ browser }) => {
  test.setTimeout(600_000);
  const chapters = loadCues(LESSON);
  const open = async () => {
    const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await addCursor(context);
    return { context, page: await context.newPage() };
  };
  const { context: dmContext, page: dm } = await open();
  const { context: playerContext, page: player } = await open();
  dm.on("dialog", (d) => void d.accept());

  type Ctx = { cue: (phrase: string, offset?: number) => number; dmRec: Recording; playerRec: Recording };
  /** Record one chapter; recording stops at max(narration end, last action) + TAIL. */
  async function chapter(n: number, pages: { dm: typeof dm; player?: typeof dm }, run: (c: Ctx) => Promise<void>) {
    const { cue, duration } = chapters(n);
    const clock = new Clock(`ch${n}`);
    const recs = Object.entries(pages).map(([who, page]) => new Recording(page!, path.join(OUT, `ch${n}`, who), clock));
    for (const rec of recs) await rec.start();
    await run({ cue, dmRec: recs[0], playerRec: recs[1] });
    await clock.at(Math.max(duration, clock.now()) + TAIL, dm);
    for (const rec of recs) await rec.stop(clock.now());
  }

  try {
    await dm.goto("/");
    await expect(dm.getByPlaceholder("Table password")).toBeEnabled({ timeout: 20_000 });
    await rest(dm);

    // 1. Make a table
    await chapter(1, { dm }, async ({ cue, dmRec }) => {
      const newTable = dm.getByRole("button", { name: /New Table/i });
      await focus(dmRec, newTable, "NEW TABLE", { at: cue("Real games live") });
      await click(dmRec, newTable, "NEW TABLE", { at: cue("New Table", 0.1) });
      await type(dmRec, dm.getByLabel("New table name"), "Table name", "Sunday Game", { at: cue("a name", 0.1) });
      await type(dmRec, dm.getByLabel("New table password"), "Table password", TABLE_PASSWORD, { at: cue("table password", 0.1), delay: 45 });
      await type(dmRec, dm.getByLabel("New DM password"), "DM password", DM_PASSWORD, { at: cue("DM password", 0.1), delay: 45 });
      await rest(dm, { x: VIEW.width * 0.7, y: VIEW.height * 0.7 });
      const create = dm.getByRole("button", { name: "Create private table" });
      await click(dmRec, create, "CREATE PRIVATE TABLE", { at: cue("Create Private Table", 0.15) });
      await expect(dm.getByRole("region", { name: "Next steps for the host" })).toBeVisible({ timeout: 20_000 });
      dmRec.mark("note", "table open");
      await rest(dm);
    });

    // 2. Claim the DM seat
    const card = dm.getByRole("region", { name: "Next steps for the host" });
    await chapter(2, { dm }, async ({ cue, dmRec }) => {
      await focus(dmRec, card, "Next steps card", { at: cue("This card") });
      await click(dmRec, card.getByRole("button", { name: "Enter DM mode", exact: true }), "Enter DM mode", { at: cue("Enter DM mode", 0.1) });
      await type(dmRec, dm.locator("input[type='password']:visible").first(), "DM password", DM_PASSWORD, { at: cue("type your DM password", 0.2), delay: 40 });
      const confirm = dm.getByRole("dialog", { name: "Enter DM mode" }).getByRole("button", { name: "Enter DM mode", exact: true });
      await click(dmRec, confirm, "ENTER DM MODE", { ms: 350 });
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 15_000 });
      dmRec.mark("note", "DM mode on");
      await rest(dm);
      await hover(dmRec, dm.getByRole("button", { name: /^Table menu:/ }), "Table button", { at: cue("table button", 0.2) });
      await rest(dm);
    });

    // 3. Put a map down
    await chapter(3, { dm }, async ({ cue, dmRec }) => {
      await click(dmRec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("DM menu", 0.1) });
      await click(dmRec, dm.getByRole("button", { name: "Maps", exact: true }), "Maps", { at: cue("Maps", 0.1), ms: 400 });
      await hover(dmRec, dm.getByRole("button", { name: "Upload image" }).first(), "Upload image", { at: cue("Lesson 3"), ms: 400 });
      await click(dmRec, dm.getByRole("button", { name: "Close Dungeon Master Tools" }), "Close", { at: cue("To build one here", 0.2), ms: 400 });
      await click(dmRec, dm.getByTitle("Author the live map on the table"), "Build map", { at: cue("Build Map", 0.1) });
      await click(dmRec, dm.getByRole("button", { name: /START LIVE MAP/i }), "START LIVE MAP", { at: cue("Start Live Map", 0.15) });
      await expect(dm.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
      await focus(dmRec, dm.getByText("● LIVE"), "LIVE badge");
      await rest(dm);
      await key(dmRec, "Escape", "Esc", { at: cue("Escape", 0.15) });
      // G needs the map focused: a quiet click on an empty corner first.
      const board = await dm.locator(".konvajs-content").boundingBox();
      await clickPoint(dmRec, dm.locator(".konvajs-content"), board!.width * 0.8, board!.height * 0.45, "map", { at: cue("the fun one", 0.4) });
      await key(dmRec, "g", "G", { at: cue("G", 0.05) });
      const panel = dm.getByRole("dialog", { name: "Kick in a door" });
      await expect(panel).toBeVisible({ timeout: 15_000 });
      await focus(dmRec, panel, "Kick in a door");
      await select(dmRec, panel.getByLabel("Recipe"), "Recipe", "building", { at: cue("Pick a recipe", 0.2) });
      await select(dmRec, panel.getByLabel("Kind"), "Kind", "tavern", { ms: 240 });
      await select(dmRec, panel.getByLabel("Size"), "Size", "small", { ms: 240 });
      await type(dmRec, panel.getByLabel("Name"), "Name", "The Salt Hound", { ms: 260, delay: 30 });
      await click(dmRec, dm.getByRole("button", { name: "🚪 Generate & enter" }), "Generate & enter", { at: cue("Generate and Enter", 0.15), ms: 350 });
      await dm.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          const here = data?.snapshot?.atlasNodes?.find((node) => node.id === data.snapshot?.currentAtlasNodeId);
          return here?.name === "The Salt Hound";
        },
        undefined,
        { timeout: 40_000 },
      );
      dmRec.mark("note", "arrived", { at: cue("builds a stocked place") });
      await rest(dm);
      // Frame the building rather than wherever the arrival camera landed, as the screenshot
      // harness does, and let the terrain finish painting.
      await dm.waitForTimeout(600);
      await dm.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const scene = data.snapshot!.compiledScene!;
        const board = document.querySelector('[data-testid="map-board"]')!;
        const box = board.getBoundingClientRect();
        // Right of the next-steps card, and above the Party bar.
        const scale = Math.min(box.width / scene.width, box.height / scene.height) * 0.78;
        data.setCam!({ x: box.width * 0.6 - (scene.width / 2) * scale, y: box.height * 0.56 - (scene.height / 2) * scale, scale });
      });
      dmRec.mark("note", "framed");
      await dm.waitForTimeout(3_500);
    });

    // 4. Send the invite (and the player follows it)
    await chapter(4, { dm, player }, async ({ cue, dmRec, playerRec }) => {
      const invite = card.getByRole("button", { name: /Invite players|Copied/ });
      if (await invite.isVisible().catch(() => false)) {
        await click(dmRec, invite, "Invite players", { at: cue("Invite Players", 0.1) });
      } else dmRec.mark("note", "next-steps card gone; invite from the DM menu only");
      await click(dmRec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("DM menu", 0.1), ms: 450 });
      await click(dmRec, dm.getByRole("button", { name: "Table", exact: true }), "Table", { at: cue("under Table", 0.3), ms: 400 });
      const copy = dm.getByRole("button", { name: /Copy invite link|Copied/ });
      await hover(dmRec, copy, "Copy invite link", { at: cue("then Invite", 0.3), ms: 400 });
      const link = (await dm.locator("code", { hasText: "/?room=" }).first().textContent())!.trim();
      await player.goto(link.replace(/^https?:\/\/[^/]+/, ""));
      await expect(player.getByPlaceholder("Table password")).toBeEnabled({ timeout: 20_000 });
      playerRec.mark("note", "invite opened", { at: cue("Send the password") });
      await click(dmRec, dm.getByRole("button", { name: "Close Dungeon Master Tools" }), "Close", { ms: 400 });
      await rest(dm);
      await type(playerRec, player.getByPlaceholder("Table password"), "Table password", TABLE_PASSWORD, { at: cue("does not carry it", 0.3), delay: 55 });
      await click(playerRec, player.getByRole("button", { name: /Enter Table/i }), "ENTER TABLE", { at: cue("next 10 minutes"), ms: 400 });
      await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      playerRec.mark("note", "player in");
      await rest(player);
    });

    // 5. See what they see
    await chapter(5, { dm, player }, async ({ cue, dmRec }) => {
      await click(dmRec, dm.getByRole("button", { name: /Player View/ }), "Player View", { at: cue("Player View", 0.15) });
      await rest(dm);
      await click(dmRec, dm.getByRole("button", { name: /Player View/ }), "Player View", { at: cue("Press it again", 0.3) });
      await rest(dm);
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
