/**
 * E2E: the DM menu's Token Library — the bundled pack (monsters and
 * townsfolk) as a picker.
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
  disposition?: string;
}

async function npcs(page: Page): Promise<NpcView[]> {
  return page.evaluate(() =>
    (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
      .filter((c) => c.type === "npc")
      .map((c) => ({
        id: c.id,
        name: c.name,
        tokenImage: c.tokenImage,
        portrait: c.portrait,
        disposition: c.disposition,
      })),
  );
}

/** The Entities-panel card for an NPC — where the stance is actually READ. */
const cardOf = (page: Page, name: string) =>
  page.locator(".player-card-shell").filter({ hasText: name }).first();

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
  await expect(page.getByTestId("token-library")).toBeVisible();
}

/**
 * A REAL 8x8 PNG, not the 8-magic-bytes stand-in the upload specs use: the
 * shelf's add decodes this image and draws it into a canvas to make the 84px
 * thumbnail, and a header with no pixels behind it never decodes at all.
 */
const REAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAaklEQVR4nBWNQREAQQzCkFIpSKmUSEFK" +
    "pSDlbnlmmEQSIyxWICJOVEjDDB52YMhwQwfJjLFZg4k5UyMts3jZhSXLLV2kJ8APvgUO+ucUJjhsHk64" +
    "0PyNYw4fe++c447e3yhTXLZPkXKl5QPGe1gBrfdehAAAAABJRU5ErkJggg==",
  "base64",
);

/** An /assets/<sha256> TAIL, at whatever origin the table's server is on. */
const ASSET_URL = /\/assets\/[a-f0-9]{64}$/;

// The pack's own paths under /tokens — the same paths its gallery serves.
const CLUB = "/tokens/NPC/Enemies/Goblins/goblinClub.png";
const CLUB_PORTRAIT = "/tokens/Medium/NPC/Enemies/Goblins/goblinClub.png";
const CHEST_CLOSED = "/tokens/NPC/Enemies/Mimics/Disguised/closedChest.png";
const CHEST_REVEALED = "/tokens/NPC/Enemies/Mimics/mimicChest.png";
const BLACKSMITH = "/tokens/NPC/Civilians/Shops/npcDwarfBlacksmith.png";

test.describe("the Token Library", () => {
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
      expect(added!.portrait).toBe(CLUB_PORTRAIT);

      // The URLs the pick wrote resolve to real PNGs on the client origin —
      // the one thing no unit test can see.
      for (const url of [CLUB, CLUB_PORTRAIT]) {
        const response = await page.request.get(new URL(url, page.url()).toString());
        expect(response.status(), url).toBe(200);
        expect(response.headers()["content-type"], url).toContain("image/png");
        expect((await response.body()).subarray(1, 4).toString(), url).toBe("PNG");
      }

      // Place it: the token is born at the pack's size, and a goblin is small.
      const card = page.locator(`input[value="${added!.name}"]`).locator("xpath=ancestor::*[3]");
      await card.getByRole("button", { name: /place on map/i }).click();
      await expect
        .poll(() =>
          page.evaluate(
            (url) =>
              (window.__HERO_BYTE_E2E__?.snapshot?.tokens ?? []).find((t) => t.imageUrl === url)
                ?.size ?? null,
            CLUB,
          ),
        )
        .toBe("small");
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

  test("townsfolk: the category switch, a tag search, and the ×N count on a pick", async ({
    page,
  }) => {
    await joinDefaultRoomAsDM(page);
    const before = (await npcs(page)).map((n) => n.id);

    try {
      await openLibrary(page);
      await page.getByLabel(/how many npcs to add/i).fill("3");
      await page.getByRole("button", { name: "Townsfolk" }).click();
      // "smith" is in the title, "shopkeeper" only in the pack's tags.
      await page.getByLabel("Search").fill("shopkeeper smith");
      await page.getByRole("button", { name: "Dwarf blacksmith" }).click();
      await expect
        .poll(async () =>
          (await npcs(page)).filter((n) => !before.includes(n.id) && n.tokenImage === BLACKSMITH),
        )
        .toHaveLength(3);
      const added = (await npcs(page)).filter((n) => !before.includes(n.id));
      expect(added.map((n) => n.name).every((n) => /^Dwarf blacksmith( \d+)?$/.test(n))).toBe(true);

      // A townsfolk is born NEUTRAL — the pack calls all 60 of them civilians
      // — so the DM's Entities card says Neutral, not Enemy.
      expect(added.map((n) => n.disposition)).toEqual(["neutral", "neutral", "neutral"]);
      const card = cardOf(page, added[0]!.name);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator(".player-card-role")).toHaveText("Neutral");
    } finally {
      await removeNpcsAddedSince(page, before);
    }
  });

  test("the table's own shelf: upload one, thumb it, pick it, players never see it, remove it", async ({
    page,
    browser,
  }) => {
    await joinDefaultRoomAsDM(page);
    const before = (await npcs(page)).map((n) => n.id);
    const shelf = () => page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.customTokens ?? []);
    const shelfBefore = (await shelf()).map((t) => t.id);
    const NAME = `Old Marta ${Date.now().toString(36)}`;

    try {
      await openLibrary(page);
      await page.getByRole("button", { name: "Custom" }).click();
      const form = page.getByTestId("custom-token-form");
      // ⬆ UPLOAD, not a pasted path: it exercises the road a DM actually
      // takes from a phone's camera roll, and it is the "already ours" branch
      // of the thumbnail pipeline (no mirror, a thumb all the same). The
      // committed URL carries the SERVER's origin, which on this rail is
      // plain http — the shape add-custom-token used to refuse outright.
      const imageField = form.getByRole("textbox", { name: "Image" });
      await form.getByLabel("Image upload").setInputFiles({
        name: "old-marta.png",
        mimeType: "image/png",
        buffer: REAL_PNG,
      });
      await expect(imageField).toHaveValue(ASSET_URL, { timeout: 15_000 });
      const IMAGE = await imageField.inputValue();
      await form.getByLabel("Name").fill(NAME);
      await form.getByLabel("Description").fill("Runs the Gilded Tankard.");
      await form.getByRole("button", { name: "villager" }).click();
      // The LAST kind chip chooses the stance, so she ends up an ally and her
      // Entities card will read Ally rather than Enemy.
      await form.getByRole("button", { name: "ally" }).click();
      await expect(form.getByLabel("Stance")).toHaveValue("friendly");
      await form.getByRole("textbox", { name: "Tags" }).fill("innkeeper");
      await form.getByLabel("Size").selectOption("small");
      await form.getByRole("button", { name: "＋ Add to library" }).click();

      await expect
        .poll(async () => (await shelf()).filter((t) => !shelfBefore.includes(t.id)))
        .toHaveLength(1);
      const [added] = (await shelf()).filter((t) => !shelfBefore.includes(t.id));
      expect(added).toMatchObject({
        name: NAME,
        imageUrl: IMAGE,
        description: "Runs the Gilded Tankard.",
        tags: ["villager", "ally", "innkeeper"],
        size: "small",
        disposition: "friendly",
      });

      // The 84px render is a SECOND upload of this table's, distinct from the
      // picture, and it really serves — the one thing no unit test can see,
      // since jsdom has neither a canvas nor image decoding.
      expect(added!.thumbUrl, "no thumbnail was made").toMatch(ASSET_URL);
      expect(added!.thumbUrl).not.toBe(added!.imageUrl);
      const thumbResponse = await page.request.get(added!.thumbUrl!);
      expect(thumbResponse.status()).toBe(200);
      expect(thumbResponse.headers()["content-type"]).toBe("image/png");
      expect((await thumbResponse.body()).subarray(1, 4).toString()).toBe("PNG");

      // It is on the shelf, badged, drawn from the thumb, and a pick makes an
      // NPC of it at its size.
      const cell = page.getByRole("button", { name: NAME, exact: true });
      await expect(cell).toBeVisible();
      await expect(cell.locator("img")).toHaveAttribute("src", added!.thumbUrl!);
      await expect(cell.locator("xpath=..").getByText("MINE")).toBeVisible();
      await cell.click();
      await expect
        .poll(async () =>
          (await npcs(page)).filter((n) => !before.includes(n.id) && n.tokenImage === IMAGE),
        )
        .toHaveLength(1);

      // The stance rides the pick all the way to the card the table reads.
      const [npc] = (await npcs(page)).filter((n) => !before.includes(n.id));
      expect(npc!.disposition).toBe("friendly");
      const npcCard = cardOf(page, npc!.name);
      await npcCard.scrollIntoViewIfNeeded();
      await expect(npcCard.locator(".player-card-role")).toHaveText("Ally");

      // A player's snapshot carries no shelf at all — not even an empty one.
      const playerContext = await browser.newContext();
      try {
        const playerPage = await playerContext.newPage();
        const { joinDefaultRoom } = await import("./helpers");
        await joinDefaultRoom(playerPage);
        await playerPage.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.snapshot));
        const seen = await playerPage.evaluate(
          () => "customTokens" in (window.__HERO_BYTE_E2E__?.snapshot ?? {}),
        );
        expect(seen).toBe(false);
      } finally {
        await playerContext.close();
      }

      // Remove asks first; accepting takes it off the shelf.
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: `Remove ${NAME} from the library` }).click();
      await expect
        .poll(async () => (await shelf()).filter((t) => t.id === added!.id))
        .toHaveLength(0);
    } finally {
      await removeNpcsAddedSince(page, before);
      const leftover = (await shelf()).filter((t) => !shelfBefore.includes(t.id));
      await page.evaluate(
        (ids) => {
          for (const id of ids)
            window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "remove-custom-token", id });
        },
        leftover.map((t) => t.id),
      );
    }
  });
});
