// DM path 4: Build your first room live (docs/website/video-scripts.md).
// A DM on a fresh private table with a player already seated (filmed beside the DM in chapter 5).
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-4
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { enterDMMode } from "../../../apps/e2e/table-role.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, glide, key, rest, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-4-build-your-first-room-live";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TAIL = 2.0;
type Pt = { x: number; y: number };

test("record: DM path 4", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const dmContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  await addCursor(dmContext);
  const dm = await dmContext.newPage();
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
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

  try {
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Build Night");
    await dm.getByLabel("New table password", { exact: true }).fill("build-night");
    await dm.getByLabel("New DM password", { exact: true }).fill("build-night-dm");
    await dm.getByRole("button", { name: "Create private table", exact: true }).click();
    await expect(dm.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
    await enterDMMode(dm, "build-night-dm");
    const dismiss = dm.getByRole("region", { name: "Next steps for the host" }).getByRole("button", { name: "Dismiss next steps", exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    const link = dm.url().replace(/^https?:\/\/[^/]+/, "");
    await player.goto(link);
    await player.getByPlaceholder("Table password").fill("build-night");
    await player.getByRole("button", { name: /Enter Table/i }).click();
    await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    await rest(dm);
    const board = async () => (await dm.locator(".konvajs-content").boundingBox())!;

    // 1. Start a live map
    await chapter(1, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "🏗️ Build map" }), "Build map", { at: cue("Press Build Map", 0.2) });
      await click(rec, dm.getByRole("button", { name: /START LIVE MAP/i }), "START LIVE MAP", { at: cue("then Start Live Map", 0.3) });
      await expect(dm.getByText("● LIVE")).toBeVisible({ timeout: 20_000 });
      await focus(rec, dm.getByText("● LIVE"), "LIVE", { at: cue("The live badge") });
      await focus(rec, dm.getByRole("combobox", { name: "Tool group" }), "Tool group", { at: cue("The tools are grouped") });
      await rest(dm);
    });

    // 2. Pick the room tool
    await chapter(2, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "Room", exact: true }), "Room", { at: cue("pick room", 0.2) });
      await focus(rec, dm.getByRole("group", { name: "Brushes" }), "brush deck", { at: cue("The brush deck") });
      await type(rec, dm.getByRole("searchbox", { name: "Search brushes" }), "Search brushes", "flag", { at: cue("search by name", 0.1), delay: 90 });
      await click(rec, dm.getByRole("button", { name: "Flagstone Floor", exact: true }), "Flagstone Floor", { ms: 400 });
      await focus(rec, dm.getByText("Wall ring:"), "Wall ring", { at: cue("Wall ring picks") });
      await click(rec, dm.getByRole("button", { name: "Stone", exact: true }), "Stone", { at: cue("stone,", 0.1), ms: 300 });
      await rest(dm);
    });

    // 3. Drag a room
    let corners: { a: Pt; b: Pt } = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
    await chapter(3, { dm }, async ({ cue, recs: { dm: rec } }) => {
      const b = await board();
      const a = { x: b.x + b.width * 0.42, y: b.y + b.height * 0.25 };
      const z = { x: b.x + b.width * 0.72, y: b.y + b.height * 0.7 };
      corners = { a, b: z };
      await rec.clock.at(cue("Drag a rectangle", -0.6), dm);
      await glide(dm, a, 400);
      rec.mark("drag", "room", { box: { x: a.x - 30, y: a.y - 30, width: 60, height: 60 } });
      await dm.mouse.down();
      await glide(dm, { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 }, 900);
      rec.mark("focus", "preview", { box: { x: a.x, y: a.y, width: z.x - a.x, height: z.y - a.y }, at: cue("The preview shows") });
      await glide(dm, z, 1200);
      await rec.clock.at(cue("Let go", 0.1), dm);
      await dm.mouse.up();
      rec.mark("drop", "room", { box: { x: a.x, y: a.y, width: z.x - a.x, height: z.y - a.y }, at: cue("Let go") });
      await rest(dm);
    });

    // 4. Undo, redo, Escape
    await chapter(4, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await focus(rec, dm.getByRole("button", { name: "↶ Undo map" }), "Undo map", { at: cue("Undo Map and Redo Map") });
      await key(rec, "Control+z", "Ctrl+Z", { at: cue("Ctrl -Z", 0.1) });
      await key(rec, "Control+y", "Ctrl+Y", { at: cue("Ctrl -Y", 0.1) });
      // A drag cancelled with Escape mid-way.
      const { a, b } = corners;
      const s = { x: b.x + 60, y: a.y };
      await rec.clock.at(cue("Mid -drag", -1.0), dm);
      await glide(dm, s, 350);
      rec.mark("drag", "cancelled", { box: { x: s.x - 30, y: s.y - 30, width: 60, height: 60 } });
      await dm.mouse.down();
      await glide(dm, { x: s.x + 140, y: s.y + 160 }, 700);
      await key(rec, "Escape", "Esc", { at: cue("Escape cancels it", 0.1) });
      await dm.mouse.up();
      await key(rec, "Escape", "Esc", { at: cue("Press Escape again", 0.4) });
      rec.mark("note", "left editor", { at: cue("The map stays live") });
      await click(rec, dm.getByRole("button", { name: "🏗️ Build map" }), "Build map", { at: cue("Open Build Map again", 0.3) });
      await rest(dm);
    });

    // 5. The player's screen, and Player View
    await dm.getByRole("button", { name: "Done building" }).click().catch(() => {});
    await chapter(5, { dm, player }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: "👁 Player View" }), "Player View", { at: cue("press player view", 0.2) });
      await rest(dm);
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
