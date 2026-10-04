// U8 — Encounter is the single combat home. Acceptance journey 3 (plan §7) on
// a disposable private table, a DM and a player in separate browser contexts,
// every step through real input (the dev seam places tokens and READS state):
//
//   library NPC batch → place / hide / reveal → initiative (a hand value first:
//   the first saved initiative starts combat on its turn, which Encounter
//   names) → Roll missing NPC initiative (the hand value is not re-rolled) →
//   the player rolls their own → Start at top → next / previous → HP → remove
//   the current participant (the turn passes to its successor) → end;
//   the player's screen agrees at every step.

import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";
import { openCharacterDetails, ownRosterRow, partyInspector, rosterRow } from "./party.helpers";
import { createTableAsDM, joinTable, ownCharacters, placeNpcTokens } from "./u7-party.helpers";

const DESKTOP = { viewport: { width: 1440, height: 900 } };

type Seam = {
  snapshot?: {
    characters: { id: string; name: string; type: string; initiative?: number; hp?: number }[];
    combatActive?: boolean;
    currentTurnCharacterId?: string;
    diceRolls?: { label?: string }[];
  };
};
const snap = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__!.snapshot!,
  );

async function openDmTab(dm: Page, tab: string): Promise<void> {
  const launcher = dm.getByRole("button", { name: "🛠️ DM MENU", exact: true });
  const close = dm.getByRole("button", { name: "Close Dungeon Master Tools", exact: true });
  if (!(await close.isVisible())) await launcher.click();
  await dm.getByRole("button", { name: tab, exact: true }).click();
}

/** Close the DM window, so it cannot lie over the Party's inspector. */
async function closeDmMenu(dm: Page): Promise<void> {
  const close = dm.getByRole("button", { name: "Close Dungeon Master Tools", exact: true });
  if (await close.isVisible()) await close.click();
  await expect(close).toHaveCount(0);
}

/** The Encounter tab's content (the Party bar has its own Next/Previous turn). */
const encounter = (dm: Page): Locator => dm.locator(".encounter");

const encounterStatus = (dm: Page) => dm.locator(".encounter-status");
/** "Turn N of M" on the player's Party bar. */
const partyTurn = (page: Page) => page.locator(".party-bar__turn");

test.describe("U8 — Encounter, the single combat home", () => {
  test.describe.configure({ timeout: 150_000 });

  test("journey 3: prepare, roll, run and end a fight from Encounter; the player's screen agrees", async ({
    page: dm,
    browser,
  }) => {
    const desk = await browser.newContext(DESKTOP);
    try {
      const player = await desk.newPage();
      await dm.setViewportSize(DESKTOP.viewport);
      const roomUrl = await createTableAsDM(dm, "u8-encounter");
      await joinTable(player, roomUrl);
      await expect.poll(async () => (await ownCharacters(player)).length).toBe(1);
      const [hero] = await ownCharacters(player);

      // Setup: Encounter's + Add NPCs… forwards to NPCs & Monsters, where a
      // Library pick with ×3 adds a numbered group in one press.
      await openDmTab(dm, "Encounter");
      await encounter(dm).getByRole("button", { name: "+ Add NPCs…" }).click();
      await dm.getByLabel("How many NPCs to add").fill("3");
      await dm.getByRole("button", { name: "📖 Library" }).click();
      await dm.getByRole("button", { name: "Goblin club brute", exact: true }).click();
      await expect
        .poll(async () => (await snap(dm)).characters.filter((c) => c.type === "npc").length)
        .toBe(3);
      await placeNpcTokens(dm, 3);
      const npcs = (await snap(dm)).characters.filter((c) => c.type === "npc");
      const [first, second] = npcs;

      await closeDmMenu(dm);
      // Hide one, see it leave the player's roster; reveal it, see it return.
      const details = await openCharacterDetails(dm, rosterRow(dm, second.name));
      await details.getByTitle("Visible to players (click to hide)").click();
      await expect(rosterRow(player, second.name)).toHaveCount(0);
      await partyInspector(dm).getByTitle("Hidden from players (click to show)").click();
      await expect(rosterRow(player, second.name)).toHaveCount(1);

      // Initiative: a hand value for the first goblin, from its Encounter row.
      // The dialog says, before the press, that this starts the fight.
      await openDmTab(dm, "Encounter");
      const menu = encounter(dm);
      await menu.getByRole("button", { name: `Set initiative for ${first.name}` }).click();
      await expect(
        dm.getByText(
          `No fight is running: saving an initiative starts combat, on ${first.name}'s turn.`,
        ),
      ).toBeVisible();
      await dm.getByRole("button", { name: "Enter a roll by hand" }).click();
      await dm.getByPlaceholder("Enter roll...").fill("1");
      await dm.getByRole("button", { name: "Save initiative" }).click();
      await expect.poll(async () => (await snap(dm)).combatActive).toBe(true);
      await expect.poll(async () => (await snap(dm)).currentTurnCharacterId).toBe(first.id);
      const initiativeOf = async (id: string) =>
        (await snap(dm)).characters.find((c) => c.id === id)!.initiative;
      // 1 on the die + the Library goblin's modifier (0).
      expect(await initiativeOf(first.id)).toBe(1);

      // Roll missing NPC initiative: exactly the two NPCs without one roll, and
      // nothing is rolled for the hand-entered goblin (its value alone could not
      // show that: a re-roll lands on 1 one time in twenty).
      const initiativeLines = async (name?: string) =>
        ((await snap(dm)).diceRolls ?? []).filter((roll) =>
          name === undefined
            ? roll.label?.endsWith(" — initiative")
            : roll.label === `${name} — initiative`,
        ).length;
      const linesBefore = await initiativeLines();
      const firstLines = await initiativeLines(first.name);
      await menu.getByRole("button", { name: /Roll missing NPC initiative/ }).click();
      await expect
        .poll(
          async () =>
            (await snap(dm)).characters.filter(
              (c) => c.type === "npc" && c.initiative !== undefined,
            ).length,
        )
        .toBe(3);
      await expect.poll(() => initiativeLines()).toBe(linesBefore + 2);
      expect(await initiativeLines(first.name)).toBe(firstLines);
      expect(await initiativeOf(first.id)).toBe(1);
      await expect(
        menu.getByRole("button", { name: /Roll missing NPC initiative/ }),
      ).toBeDisabled();

      // The player rolls their own character from its card's INIT.
      await openCharacterDetails(player, ownRosterRow(player));
      await partyInspector(player).getByRole("button", { name: "Set Initiative" }).click();
      await player.getByRole("button", { name: "Roll d20 now" }).click();
      await expect
        .poll(async () => (await snap(dm)).characters.find((c) => c.id === hero.id)?.initiative)
        .not.toBeUndefined();

      // Run: Start at top of order moves the turn to the top; both agree. From the
      // third of four rows neither NEXT nor PREV reaches the top, so only Start at
      // top can land it there (the dice decide where the hand value 1 sits: a tie
      // with another goblin's 1 puts it above that goblin).
      const orderList = menu.getByRole("list", { name: "In the order" }).locator("li");
      await expect(orderList).toHaveCount(4);
      const orderIds = await orderList.evaluateAll((items) =>
        items.map((li) => (li as HTMLElement).dataset.characterId),
      );
      for (let step = 0; step < 4; step++) {
        if ((await snap(dm)).currentTurnCharacterId === orderIds[2]) break;
        const before = (await snap(dm)).currentTurnCharacterId;
        await menu.getByRole("button", { name: "Next turn" }).click();
        await expect.poll(async () => (await snap(dm)).currentTurnCharacterId).not.toBe(before);
      }
      await expect(encounterStatus(dm)).toContainText("Turn 3 of 4:");
      await menu.getByRole("button", { name: /Start at top of order/ }).click();
      await expect(encounterStatus(dm)).toContainText("Turn 1 of 4:");
      await expect.poll(async () => (await snap(dm)).currentTurnCharacterId).toBe(orderIds[0]);
      await expect(partyTurn(player)).toHaveText("Turn 1 of 4");
      const agree = async () => {
        const [a, b] = await Promise.all([snap(dm), snap(player)]);
        return a.currentTurnCharacterId === b.currentTurnCharacterId;
      };
      await expect.poll(agree).toBe(true);

      // Next, previous, next: the player's bar follows the DM's Encounter.
      const turnButtons = menu;
      await turnButtons.getByRole("button", { name: "Next turn" }).click();
      await expect(encounterStatus(dm)).toContainText("Turn 2 of 4:");
      await expect(partyTurn(player)).toHaveText("Turn 2 of 4");
      await turnButtons.getByRole("button", { name: "Previous turn" }).click();
      await expect(partyTurn(player)).toHaveText("Turn 1 of 4");
      await turnButtons.getByRole("button", { name: "Next turn" }).click();
      await expect(partyTurn(player)).toHaveText("Turn 2 of 4");
      await expect.poll(agree).toBe(true);

      // HP: the DM sets the turn holder's HP from its card; the player sees it.
      await closeDmMenu(dm);
      const holderId = (await snap(dm)).currentTurnCharacterId!;
      const holder = (await snap(dm)).characters.find((c) => c.id === holderId)!;
      const card = await openCharacterDetails(dm, rosterRow(dm, holder.name));
      await card
        .getByRole("button", { name: /^Set current HP/ })
        .first()
        .click();
      const hpField = card.locator('input[type="number"]').first();
      await hpField.fill("3");
      await hpField.press("Enter");
      await expect(rosterRow(player, holder.name)).toContainText("HP 3/");

      // Remove the current participant from the order: the turn passes to its
      // successor, on both screens.
      await openDmTab(dm, "Encounter");
      const orderBefore = await menu
        .getByRole("list", { name: "In the order" })
        .locator("li")
        .evaluateAll((items) => items.map((li) => (li as HTMLElement).dataset.characterId));
      expect(orderBefore).toHaveLength(4);
      const successor = orderBefore[orderBefore.indexOf(holderId) + 1]!;
      await menu.getByRole("button", { name: `Remove ${holder.name} from the order` }).click();
      await expect.poll(async () => (await snap(dm)).currentTurnCharacterId).toBe(successor);
      await expect(encounterStatus(dm)).toContainText("Turn 2 of 3:");
      await expect(partyTurn(player)).toHaveText("Turn 2 of 3");
      await expect.poll(agree).toBe(true);

      // End: the fight stops on both screens; initiatives stay on file.
      await menu.getByRole("button", { name: /End combat/ }).click();
      await expect(menu.getByText("No fight is running.")).toBeVisible();
      await expect(player.getByText("⚔️ Combat Active")).toHaveCount(0);
      expect((await snap(dm)).characters.filter((c) => c.initiative !== undefined).length).toBe(3);
    } finally {
      await desk.close();
    }
  });
});
