/**
 * U8 on the phone: Encounter is a chip on the DM screen, and a player sets
 * their character's initiative from the Party screen — before U8 a phone had
 * no initiative control and no turn mark at all. Two phones on a disposable
 * private table (a desktop host creates it; the dev seam places tokens and
 * READS state). Every behaviour is real touch input.
 */
import { devices } from "@playwright/test";
import { expect, test, type Page } from "../fixtures";
import {
  createTableAsDM,
  elevateBySeam,
  joinTable,
  ownCharacters,
  placeNpcTokens,
  send,
} from "../u7-party.helpers";
import { undersizedControls } from "./mobile.helpers";

type Seam = {
  snapshot?: {
    characters: { id: string; name: string; type: string; initiative?: number }[];
    combatActive?: boolean;
    currentTurnCharacterId?: string;
  };
};
const snap = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__!.snapshot!,
  );

const dock = (page: Page) => page.getByRole("navigation", { name: "Mobile actions" });
const turnName = (page: Page) => page.locator(".mobile-combat-strip__turn");

test.describe("mobile — Encounter and the phone's initiative (U8)", () => {
  test.describe.configure({ timeout: 150_000 });

  test("the phone DM runs the fight from Encounter; a phone player rolls their own; the strip names the turn", async ({
    page: phoneDm,
    browser,
  }) => {
    const host = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const phone = await browser.newContext({ ...devices["Pixel 7"] });
    try {
      const desk = await host.newPage();
      const player = await phone.newPage();
      const roomUrl = await createTableAsDM(desk, "u8-phone-encounter");
      await send(desk, { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7, count: 2 });
      await placeNpcTokens(desk, 2);

      await joinTable(phoneDm, `${roomUrl}&mobile=true`);
      await elevateBySeam(phoneDm);
      await joinTable(player, `${roomUrl}&mobile=true`);
      await expect.poll(async () => (await ownCharacters(player)).length).toBe(1);
      const [hero] = await ownCharacters(player);

      // The phone DM: ♛ DM → the Encounter chip → Roll missing NPC initiative.
      await dock(phoneDm).getByRole("button", { name: /^DM$/i }).tap();
      const screen = phoneDm.getByRole("dialog", { name: "DM Menu" });
      await screen.getByRole("button", { name: "Encounter", exact: true }).tap();
      await screen.getByRole("button", { name: /Roll missing NPC initiative/ }).tap();
      await expect
        .poll(
          async () =>
            (await snap(phoneDm)).characters.filter(
              (c) => c.type === "npc" && c.initiative !== undefined,
            ).length,
        )
        .toBe(2);
      // Nothing in Encounter is under the 44px floor on a phone.
      expect(await undersizedControls(phoneDm, ".encounter")).toEqual([]);

      // The phone player: Party → their row's ⚔️ INIT → Roll d20 now.
      await dock(player).getByRole("button", { name: "Party", exact: true }).tap();
      await player.getByRole("button", { name: `Set initiative for ${hero.name}` }).tap();
      await expect(player.getByText(`Initiative: ${hero.name}`)).toBeVisible();
      expect(await undersizedControls(player, '[data-mobile-surface="modal"]')).toEqual([]);
      // The hand-entry field fits the dialog's column and the screen (it ran
      // 20px past both on a content-box before 60a08cea).
      await player.getByRole("button", { name: "Enter a roll by hand" }).tap();
      const field = (await player.getByPlaceholder("Enter roll...").boundingBox())!;
      const save = (await player.getByRole("button", { name: "Save initiative" }).boundingBox())!;
      expect(field.x + field.width).toBeLessThanOrEqual(save.x + save.width + 0.5);
      expect(field.x + field.width).toBeLessThanOrEqual(player.viewportSize()!.width);
      await player.getByRole("button", { name: "Roll d20 now" }).tap();
      await expect
        .poll(
          async () => (await snap(phoneDm)).characters.find((c) => c.id === hero.id)?.initiative,
        )
        .not.toBeUndefined();
      await expect(player.getByText(`Initiative: ${hero.name}`)).toHaveCount(0);
      await player.getByRole("button", { name: "Close Party Members", exact: true }).tap();

      // Start at top: the turn must MOVE, and only Start at top may move it there.
      // Step the turn to the MIDDLE row first: from the bottom a NEXT would wrap
      // to the top too, and a no-op would pass if the holder already sat there.
      const order = () =>
        phoneDm
          .locator('ol[aria-label="In the order"] li')
          .evaluateAll((items) => items.map((li) => (li as HTMLElement).dataset.characterId));
      await expect.poll(async () => (await order()).length).toBe(3);
      const [top, middle] = await order();
      for (let step = 0; step < 3; step++) {
        if ((await snap(phoneDm)).currentTurnCharacterId === middle) break;
        const before = (await snap(phoneDm)).currentTurnCharacterId;
        await screen.getByRole("button", { name: "Next turn" }).tap();
        await expect
          .poll(async () => (await snap(phoneDm)).currentTurnCharacterId)
          .not.toBe(before);
      }
      expect((await snap(phoneDm)).currentTurnCharacterId).toBe(middle);
      await screen.getByRole("button", { name: /Start at top of order/ }).tap();
      await expect.poll(async () => (await snap(phoneDm)).currentTurnCharacterId).toBe(top);
      // The player's strip names the holder the DM's Encounter shows.
      const holderName = async () => {
        const state = await snap(phoneDm);
        return state.characters.find((c) => c.id === state.currentTurnCharacterId)?.name;
      };
      await expect(phoneDm.locator(".encounter-status")).toContainText("Turn 1 of 3:");
      await expect(turnName(player)).toHaveText(`Turn: ${await holderName()}`);
      // Readable, not just present: the connection badge (fixed, top centre)
      // once painted over this line. It is the top stack's first member now
      // (U9), above the strip; the two boxes must still not overlap.
      const line = await turnName(player).boundingBox();
      const badge = await player
        .locator(".mobile-top-stack")
        .getByTestId("connection-chip")
        .boundingBox();
      expect(line && badge).toBeTruthy();
      expect(line!.y >= badge!.y + badge!.height || line!.y + line!.height <= badge!.y).toBe(true);

      // Next from Encounter; then the player's own strip NEXT (anyone may advance).
      await screen.getByRole("button", { name: "Next turn" }).tap();
      await expect(phoneDm.locator(".encounter-status")).toContainText("Turn 2 of 3:");
      await expect(turnName(player)).toHaveText(`Turn: ${await holderName()}`);
      await player.locator(".mobile-combat-strip").getByRole("button", { name: "Next turn" }).tap();
      await expect(phoneDm.locator(".encounter-status")).toContainText("Turn 3 of 3:");
      await expect(turnName(player)).toHaveText(`Turn: ${await holderName()}`);

      // End: the strip goes from the player's phone.
      await screen.getByRole("button", { name: /End combat/ }).tap();
      await expect(turnName(player)).toHaveCount(0);
      expect((await snap(player)).combatActive).toBe(false);
    } finally {
      await host.close();
      await phone.close();
    }
  });
});
