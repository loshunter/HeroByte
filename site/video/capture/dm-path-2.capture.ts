// DM path 2: Become the DM and invite players (docs/website/video-scripts.md).
// Three tables, because each chapter needs a table in a state it cannot go back to: Oak (has a DM
// password: a wrong guess, then in), Ash (made without one: the first try sets it) and Elm (fresh,
// its Invite greyed until someone has been the DM; two players join it off camera, and one leaves
// early enough for REMOVE). The DM's browser is recorded throughout ("dm").
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts dm-path-2
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../apps/e2e/fixtures";
import { loadCues } from "./cues";
import { Clock, DSF, Recording, VIEW, addCursor, click, focus, hover, rest, type } from "./rec";

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = "dm-path-2-become-the-dm-and-invite-players";
const OUT = path.resolve(here, "..", "footage", LESSON);
const TAIL = 2.0;

async function makeTable(page: Page, name: string, password: string, dmPassword?: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /New Table/i }).click();
  await page.getByLabel("New table name", { exact: true }).fill(name);
  await page.getByLabel("New table password", { exact: true }).fill(password);
  if (dmPassword) await page.getByLabel("New DM password", { exact: true }).fill(dmPassword);
  await page.getByRole("button", { name: "Create private table", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Table menu/ })).toBeVisible({ timeout: 20_000 });
  return page.url().replace(/^https?:\/\/[^/]+/, "");
}

async function join(page: Page, link: string, password: string, name: string) {
  await page.goto(link);
  await page.getByPlaceholder("Table password").fill(password);
  await page.getByRole("button", { name: /Enter Table/i }).click();
  await page.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.characters?.some((c) => c.ownedByPlayerUID === window.__HERO_BYTE_E2E__?.uid)), undefined, { timeout: 20_000 });
  await page.evaluate((n) => {
    const data = window.__HERO_BYTE_E2E__!;
    const own = data.snapshot!.characters.find((c) => c.ownedByPlayerUID === data.uid)!;
    data.sendMessage!({ t: "update-character-name", characterId: own.id, name: n });
    data.sendMessage!({ t: "rename", name: n });
  }, name);
}

test("record: DM path 2", async ({ browser }) => {
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
  const tableButton = () => dm.getByRole("button", { name: /^Table menu/ });
  const nextSteps = () => dm.getByRole("region", { name: "Next steps for the host" });

  try {
    // --- Off camera: Elm first (its leaver needs a minute gone before chapter 5), then Oak.
    const elm = await makeTable(dm, "Elm Hollow", "elm-hollow");
    const others = await browser.newContext({ viewport: VIEW });
    const leaver = await others.newPage();
    await join(leaver, elm, "elm-hollow", "Wren's Cousin");
    const staysContext = await browser.newContext({ viewport: VIEW });
    const stays = await staysContext.newPage();
    await join(stays, elm, "elm-hollow", "Bram");
    await others.close(); // gone: REMOVE appears for this seat a minute later
    const oak = await makeTable(dm, "Oak Table", "oak-table", "oak-table-dm");
    await nextSteps().getByRole("button", { name: "Dismiss next steps", exact: true }).click();
    await rest(dm);

    // 1. Enter DM mode (a wrong password first)
    const dialog = dm.getByRole("dialog", { name: "Enter DM mode" });
    await chapter(1, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, tableButton(), "Table button", { at: cue("Press the table button", 0.3) });
      const menu = dm.getByRole("dialog", { name: "Table menu" });
      await focus(rec, menu.getByRole("region", { name: "Your role" }), "Your role", { at: cue("Under your role") });
      await click(rec, menu.getByRole("button", { name: "Enter DM mode", exact: true }), "ENTER DM MODE", { at: cue("press enter DM mode", 0.3) });
      await type(rec, dialog.getByLabel("DM password", { exact: true }), "DM password", "oak-table-DM", { at: cue("type the DM password", 0.2), delay: 55 });
      await click(rec, dialog.getByRole("button", { name: "Enter DM mode", exact: true }), "ENTER DM MODE", { ms: 350 });
      await focus(rec, dialog, "the reason", { at: cue("keeps the dialogue open", 0.3) });
      await type(rec, dialog.getByLabel("DM password", { exact: true }), "DM password", "oak-table-dm", { at: cue("After five wrong tries", -1.6), delay: 40 });
      await click(rec, dialog.getByRole("button", { name: "Enter DM mode", exact: true }), "ENTER DM MODE", { ms: 300 });
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 15_000 });
      rec.mark("note", "DM", { at: cue("15 seconds") });
      await rest(dm);
    });
    void oak;

    // 2. First DM on a new table: Ash, made with no DM password.
    await makeTable(dm, "Ash Grove", "ash-grove");
    await nextSteps().getByRole("button", { name: "Dismiss next steps", exact: true }).click();
    await rest(dm);
    await chapter(2, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, tableButton(), "Table button", { at: cue("made without a DM", -0.4), ms: 350 });
      await click(rec, dm.getByRole("dialog", { name: "Table menu" }).getByRole("button", { name: "Enter DM mode", exact: true }), "ENTER DM MODE", { ms: 350 });
      await dialog.getByLabel("DM password", { exact: true }).fill("anything");
      await click(rec, dialog.getByRole("button", { name: "Enter DM mode", exact: true }), "ENTER DM MODE", { ms: 300 });
      const setup = dm.getByRole("dialog", { name: /Set the DM password/ });
      await expect(setup).toBeVisible({ timeout: 15_000 });
      await focus(rec, setup, "set one", { at: cue("offers to set one") });
      const fields = setup.locator("input[type='password']");
      await type(rec, fields.nth(0), "New DM password", "ash-grove-dm", { delay: 40, ms: 250 });
      await type(rec, fields.nth(1), "Confirm DM password", "ash-grove-dm", { delay: 40, ms: 250 });
      await click(rec, setup.getByRole("button", { name: /Set password/i }), "SET PASSWORD & ENTER DM MODE", { at: cue("the moment it's saved", -0.4) });
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 15_000 });
      await rest(dm);
    });

    // 3. What you get
    await chapter(3, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await focus(rec, dm.getByRole("button", { name: "🏗️ Build map" }), "Build map", { at: cue("Build Map") });
      await focus(rec, dm.getByRole("button", { name: "👁 Player View" }), "Player View", { at: cue("and Player View") });
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("The DM menu sits", 0.3) });
      await focus(rec, dm.getByRole("button", { name: "Close Dungeon Master Tools" }).locator(".."), "six tabs", { at: cue("six tabs", -0.3) });
      await click(rec, dm.getByRole("button", { name: "Close Dungeon Master Tools" }), "close", { at: cue("On a phone", -0.2), ms: 350 });
      await click(rec, tableButton(), "Table button", { at: cue("The Table menu now has", 0.2) });
      await click(rec, dm.getByRole("dialog", { name: "Table menu" }).getByRole("button", { name: /Table settings/ }), "Table settings…", { at: cue("Table Settings", 0.2) });
      await focus(rec, dm.getByRole("button", { name: "Table", exact: true }), "Table tab", { at: cue("on its Table tab", -0.2) });
      await dm.getByRole("button", { name: "Close Dungeon Master Tools" }).click();
      await rest(dm);
    });

    // 4. Invite players: back to Elm, as its host, before being its DM.
    await dm.goto(elm);
    await expect(tableButton()).toBeVisible({ timeout: 20_000 });
    await rest(dm);
    await chapter(4, { dm }, async ({ cue, recs: { dm: rec } }) => {
      const invite = nextSteps().getByRole("button", { name: /Invite players/i });
      await focus(rec, invite, "Invite players (greyed)", { at: cue("Invite players on the") });
      await click(rec, invite, "Invite players (greyed)", { at: cue("Clicking it harder", 0.3), ms: 300 });
      await click(rec, invite, "Invite players (greyed)", { ms: 200 });
      await click(rec, nextSteps().getByRole("button", { name: "Enter DM mode", exact: true }), "ENTER DM MODE", { at: cue("Now it works", -1.6), ms: 300 });
      await dialog.getByLabel("DM password", { exact: true }).fill("anything");
      await dialog.getByRole("button", { name: "Enter DM mode", exact: true }).click();
      const setup = dm.getByRole("dialog", { name: /Set the DM password/ });
      await expect(setup).toBeVisible({ timeout: 15_000 });
      const fields = setup.locator("input[type='password']");
      await fields.nth(0).fill("elm-hollow-dm");
      await fields.nth(1).fill("elm-hollow-dm");
      await setup.getByRole("button", { name: /Set password/i }).click();
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible({ timeout: 15_000 });
      await click(rec, nextSteps().getByRole("button", { name: /Invite players/i }), "Invite players", { at: cue("Now it works", 0.3) });
      // On a local address the copy is blocked: the card shows the link in a box instead.
      const linkBox = nextSteps().getByRole("textbox").first();
      const cardBox = (await linkBox.boundingBox().catch(() => null)) ?? undefined;
      await click(rec, dm.getByRole("button", { name: /DM MENU/i }), "DM MENU", { at: cue("Any time later", 0.3) });
      await click(rec, dm.getByRole("button", { name: "Table", exact: true }), "Table", { ms: 350 });
      const inviteRegion = dm.getByRole("region", { name: "Invite" });
      await expect(inviteRegion).toBeVisible({ timeout: 15_000 });
      await focus(rec, inviteRegion, "Invite", { at: cue("the table's code", -0.4) });
      if (cardBox) rec.mark("focus", "link box", { box: cardBox });
      await focus(rec, inviteRegion.getByRole("button", { name: "Copy invite link" }), "Copy invite link", { at: cue("copy Invite link", -0.4) });
      await click(rec, inviteRegion.getByRole("button", { name: "Copy invite link" }), "Copy invite link", { at: cue("carries no password", 0.2) });
      await focus(rec, inviteRegion, "copy by hand", { at: cue("plain local network") });
      await rest(dm);
    });

    // 5. Who is at the table
    await chapter(5, { dm }, async ({ cue, recs: { dm: rec } }) => {
      const players = dm.getByRole("region", { name: "Players at this table" });
      await focus(rec, players, "Players at this table", { at: cue("Players at this table lists", 0.2) });
      await click(rec, players.getByRole("button", { name: /Select All/ }).first(), "Select All", { at: cue("Select All grabs", 0.2) });
      const remove = players.getByRole("button", { name: /REMOVE|Remove/ }).first();
      await expect(remove).toBeVisible({ timeout: 60_000 });
      await focus(rec, remove, "REMOVE", { at: cue("Remove appears", 0.2) });
      await hover(rec, remove, "REMOVE", { at: cue("There's no undo", -0.3) });
      await focus(rec, players, "thirty seats", { at: cue("A table holds 30") });
      await rest(dm);
    });

    // 6. Stepping down
    await dm.getByRole("button", { name: "Close Dungeon Master Tools" }).click().catch(() => {});
    await chapter(6, { dm }, async ({ cue, recs: { dm: rec } }) => {
      await click(rec, tableButton(), "Table button", { at: cue("Leave DM Mode", -0.6), ms: 350 });
      const menu = dm.getByRole("dialog", { name: "Table menu" });
      await click(rec, menu.getByRole("button", { name: "Leave DM mode", exact: true }), "LEAVE DM MODE", { at: cue("Steps you back", 0.1), ms: 350 });
      const confirm = dm.getByRole("dialog", { name: /Leave DM mode/ });
      await click(rec, confirm.getByRole("button", { name: /Leave DM mode/i }).last(), "LEAVE DM MODE (confirm)", { at: cue("You keep your character", -0.3), ms: 300 });
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toHaveCount(0, { timeout: 15_000 });
      rec.mark("note", "player again", { at: cue("brings the tools back") });
      await rest(dm);
    });
    await staysContext.close();
  } finally {
    await context.close();
  }
});
