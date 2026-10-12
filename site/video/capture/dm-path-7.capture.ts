// DM path 7: Run your first combat (docs/website/video-scripts.md).
// A DM on a fresh private table with the battlemap from DM path 3; two players join off camera
// (Kael and Mira, speed 30 ft), three library goblins are placed in front of them. Kael is filmed
// beside the DM in chapters 2 and 5.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-7
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { closeTopWindow, setStagingZone } from "../../../apps/e2e/docs-shots.helpers";
import { enterDMMode } from "../../../apps/e2e/table-role.helpers";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, glide, rest } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-7-run-your-first-combat";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TAIL = 2.0;
type Pt = { x: number; y: number };
const CAM = { x: -80, y: -60, scale: 1.1 };

async function join(page: Page, link: string, name: string) {
  await page.goto(link);
  await page.getByPlaceholder("Table password").fill("goblin-night");
  await page.getByRole("button", { name: /Enter Table/i }).click();
  await page.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.characters?.some((c) => c.ownedByPlayerUID === window.__HERO_BYTE_E2E__?.uid)), undefined, { timeout: 20_000 });
  await page.evaluate((n) => {
    const data = window.__HERO_BYTE_E2E__!;
    const own = data.snapshot!.characters.find((c) => c.ownedByPlayerUID === data.uid)!;
    data.sendMessage!({ t: "update-character-name", characterId: own.id, name: n });
    data.sendMessage!({ t: "rename", name: n });
  }, name);
}

/** Screen centre of the token of the character named `name`, on `page`. */
async function tokenAt(page: Page, name: string): Promise<Pt & { g: number }> {
  return page.evaluate((name) => {
    const data = window.__HERO_BYTE_E2E__!;
    const snap = data.snapshot!;
    const c = snap.characters.find((ch) => ch.name === name)!;
    const token = snap.tokens.find((t) => t.id === c.tokenId)!;
    const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
    const cam = data.cam!;
    const g = data.gridSize * cam.scale;
    return { x: board.left + cam.x + (token.x + 0.5) * g, y: board.top + cam.y + (token.y + 0.5) * g, g };
  }, name);
}

test("record: DM path 7", async ({ browser }) => {
  test.setTimeout(900_000);
  const chapters = loadCues(LESSON);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF })));
  for (const c of contexts) {
    await addCursor(c);
    c.setDefaultTimeout(30_000);
  }
  const [dm, kael, mira] = await Promise.all(contexts.map((c) => c.newPage()));
  dm!.on("dialog", (d) => void d.accept());

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
  const send = (page: Page, message: unknown) => page.evaluate((m) => window.__HERO_BYTE_E2E__!.sendMessage!(m as never), message);
  const snap = (page: Page) => page.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!);
  const setCam = (page: Page) => page.evaluate((c) => window.__HERO_BYTE_E2E__!.setCam!(c), CAM);
  const enc = () => dm!.locator(".encounter");
  const holderName = async () => {
    const s = await snap(dm!);
    return s.characters.find((c) => c.id === s.currentTurnCharacterId)?.name;
  };
  /** Roll initiative from the player's own card: Party → own row → INIT → Roll d20 now. */
  async function rollFromCard(page: Page, rec: Recording | null, at?: { init?: number; roll?: number }) {
    const own = await page.evaluate(() => {
      const data = window.__HERO_BYTE_E2E__!;
      return data.snapshot!.characters.find((c) => c.ownedByPlayerUID === data.uid)!.name;
    });
    const row = page.getByRole("button", { name: `${own} (You): details` });
    const init = page.getByRole("button", { name: "Set Initiative" });
    const roll = page.getByRole("button", { name: "Roll d20 now" });
    if (rec) {
      await click(rec, row, "own row", { at: at?.init === undefined ? undefined : at.init - 1.2, ms: 300 });
      await click(rec, init, "INIT", { at: at?.init });
      await click(rec, roll, "ROLL D20 NOW", { at: at?.roll });
    } else {
      await row.click();
      await init.click();
      await roll.click();
    }
  }

  try {
    // --- Off camera: the table, its map, two players, three goblins.
    await dm!.goto("/");
    await dm!.getByRole("button", { name: /New Table/i }).click();
    await dm!.getByLabel("New table name", { exact: true }).fill("Goblin Night");
    await dm!.getByLabel("New table password", { exact: true }).fill("goblin-night");
    await dm!.getByLabel("New DM password", { exact: true }).fill("goblin-night-dm");
    await dm!.getByRole("button", { name: "Create private table", exact: true }).click();
    await expect(dm!.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
    await enterDMMode(dm!, "goblin-night-dm");
    const dismiss = dm!.getByRole("region", { name: "Next steps for the host" }).getByRole("button", { name: "Dismiss next steps", exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await dm!.getByRole("button", { name: /DM MENU/i }).click();
    await dm!.getByRole("button", { name: "Maps", exact: true }).click();
    const chooser = dm!.waitForEvent("filechooser");
    await dm!.getByRole("region", { name: "Current table map" }).getByRole("button", { name: "⬆ Upload image" }).click();
    await (await chooser).setFiles(path.join(here, "assets", "battlemap.png"));
    await expect(dm!.getByText(/On table:/)).not.toContainText("no map yet", { timeout: 20_000 });
    await setStagingZone(dm!, { x: 7, y: 7, w: 2, h: 2 });
    await dm!.getByRole("button", { name: "NPCs & Monsters", exact: true }).click();
    await dm!.getByLabel("How many NPCs to add").fill("3");
    await dm!.getByRole("button", { name: "📖 Library" }).first().click();
    await dm!.getByTestId("token-library").getByRole("searchbox", { name: "Search" }).fill("goblin club");
    await dm!.getByRole("button", { name: "Goblin club brute", exact: true }).click();
    await expect.poll(async () => (await snap(dm!)).characters.filter((c) => c.type === "npc").length).toBe(3);
    const goblins = (await snap(dm!)).characters.filter((c) => c.type === "npc");
    for (const g of goblins) await send(dm!, { t: "place-npc-token", id: g.id });
    await expect.poll(async () => (await snap(dm!)).characters.filter((c) => c.type === "npc" && c.tokenId).length).toBe(3);
    const spots = [{ x: 13, y: 5 }, { x: 14, y: 7 }, { x: 13, y: 9 }];
    for (const [i, g] of (await snap(dm!)).characters.filter((c) => c.type === "npc").entries()) await send(dm!, { t: "move", id: g.tokenId!, x: spots[i]!.x, y: spots[i]!.y });
    await dm!.getByLabel("How many NPCs to add").fill("1");
    await closeTopWindow(dm!);
    const link = dm!.url().replace(/^https?:\/\/[^/]+/, "");
    await join(kael!, link, "Kael");
    await join(mira!, link, "Mira");
    await expect.poll(async () => (await snap(dm!)).characters.filter((c) => c.type !== "npc" && c.tokenId && ["Kael", "Mira"].includes(c.name)).length).toBe(2);
    for (const c of (await snap(dm!)).characters.filter((ch) => ["Kael", "Mira"].includes(ch.name))) await send(dm!, { t: "set-character-speed", characterId: c.id, speed: 30 });
    for (const p of [dm!, kael!, mira!]) await setCam(p);
    await rest(dm!);

    // 1. The Encounter tab
    await chapter(1, { dm: dm! }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, dm!.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("in the DM menu", 0.2) });
      await click(rec, dm!.getByRole("button", { name: "Encounter", exact: true }), "Encounter", { at: cue("Under Encounter", 0.2) });
      await focus(rec, enc().locator(".encounter-section").first(), "Setup", { at: cue("Setup lists") });
      await focus(rec, enc().getByRole("list", { name: "Not rolled yet" }), "Not rolled yet", { at: cue("not rolled yet") });
      // Marked by hand: the shared helper's re-centring scroll left this group unresolvable
      // (boundingBox hung for 30 s, twice running), so measure it where scrollIntoView puts it.
      const hp = enc().getByRole("group", { name: "Monster HP players see" });
      await hp.scrollIntoViewIfNeeded();
      const hpBox = (await hp.boundingBox())!;
      rec.mark("focus", "Monster HP", { box: hpBox, at: cue("Monster HP players see") });
      const bloodied = hp.getByRole("button", { name: "Bloodied" });
      const bBox = (await bloodied.boundingBox())!;
      const bAt = { x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height / 2 };
      await rec.clock.at(cue("bloodied", 0.1) - 0.4, dm!);
      await glide(dm!, bAt, 400);
      rec.mark("click", "Bloodied", { box: bBox, at: cue("bloodied", 0.1) });
      await dm!.mouse.click(bAt.x, bAt.y, { delay: 70 });
      rec.mark("note", "server", { at: cue("The server enforces") });
      await rest(dm!);
    });

    // 2. Players roll first
    await chapter(2, { dm: dm!, player: kael! }, async ({ cue, recs: { player: prec } }) => {
      await rollFromCard(kael!, prec, { init: cue("press in it", 0.2), roll: cue("and roll for their", 0.2) });
      await expect.poll(async () => (await snap(dm!)).combatActive).toBe(true);
      await focus(prec, kael!.getByText("⚔️ Combat Active").first(), "Combat Active", { at: cue("The first one to roll") });
      await rest(kael!);
    });
    // Off camera: Mira rolls second. The turn stays with Kael, who rolled first.
    await rollFromCard(mira!, null);
    await expect.poll(async () => (await snap(dm!)).characters.filter((c) => ["Kael", "Mira"].includes(c.name) && c.initiative !== undefined).length).toBe(2);
    await kael!.getByRole("button", { name: /^Close .* details$/ }).click().catch(() => {});

    // 3. Roll the NPCs
    await chapter(3, { dm: dm! }, async ({ cue, recs: { dm: rec } }) => {
      const roll = enc().getByRole("button", { name: /Roll missing NPC initiative/ });
      await roll.scrollIntoViewIfNeeded();
      await click(rec, roll, "Roll missing NPC initiative", { at: cue("Roll Missing NPC", 0.3) });
      await expect.poll(async () => (await snap(dm!)).characters.filter((c) => c.type === "npc" && c.initiative !== undefined).length).toBe(3);
      await focus(rec, enc().getByRole("list", { name: "In the order" }), "In the order", { at: cue("its own line") });
      const line = enc().getByText(/by hand/i).first();
      await line.scrollIntoViewIfNeeded();
      await focus(rec, line, "hand entry line", { at: cue("This line tells you", -0.6) });
      await rest(dm!);
    });

    // Off camera: make sure the turn holder (Kael) is not already at the top, by a hand value of 1.
    {
      const s = await snap(dm!);
      const ranked = s.characters.filter((c) => c.initiative !== undefined).sort((a, b) => b.initiative! - a.initiative!);
      if (ranked[0]?.name === "Kael") {
        // A goblin's hand value above Kael's: the order changes, the turn does not.
        const gob = s.characters.find((c) => c.type === "npc")!;
        const top = ranked[0].initiative! + 2;
        await send(dm!, { t: "set-initiative", characterId: gob.id, initiative: top });
        await expect.poll(async () => (await snap(dm!)).characters.find((c) => c.id === gob.id)?.initiative).toBe(top);
      }
      expect(await holderName()).toBe("Kael");
    }

    // 4. Start at the top
    await chapter(4, { dm: dm! }, async ({ cue, recs: { dm: rec } }) => {
      const note = enc().getByText(/is at the top of the order/);
      await note.scrollIntoViewIfNeeded();
      await focus(rec, note, "not at the top", { at: cue("Encounter shows a note") });
      await click(rec, enc().getByRole("button", { name: /Start at top of order/ }), "Start at top", { at: cue("Press Start at top", 0.3) });
      await focus(rec, dm!.locator(".encounter-status"), "status", { at: cue("starts the round over") });
      await rest(dm!);
    });

    // 5. Running turns
    await chapter(5, { dm: dm!, player: kael! }, async ({ cue, recs: { dm: rec, player: prec } }) => {
      const next = enc().getByRole("button", { name: "Next turn" });
      await next.scrollIntoViewIfNeeded();
      await click(rec, next, "NEXT", { at: cue("Next and", 0.2), ms: 300 });
      await click(rec, enc().getByRole("button", { name: "Previous turn" }), "PREV", { at: cue("for previous", 0.1), ms: 300 });
      await focus(rec, dm!.locator(".encounter-status"), "status", { at: cue("The status line") });
      // Kael's turn: anyone can press Next, so Next until it is.
      for (let i = 0; i < 6 && (await holderName()) !== "Kael"; i++) {
        const before = await holderName();
        await click(rec, next, "NEXT", { ms: 250 });
        await expect.poll(holderName).not.toBe(before);
      }
      // One continuous drag: four cells and a pause on the plate, then on past what is left.
      const from = await tokenAt(kael!, "Kael");
      const mid = { x: from.x + from.g * 4, y: from.y };
      const far = { x: from.x + from.g * 9, y: from.y + from.g };
      await prec.clock.at(cue("On a token's plate", -0.6), kael!);
      await glide(kael!, from, 350);
      prec.mark("drag", "Kael", { box: { x: from.x - 30, y: from.y - 30, width: 60, height: 60 } });
      await kael!.mouse.down();
      await kael!.waitForTimeout(120);
      await glide(kael!, mid, 900);
      prec.mark("focus", "plate", { box: { x: mid.x - 60, y: mid.y - 70, width: 120, height: 120 }, at: cue("its movement left") });
      await prec.clock.at(cue("Overspend", -0.3), kael!);
      await glide(kael!, far, 1300);
      prec.mark("focus", "red", { box: { x: far.x - 60, y: far.y - 70, width: 120, height: 120 }, at: cue("turns red") });
      await prec.clock.at(cue("Nothing is refused", -0.2), kael!);
      await kael!.mouse.up();
      // A goblin drops below half; with Bloodied on, Kael sees a red dot.
      const gob = (await snap(dm!)).characters.find((c) => c.type === "npc")!;
      await rec.clock.at(cue("With monster HP", 0), dm!);
      await send(dm!, { t: "update-character-hp", characterId: gob.id, hp: Math.max(1, Math.floor(gob.maxHp / 3)), maxHp: gob.maxHp });
      const g = await tokenAt(kael!, gob.name);
      prec.mark("focus", "red dot", { box: { x: g.x - g.g, y: g.y - g.g, width: g.g * 2, height: g.g * 2 }, at: cue("players see a red dot") });
      await rest(dm!);
    });

    // 6. End the fight
    await chapter(6, { dm: dm! }, async ({ cue, recs: { dm: rec } }) => {
      const end = enc().getByRole("button", { name: /End combat/ });
      await end.scrollIntoViewIfNeeded();
      await click(rec, end, "End combat", { at: cue("End Combat stops", 0.2) });
      const clear = enc().getByRole("button", { name: /Clear all initiative/i });
      await clear.scrollIntoViewIfNeeded();
      await click(rec, clear, "Clear all initiative", { at: cue("Clear All Initiative", 0.2) });
      await rest(dm!);
    });
  } finally {
    for (const c of contexts) await c.close();
  }
});
