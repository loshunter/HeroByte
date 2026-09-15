/**
 * E2E: the DM menu's Monster Library — the bundled token pack as a picker.
 *
 * Drives the real DM Menu with real clicks: open NPCs, open the library,
 * search, pick. A hand-sent create-npc frame would prove the server stores a
 * tokenImage while saying nothing about whether a DM can reach the pack, and
 * nothing about whether the PNG the pick wrote is actually served.
 *
 * The default table is shared between specs and between runs, so every test
 * works in deltas off the NPCs it starts with and deletes what it added.
 */

import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoomAsDM } from "./helpers";

interface NpcView {
  id: string;
  name: string;
  tokenImage?: string | null;
  portrait?: string;
}

async function npcs(page: Page): Promise<NpcView[]> {
  return page.evaluate(() =>
    (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
      .filter((c) => c.type === "npc")
      .map((c) => ({ id: c.id, name: c.name, tokenImage: c.tokenImage, portrait: c.portrait })),
  );
}

async function removeNpcsAddedSince(page: Page, before: readonly string[]): Promise<void> {
  const added = (await npcs(page)).map((n) => n.id).filter((id) => !before.includes(id));
  if (added.length === 0) return;
  await page.evaluate((ids) => {
    for (const id of ids) window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-npc", id });
  }, added);
  await expect
    .poll(async () => (await npcs(page)).filter((n) => added.includes(n.id)).length)
    .toBe(0);
}

async function openLibrary(page: Page): Promise<void> {
  await page.getByRole("button", { name: /DM MENU/i }).click();
  await page.getByRole("button", { name: /NPCs/i }).click();
  await page.getByRole("button", { name: "📖 Library" }).click();
  await expect(page.getByTestId("monster-library")).toBeVisible();
}

const CLUB = "/tokens/monsters/Goblins/goblinClub.png";
const CHEST_CLOSED = "/tokens/monsters/Mimics/mimicChestHidden.png";
const CHEST_REVEALED = "/tokens/monsters/Mimics/mimicChest.png";

test.describe("the Monster Library", () => {
  test("a pick adds the monster with the pack's art, and the art is served", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const before = (await npcs(page)).map((n) => n.id);

    try {
      await openLibrary(page);
      await page.getByLabel("Search").fill("goblin club");
      await page.getByRole("button", { name: "Goblin club brute" }).click();

      await expect
        .poll(async () =>
          (await npcs(page)).filter((n) => !before.includes(n.id) && n.tokenImage === CLUB),
        )
        .toHaveLength(1);
      const [added] = (await npcs(page)).filter((n) => !before.includes(n.id));
      expect(added!.name).toMatch(/^Goblin club brute( \d+)?$/);
      expect(added!.portrait).toBe(CLUB);

      // The URL the pick wrote resolves to a real PNG on the client origin —
      // the one thing no unit test can see.
      const response = await page.request.get(new URL(CLUB, page.url()).toString());
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
      expect((await response.body()).subarray(1, 4).toString()).toBe("PNG");
    } finally {
      await removeNpcsAddedSince(page, before);
    }
  });

  test("a mimic reveals from its card, and disguises back", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const before = (await npcs(page)).map((n) => n.id);

    try {
      await openLibrary(page);
      await page.getByLabel("Family").selectOption("Mimics");
      await page.getByRole("button", { name: "Closed chest" }).click();
      await expect
        .poll(async () =>
          (await npcs(page)).filter((n) => !before.includes(n.id) && n.tokenImage === CHEST_CLOSED),
        )
        .toHaveLength(1);
      const [chest] = (await npcs(page)).filter((n) => !before.includes(n.id));

      // Its card is the one whose Name field holds the new NPC's name.
      const card = page.locator(`input[value="${chest!.name}"]`).locator("xpath=ancestor::*[3]");
      await card.getByRole("button", { name: "🎭 Reveal mimic" }).click();
      await expect
        .poll(async () => (await npcs(page)).find((n) => n.id === chest!.id)?.tokenImage)
        .toBe(CHEST_REVEALED);

      await card.getByRole("button", { name: "🎭 Disguise" }).click();
      await expect
        .poll(async () => (await npcs(page)).find((n) => n.id === chest!.id)?.tokenImage)
        .toBe(CHEST_CLOSED);
    } finally {
      await removeNpcsAddedSince(page, before);
    }
  });

  test("the ×N count applies to a pick", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const before = (await npcs(page)).map((n) => n.id);

    try {
      await openLibrary(page);
      await page.getByLabel(/how many npcs to add/i).fill("3");
      await page.getByLabel("Family").selectOption("Rats");
      await page.getByRole("button", { name: "Sewer rat" }).click();
      await expect
        .poll(async () =>
          (await npcs(page)).filter((n) => !before.includes(n.id) && /^Sewer rat/.test(n.name)),
        )
        .toHaveLength(3);
    } finally {
      await removeNpcsAddedSince(page, before);
    }
  });
});
