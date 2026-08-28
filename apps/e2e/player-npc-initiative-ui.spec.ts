import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

/**
 * Initiative, driven through the controls a person actually presses.
 *
 * This file used to be 280 lines of screenshots and `console.log` with not one
 * `expect()` in it — every step wrapped in `if (count > 0)`, so a UI that had
 * lost the initiative badge entirely still reported green. It read like
 * coverage and was not. What follows asserts the four decisions the slice was
 * built around, and each one fails if that decision is undone:
 *
 *  - the SERVER throws the die (the log line is the proof, not the number)
 *  - the dial the roller was looking at is the modifier that gets rolled with
 *  - a physical-dice entry is stored, marked, and supersedes what it replaces
 *  - a hidden creature's roll does not name it to the table
 *
 * `player-npc-initiative-simple.spec.ts` covers the wire path and the sort;
 * `turn-navigation.spec.ts` covers what the order does once combat starts.
 * Neither touches the modal, which is what this file is for.
 */

const rolls = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.diceRolls ?? []);

const myCharacter = (page: Page) =>
  page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    return (data?.snapshot?.characters ?? []).find((c) => c.ownedByPlayerUID === data?.uid) ?? null;
  });

/**
 * The panel starts collapsed at some viewport sizes and the badge lives inside
 * it. Expanding is setup, not the thing under test.
 */
async function showEntities(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { name: "ENTITIES" });
  if (!(await heading.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /show entities/i }).click();
  }
  await expect(heading).toBeVisible();
}

/** The badge is `Init` before a value and the number after, so match the label. */
const initiativeBadge = (page: Page) =>
  page.getByRole("button", { name: "Set Initiative" }).first();

async function openInitiativeModal(page: Page): Promise<void> {
  await showEntities(page);
  await initiativeBadge(page).click();
  await expect(page.getByRole("button", { name: "Roll Initiative" })).toBeVisible();
}

/**
 * Drag the modifier dial. 10px of travel is one point (`InitiativeModal.tsx`),
 * and the handler listens on `document` after capturing the pointer, so the
 * intermediate move has to be a real one — a single jump to the end coordinate
 * produces one `pointermove` and works, but two legs match how a hand does it
 * and keeps the capture honest.
 */
async function dragModifierTo(page: Page, points: number): Promise<void> {
  const dial = page.getByTestId("initiative-modifier-dial");
  const box = (await dial.boundingBox())!;
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + points * 5, y);
  await page.mouse.move(startX + points * 10, y);
  await page.mouse.up();

  await expect(dial).toHaveText(`+${points}`);
}

test.describe("initiative — the modal a player presses", () => {
  test("the badge opens the modal, the server rolls, and the number comes back", async ({
    page,
  }) => {
    await joinDefaultRoom(page);
    const character = await myCharacter(page);
    expect(character).not.toBeNull();
    expect(character!.initiative).toBeUndefined();

    await openInitiativeModal(page);
    // The modal names who it is rolling for — the reason it is safe to reach
    // for `.first()` on a badge in a panel that will hold several cards.
    await expect(page.getByText(`Initiative: ${character!.name}`)).toBeVisible();

    const before = (await rolls(page)).length;
    await page.getByRole("button", { name: "Roll Initiative" }).click();

    // Roll SENDS and closes: the server applies the value as it rolls, so there
    // is nothing left for a confirm press to confirm.
    await expect(page.getByRole("button", { name: "Roll Initiative" })).toBeHidden();

    await expect
      .poll(async () => (await myCharacter(page))?.initiative, { timeout: 15_000 })
      .toEqual(expect.any(Number));

    const rolled = (await myCharacter(page))!.initiative!;
    expect(rolled).toBeGreaterThanOrEqual(1);
    expect(rolled).toBeLessThanOrEqual(20);

    // The badge stops saying "Init" and starts saying the number.
    await expect(initiativeBadge(page)).toHaveText(String(rolled));

    // The proof that the SERVER threw it: a public log line the whole table
    // sees, carrying a d20 formula and no hand-entry marker.
    const entry = (await rolls(page))[before];
    expect(entry).toBeDefined();
    expect(entry!.label).toBe(`${character!.name} — initiative`);
    expect(entry!.formula).toContain("d20");
    expect(entry!.total).toBe(rolled);
    expect(entry!.handEntered).toBeUndefined();

    await page.getByRole("button", { name: "📜 Log" }).click();
    await expect(page.getByTestId("roll-label").first()).toHaveText(
      `${character!.name} — initiative`,
    );
  });

  test("the roll uses the dial in front of you, not the modifier on file", async ({ page }) => {
    await joinDefaultRoom(page);
    const character = await myCharacter(page);
    expect(character!.initiativeModifier ?? 0).toBe(0);

    await openInitiativeModal(page);
    await dragModifierTo(page, 5);

    const before = (await rolls(page)).length;
    await page.getByRole("button", { name: "Roll Initiative" }).click();

    // Persisted, not merely sent: the dial is the one writer of this stat, and
    // a roll that dropped it would apply the stored 0 and look identical from
    // the outside on any die face of 1..20.
    await expect
      .poll(async () => (await myCharacter(page))?.initiativeModifier, { timeout: 15_000 })
      .toBe(5);

    const entry = (await rolls(page))[before]!;
    expect(entry.formula).toContain("+ 5");
    // d20 + 5 cannot land below 6; a dropped modifier can.
    expect(entry.total).toBeGreaterThanOrEqual(6);
    expect(entry.total).toBeLessThanOrEqual(25);
    expect((await myCharacter(page))!.initiative).toBe(entry.total);
  });

  test("a number off a physical die is stored, marked, and strikes out what it replaces", async ({
    page,
  }) => {
    await joinDefaultRoom(page);
    const character = await myCharacter(page);

    // Roll first, so the hand entry has something to supersede. Without a prior
    // value `supersededTotal` is absent and the strike-through half of this
    // never gets exercised.
    await openInitiativeModal(page);
    await page.getByRole("button", { name: "Roll Initiative" }).click();
    await expect
      .poll(async () => (await myCharacter(page))?.initiative, { timeout: 15_000 })
      .toEqual(expect.any(Number));
    const superseded = (await myCharacter(page))!.initiative!;

    await openInitiativeModal(page);
    await page.getByRole("button", { name: "Use Physical Dice" }).click();
    await page.getByPlaceholder("Enter roll...").fill("17");

    // The panel does the arithmetic before you commit to it.
    await expect(page.getByText("Initiative: 17")).toBeVisible();

    const before = (await rolls(page)).length;
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeHidden({ timeout: 15_000 });

    await expect
      .poll(async () => (await myCharacter(page))?.initiative, { timeout: 15_000 })
      .toBe(17);

    const entry = (await rolls(page))[before]!;
    expect(entry.label).toBe(`${character!.name} — initiative`);
    // The marker is the safety, not the number: without it this row is
    // indistinguishable from one the server threw.
    expect(entry.handEntered).toBe(true);
    expect(entry.supersededTotal).toBe(superseded);

    await page.getByRole("button", { name: "📜 Log" }).click();
    await expect(page.getByTestId("roll-entered-badge").first()).toHaveText("BY HAND");
    await expect(page.getByTestId("roll-superseded").first()).toContainText(String(superseded));
  });

  test("with the table setting off a player loses hand entry, and the DM keeps it", async ({
    browser,
  }) => {
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const dmPage = await dmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await joinDefaultRoomAsDM(dmPage);
      await joinDefaultRoom(playerPage);

      // Default is ON, so prove the control is THERE before taking it away.
      // Without this half, a renamed or deleted button would make the absence
      // below read as the gate working.
      await openInitiativeModal(playerPage);
      await expect(playerPage.getByRole("button", { name: "Use Physical Dice" })).toBeVisible();
      await playerPage.getByRole("button", { name: "Cancel" }).click();

      await dmPage.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "set-initiative-manual-override",
          enabled: false,
        });
      });
      await playerPage.waitForFunction(
        () => window.__HERO_BYTE_E2E__?.snapshot?.initiativeManualOverride === false,
        { timeout: 10_000 },
      );

      // Gating the CONTROL is the point: the server refuses a gated entry with
      // no broadcast, no save and no error, so a player who reached Save would
      // watch "Setting..." and then be told the update timed out.
      await openInitiativeModal(playerPage);
      await expect(playerPage.getByRole("button", { name: "Use Physical Dice" })).toBeHidden();
      await expect(playerPage.getByRole("button", { name: "Roll Initiative" })).toBeVisible();
      await playerPage.getByRole("button", { name: "Cancel" }).click();

      // The setting is a rule for the players, not a vow the DM takes.
      await openInitiativeModal(dmPage);
      await expect(dmPage.getByRole("button", { name: "Use Physical Dice" })).toBeVisible();
      await dmPage.getByRole("button", { name: "Cancel" }).click();
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
});

test.describe("initiative — what the table is allowed to see", () => {
  test("a hidden creature's roll never names it in a player's log", async ({ browser }) => {
    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const dmPage = await dmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await joinDefaultRoomAsDM(dmPage);
      await joinDefaultRoom(playerPage);

      await dmPage.evaluate(() => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "create-npc",
          name: "Ambush Wyrm",
          hp: 30,
          maxHp: 30,
        });
      });
      await dmPage.waitForFunction(
        () =>
          (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).some(
            (c) => c.name === "Ambush Wyrm",
          ),
        { timeout: 10_000 },
      );

      const npcId = await dmPage.evaluate(
        () =>
          (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).find(
            (c) => c.name === "Ambush Wyrm",
          )!.id,
      );

      await dmPage.evaluate((id) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "toggle-npc-visibility", id, visible: false });
      }, npcId);
      await dmPage.waitForFunction(
        (id) =>
          (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).find((c) => c.id === id)
            ?.visibleToPlayers === false,
        npcId,
        { timeout: 10_000 },
      );
      // The player must have SEEN it go, so a later empty log is the filter
      // working rather than the snapshot not having arrived yet.
      await playerPage.waitForFunction(
        () =>
          !(window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).some(
            (c) => c.name === "Ambush Wyrm",
          ),
        { timeout: 10_000 },
      );

      await showEntities(dmPage);
      // The wyrm's card is the last one added; its badge is the last badge.
      await dmPage.getByRole("button", { name: "Set Initiative" }).last().click();
      await expect(dmPage.getByText("Initiative: Ambush Wyrm")).toBeVisible();
      await dmPage.getByRole("button", { name: "Roll Initiative" }).click();

      await expect
        .poll(
          async () => (await rolls(dmPage)).some((r) => r.label === "Ambush Wyrm — initiative"),
          { timeout: 15_000 },
        )
        .toBe(true);

      // A public roll routes AROUND the recipient filter, so the name would
      // have travelled if the roll had been logged public. Poll for a beat so
      // this is not merely "the broadcast has not landed yet".
      await playerPage.waitForTimeout(1_000);
      const playerRolls = await rolls(playerPage);
      expect(playerRolls.some((r) => (r.label ?? "").includes("Ambush Wyrm"))).toBe(false);
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
});
