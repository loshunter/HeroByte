/**
 * E2E: adding several NPCs at once, and duplicating one (S8).
 *
 * The done-when for this slice is "adding five goblins takes five inputs", so
 * the first test drives the real DM Menu with real clicks rather than pushing
 * a message down the socket — a hand-sent frame would prove the server loops
 * while saying nothing about whether a DM can actually reach it.
 *
 * The default table is shared between specs and between runs, so every test
 * here works in DELTAS off the count it starts with and uses its own base name.
 */

import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";

async function npcNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
      .filter((c) => c.type === "npc")
      .map((c) => c.name),
  );
}

async function npcIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
      .filter((c) => c.type === "npc")
      .map((c) => c.id),
  );
}

/**
 * Delete every NPC this test added.
 *
 * Not optional politeness: the default table is shared between specs AND
 * between runs, and characters are capped at 500. A bulk-add spec that leaves
 * its goblins behind silts the table up until an unrelated spec fails on a
 * limit it never touched.
 */
async function removeNpcsAddedSince(page: Page, before: readonly string[]): Promise<void> {
  const added = (await npcIds(page)).filter((id) => !before.includes(id));
  if (added.length === 0) return;

  await page.evaluate((ids) => {
    for (const id of ids) {
      window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-npc", id });
    }
  }, added);

  await expect
    .poll(async () => (await npcIds(page)).filter((id) => added.includes(id)).length)
    .toBe(0);
}

/** Open DM Menu → NPCs. */
async function openNpcsTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: /DM MENU/i }).click();
  await page.getByRole("button", { name: /NPCs/i }).click();
  await expect(page.getByLabel(/how many npcs to add/i)).toBeVisible();
}

test.describe("bulk NPC creation", () => {
  test("five goblins take five inputs", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const existing = await npcIds(page);

    try {
      // The five inputs: open the menu, open the tab, type 5, press add.
      await openNpcsTab(page);
      await page.getByLabel(/how many npcs to add/i).fill("5");
      await expect(page.getByRole("button", { name: "+ Add 5 NPCs" })).toBeVisible();
      await page.getByRole("button", { name: "+ Add 5 NPCs" }).click();

      await expect.poll(async () => (await npcIds(page)).length).toBe(existing.length + 5);
    } finally {
      await removeNpcsAddedSince(page, existing);
    }
  });

  test("the batch is numbered, and a second batch continues it", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const existing = await npcIds(page);

    // Own base name, so a shared table's leftovers cannot collide.
    const base = `Bulk${Date.now().toString(36)}`;
    const send = (count: number) =>
      page.evaluate(
        ({ name, count }) =>
          window.__HERO_BYTE_E2E__?.sendMessage?.({
            t: "create-npc",
            name,
            hp: 7,
            maxHp: 7,
            count,
          }),
        { name: base, count },
      );

    try {
      await send(5);
      await expect
        .poll(async () => (await npcNames(page)).filter((n) => n.startsWith(base)).length)
        .toBe(5);

      await send(3);
      await expect
        .poll(async () => (await npcNames(page)).filter((n) => n.startsWith(base)).length)
        .toBe(8);

      const mine = (await npcNames(page)).filter((n) => n.startsWith(base));
      // Eight distinct names, numbered 1..8 — not two overlapping sets of 1..5.
      expect(new Set(mine).size).toBe(8);
      expect(mine.sort()).toEqual(Array.from({ length: 8 }, (_, i) => `${base} ${i + 1}`).sort());
    } finally {
      await removeNpcsAddedSince(page, existing);
    }
  });

  test("the server rejects a count past the ceiling", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const before = (await npcNames(page)).length;

    await page.evaluate(() =>
      window.__HERO_BYTE_E2E__?.sendMessage?.({
        t: "create-npc",
        name: "Swarm",
        hp: 1,
        maxHp: 1,
        count: 10_000,
      }),
    );

    // Give a broken server time to be wrong.
    await page.waitForTimeout(1200);
    expect((await npcNames(page)).length).toBe(before);
  });

  test("duplicate copies an NPC's stats and art under the next number", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const existing = await npcIds(page);

    const base = `Dupe${Date.now().toString(36)}`;
    try {
      await page.evaluate(
        (name) =>
          window.__HERO_BYTE_E2E__?.sendMessage?.({
            t: "create-npc",
            name,
            hp: 4,
            maxHp: 9,
            tokenImage: "https://example.com/goblin-token.png",
          }),
        base,
      );
      await expect
        .poll(async () => (await npcNames(page)).filter((n) => n === base).length)
        .toBe(1);

      await openNpcsTab(page);
      const card = page.locator("input[value='" + base + "']").locator("xpath=ancestor::*[3]");
      await card.getByRole("button", { name: /duplicate/i }).click();

      await expect
        .poll(async () => (await npcNames(page)).filter((n) => n.startsWith(base)).length)
        .toBe(2);

      const copy = await page.evaluate(
        (name) =>
          (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).find(
            (c) => c.name === `${name} 2`,
          ),
        base,
      );
      expect(copy).toBeTruthy();
      // The copy is a copy: same stats, same art, its own identity.
      expect(copy!.hp).toBe(4);
      expect(copy!.maxHp).toBe(9);
      expect(copy!.tokenImage).toBe("https://example.com/goblin-token.png");
    } finally {
      await removeNpcsAddedSince(page, existing);
    }
  });

  test("a plain player cannot bulk-create NPCs", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const { joinDefaultRoom } = await import("./helpers");
      await joinDefaultRoom(page);
      const before = (await npcNames(page)).length;

      await page.evaluate(() =>
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "create-npc",
          name: "Uninvited",
          hp: 1,
          maxHp: 1,
          count: 20,
        }),
      );

      await page.waitForTimeout(1200);
      expect((await npcNames(page)).length).toBe(before);
    } finally {
      await context.close();
    }
  });
});
