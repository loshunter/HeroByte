// DM path 6: NPCs and the token library (docs/website/video-scripts.md).
// A DM on a fresh private table with the battlemap from DM path 3 as its background; a player
// joins off camera and is filmed beside the DM for the hide-and-reveal in chapter 5. The camera
// starts away from the map's top-left corner, so Place on Map visibly lands out of view.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-6
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { closeTopWindow, setStagingZone } from "../../../apps/e2e/docs-shots.helpers";
import { enterDMMode } from "../../../apps/e2e/table-role.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, glide, rest, select, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-6-npcs-and-the-token-library";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TAIL = 2.0;
type Pt = { x: number; y: number };

/** Screen centre of the token belonging to the NPC named `name`. */
async function tokenAt(page: Page, name: string): Promise<Pt> {
  return page.evaluate((name) => {
    const data = window.__HERO_BYTE_E2E__!;
    const snap = data.snapshot!;
    const npc = snap.characters.find((c) => c.name === name)!;
    const token = snap.tokens.find((t) => t.id === npc.tokenId)!;
    const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
    const cam = data.cam!;
    const g = data.gridSize;
    return { x: board.left + cam.x + (token.x + 0.5) * g * cam.scale, y: board.top + cam.y + (token.y + 0.5) * g * cam.scale };
  }, name);
}

test("record: DM path 6", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const dmContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  const playerContext = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  for (const c of [dmContext, playerContext]) {
    await addCursor(c);
    c.setDefaultTimeout(30_000);
  }
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();
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
  const setCam = (page: Page, cam: { x: number; y: number; scale: number }) => page.evaluate((c) => window.__HERO_BYTE_E2E__!.setCam!(c), cam);
  /** The DM Menu card whose Name field holds `name`. */
  const card = (name: string) => dm.locator(`input[value="${name}"]`).locator("xpath=ancestor::*[3]");
  const npcNames = () => dm.evaluate(() => (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter((c) => c.type === "npc").map((c) => c.name));

  try {
    // --- Off camera: the table, its battlemap, a seated player.
    await dm.goto("/");
    await dm.getByRole("button", { name: /New Table/i }).click();
    await dm.getByLabel("New table name", { exact: true }).fill("Ogre Night");
    await dm.getByLabel("New table password", { exact: true }).fill("ogre-night");
    await dm.getByLabel("New DM password", { exact: true }).fill("ogre-night-dm");
    await dm.getByRole("button", { name: "Create private table", exact: true }).click();
    await expect(dm.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
    await enterDMMode(dm, "ogre-night-dm");
    const dismiss = dm.getByRole("region", { name: "Next steps for the host" }).getByRole("button", { name: "Dismiss next steps", exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await dm.getByRole("button", { name: /DM MENU/i }).click();
    await dm.getByRole("button", { name: "Maps", exact: true }).click();
    const chooser = dm.waitForEvent("filechooser");
    await dm.getByRole("region", { name: "Current table map" }).getByRole("button", { name: "⬆ Upload image" }).click();
    await (await chooser).setFiles(path.join(here, "assets", "battlemap.png"));
    await expect(dm.getByText(/On table:/)).not.toContainText("no map yet", { timeout: 20_000 });
    // The player spawns mid-map, clear of the corner where Place on Map drops NPCs.
    await setStagingZone(dm, { x: 11, y: 8, w: 2, h: 2 });
    await closeTopWindow(dm);
    await player.goto(dm.url().replace(/^https?:\/\/[^/]+/, ""));
    await player.getByPlaceholder("Table password").fill("ogre-night");
    await player.getByRole("button", { name: /Enter Table/i }).click();
    await expect(player.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
    // The DM's own token starts at the corner too; move it beside the player's, so the corner is
    // the Ogre's alone.
    await dm.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      const own = data.snapshot!.characters.find((c) => c.ownedByPlayerUID === data.uid && c.tokenId);
      if (own) data.sendMessage!({ t: "move", id: own.tokenId!, x: 13, y: 8 } as never);
    });
    // The middle of the map, well away from its top-left corner.
    const away = { x: -420, y: -300, scale: 1 };
    await setCam(dm, away);
    await rest(dm);

    // 1. Add an NPC
    await chapter(1, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("Open the DM menu", 0.2) });
      await click(rec, dm.getByRole("button", { name: "NPCs & Monsters", exact: true }), "NPCs & Monsters", { at: cue("then NPCs", 0.2) });
      await click(rec, dm.getByRole("button", { name: "+ Add NPC" }), "+ Add NPC", { at: cue("Press Add NPC", 0.2) });
      // The only card yet; a card(name) locator would lose its field the moment it is cleared.
      await type(rec, dm.getByRole("textbox", { name: "Name", exact: true }).first(), "Name", "Ogre", { at: cue("has a name", -0.2), delay: 80 });
      const ogre = card("Ogre");
      await ogre.getByRole("textbox", { name: "Name" }).press("Tab");
      await type(rec, ogre.getByRole("spinbutton", { name: "HP", exact: true }), "HP", "59", { at: cue("HP,", 0.1), delay: 80 });
      await type(rec, ogre.getByRole("spinbutton", { name: "Max HP" }), "Max HP", "59", { delay: 60 });
      await focus(rec, ogre.getByRole("spinbutton", { name: "Temp HP" }), "Temp HP", { at: cue("Temp HP") });
      await type(rec, ogre.getByRole("spinbutton", { name: "Init Mod" }), "Init Mod", "-1", { at: cue("an initiative modifier", 0.2), delay: 80 });
      await ogre.getByRole("spinbutton", { name: "Init Mod" }).press("Tab");
      // The bundled pack's ogre art, by link (any image link works the same way).
      await type(rec, ogre.getByRole("textbox", { name: "Portrait URL" }), "portrait", "/tokens/Medium/NPC/Enemies/Ogres/ogreClub.png", { at: cue("a portrait", -0.4), delay: 12 });
      await ogre.getByRole("textbox", { name: "Portrait URL" }).press("Tab");
      await type(rec, ogre.getByRole("textbox", { name: "Token Image URL" }), "token art", "/tokens/NPC/Enemies/Ogres/ogreClub.png", { at: cue("token art", 0.1), delay: 12 });
      await ogre.getByRole("textbox", { name: "Token Image URL" }).press("Tab");
      rec.mark("note", "players can't", { at: cue("Players can't rename") });
      await rest(dm);
    });

    // 2. Place it and find it
    await chapter(2, { dm }, async ({ cue, recs: { dm: rec } }) => {
      const ogre = card("Ogre");
      await click(rec, ogre.getByRole("button", { name: "Place on Map" }), "Place on Map", { at: cue("Place on Map drops", 0.2) });
      rec.mark("note", "not the middle", { at: cue("Not the middle") });
      await click(rec, ogre.getByRole("button", { name: "Focus Ogre" }), "Focus", { at: cue("Press Focus", 0.2) });
      await dm.waitForTimeout(700);
      const from = await tokenAt(dm, "Ogre");
      const to = { x: from.x + 260, y: from.y + 130 };
      await rec.clock.at(cue("then drag it", -0.2), dm);
      await glide(dm, from, 350);
      rec.mark("drag", "Ogre", { box: { x: from.x - 30, y: from.y - 30, width: 60, height: 60 } });
      await dm.mouse.down();
      await dm.waitForTimeout(120);
      await glide(dm, to, 900);
      await dm.mouse.up();
      rec.mark("drop", "Ogre", { box: { x: to.x - 40, y: to.y - 40, width: 80, height: 80 } });
      await click(rec, ogre.getByRole("button", { name: "Place on Map" }), "Place again", { at: cue("Pressing Place again", 0.3) });
      await rest(dm);
    });

    // 3. A pack at once
    await chapter(3, { dm }, async ({ cue, recs: { dm: rec } }) => {
      const count = dm.getByRole("spinbutton", { name: "How many NPCs to add" });
      await type(rec, count, "how many", "5", { at: cue("Set the number field", 0.3), delay: 80 });
      await focus(rec, dm.getByRole("button", { name: /Add 5 NPCs/i }), "Add 5 NPCs", { at: cue("the button says") });
      await click(rec, dm.getByRole("button", { name: /Add 5 NPCs/i }), "Add 5 NPCs", { at: cue("5 arrive", -0.3) });
      await expect.poll(async () => (await npcNames()).length).toBe(6);
      rec.mark("note", "numbered", { at: cue("5 arrive") });
      rec.mark("note", "second batch", { at: cue("A second batch") });
      const dup = card("Ogre").getByRole("button", { name: "⧉ Duplicate" });
      await dup.scrollIntoViewIfNeeded();
      await click(rec, dup, "Duplicate", { at: cue("Duplicate copies", 0.2) });
      await expect.poll(async () => (await npcNames()).length).toBe(7);
      rec.mark("note", "next free", { at: cue("next free number") });
      await rest(dm);
    });

    // 4. The library
    let archer = "";
    await chapter(4, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await dm.getByRole("spinbutton", { name: "How many NPCs to add" }).fill("1");
      await dm.getByRole("spinbutton", { name: "How many NPCs to add" }).scrollIntoViewIfNeeded();
      await click(rec, dm.getByRole("button", { name: "📖 Library" }).first(), "Library", { at: cue("Library opens", 0.2) });
      const lib = dm.getByTestId("token-library");
      await expect(lib).toBeVisible();
      await focus(rec, lib.getByRole("group", { name: "Token category" }), "categories", { at: cue("Monsters and townsfolk") });
      await click(rec, lib.getByRole("button", { name: "Monsters", exact: true }), "Monsters", { at: cue("narrow it", 0.3) });
      await select(rec, lib.getByLabel("Family"), "Family", "Goblins", { at: cue("then family", 0.1) });
      await type(rec, lib.getByRole("searchbox", { name: "Search" }), "Search", "goblin archer", { at: cue("Goblin Archer finds", -0.3), delay: 70 });
      const before = await npcNames();
      await click(rec, lib.getByRole("button", { name: "Goblin shortbow archer" }), "Goblin shortbow archer", { at: cue("Click a token", 0.3) });
      await expect.poll(async () => (await npcNames()).length).toBe(before.length + 1);
      archer = (await npcNames()).find((n) => !before.includes(n))!;
      const place = card(archer).getByRole("button", { name: "Place on Map" });
      await place.scrollIntoViewIfNeeded();
      await focus(rec, card(archer).getByRole("textbox", { name: "Name" }), "new NPC", { at: cue("arrives as a new") });
      await click(rec, place, "Place on Map", { at: cue("Press Place on Map", 0.3) });
      const count = dm.getByRole("spinbutton", { name: "How many NPCs to add" });
      await count.scrollIntoViewIfNeeded();
      await focus(rec, count, "number field", { at: cue("The number field") });
      await rest(dm);
    });

    // Off camera: a closed chest from the library, placed; then the menu closes so the Party
    // roster is in reach. Both cameras look at the corner where everything was placed.
    await dm.getByTestId("token-library").getByRole("searchbox", { name: "Search" }).fill("");
    await dm.getByTestId("token-library").getByLabel("Family").selectOption("Mimics");
    const beforeChest = await npcNames();
    await dm.getByTestId("token-library").getByRole("button", { name: "Closed chest" }).click();
    await expect.poll(async () => (await npcNames()).length).toBe(beforeChest.length + 1);
    const chest = (await npcNames()).find((n) => !beforeChest.includes(n))!;
    await card(chest).getByRole("button", { name: "Place on Map" }).click();
    await card(chest).getByLabel("Stance").selectOption({ label: "Neutral" });
    await closeTopWindow(dm);
    const corner = { x: 120, y: 90, scale: 1.3 };
    await setCam(dm, corner);
    await setCam(player, corner);
    await rest(dm);

    // 5. Hide, stance and mimics
    await chapter(5, { dm, player }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm.getByRole("button", { name: `${archer} (Enemy): details` }), "archer row", { at: cue("Select an NPC's row", 0.2) });
      await click(rec, dm.getByRole("button", { name: `Hide ${archer} from players` }), "eye", { at: cue("The eye hides it", 0.2) });
      await click(rec, dm.getByRole("button", { name: `Show ${archer} to players` }), "eye", { at: cue("reveal it on the pounce", 0.2) });
      await dm.getByRole("button", { name: /DM MENU/i }).click();
      await dm.getByRole("button", { name: "NPCs & Monsters", exact: true }).click();
      const stance = card("Ogre").getByLabel("Stance");
      await stance.scrollIntoViewIfNeeded();
      await select(rec, stance, "Stance", "Ally", { at: cue("or ally", 0.1) });
      rec.mark("note", "colour", { at: cue("sets the card's") });
      const reveal = card(chest).getByRole("button", { name: "🎭 Reveal mimic" });
      await reveal.scrollIntoViewIfNeeded();
      await focus(rec, card(chest).getByRole("textbox", { name: "Name" }), "closed chest", { at: cue("Place the closed chest") });
      await click(rec, reveal, "Reveal mimic", { at: cue("press reveal mimic", 0.2) });
      await rest(dm);
    });

    // 6. Your own tokens
    await chapter(6, { dm }, async ({ cue, recs: { dm: rec } }) => {
      const lib = dm.getByTestId("token-library");
      if (!(await lib.isVisible().catch(() => false))) await dm.getByRole("button", { name: "📖 Library" }).first().click();
      await click(rec, lib.getByRole("button", { name: "This table", exact: true }), "This table", { at: cue("This Table shelf", 0.1) });
      const form = dm.getByTestId("custom-token-form");
      await form.scrollIntoViewIfNeeded();
      await focus(rec, form.getByRole("textbox", { name: "Image" }), "image", { at: cue("Add your own") });
      await form.getByLabel("Image upload").setInputFiles(path.join(here, "assets", "innkeeper-token.png"));
      await type(rec, form.getByLabel("Name"), "Name", "Innkeeper", { at: cue("Give it a name", 0.3), delay: 60 });
      await type(rec, form.getByRole("textbox", { name: "Tags" }), "Tags", "innkeeper", { at: cue("tags", 0.1), delay: 50 });
      await click(rec, form.getByRole("button", { name: "ally" }), "ally", { at: cue("a stance", 0.1), ms: 250 });
      await click(rec, form.getByRole("button", { name: "＋ Add to library" }), "Add to library", { at: cue("it searches like", 0.1), ms: 300 });
      rec.mark("note", "never receive", { at: cue("Players never receive") });
      await rest(dm);
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
