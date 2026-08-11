/**
 * E2E: the player-props toggle (players place/edit/delete their OWN props).
 *
 * The done-when is "a player can drop an AI-generated chest on the table
 * without DM elevation — but only after the DM says so", so the happy path
 * drives the real DM Session tab and the real player panel with real clicks;
 * hand-sent frames cover the refusal matrix the UI never offers buttons for.
 *
 * The default table is shared between specs and runs, so every test restores
 * what it touched: props it created are deleted and the toggle is put back
 * OFF in a finally.
 */

import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

type PropRow = { id: string; label: string; owner: string | null; x: number; y: number };

async function props(page: Page): Promise<PropRow[]> {
  return page.evaluate(() =>
    (window.__HERO_BYTE_E2E__?.snapshot?.props ?? []).map((p) => ({
      id: p.id,
      label: p.label,
      owner: p.owner,
      x: p.x,
      y: p.y,
    })),
  );
}

async function setToggle(dmPage: Page, enabled: boolean): Promise<void> {
  await dmPage.evaluate(
    (enabled) => window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "set-player-props-enabled", enabled }),
    enabled,
  );
  await expect
    .poll(() => dmPage.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.playerPropsEnabled ?? false))
    .toBe(enabled);
}

/** Delete the given prop ids as the DM and wait for them to vanish. */
async function removeProps(dmPage: Page, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await dmPage.evaluate((ids) => {
    for (const id of ids) {
      window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-prop", id });
    }
  }, ids);
  await expect
    .poll(async () => (await props(dmPage)).filter((p) => ids.includes(p.id)).length)
    .toBe(0);
}

test.describe("player props toggle", () => {
  test("off by default: a player's create-prop dies at the gate", async ({ browser, page }) => {
    await joinDefaultRoomAsDM(page);
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    try {
      await joinDefaultRoom(playerPage);
      const before = (await props(page)).length;

      await playerPage.evaluate(() =>
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "create-prop",
          label: "Uninvited Chest",
          imageUrl: "",
          owner: null,
          size: "medium",
          viewport: { x: 0, y: 0, scale: 1 },
        }),
      );

      // Give a broken server time to be wrong.
      await playerPage.waitForTimeout(1200);
      expect((await props(page)).length).toBe(before);
      // And the player never sees a launcher to click in the first place.
      await expect(playerPage.getByRole("button", { name: /PROPS/ })).toHaveCount(0);
    } finally {
      await playerContext.close();
    }
  });

  test("the DM flips the Session-tab toggle; a player adds and edits a chest by clicking", async ({
    browser,
    page,
  }) => {
    await joinDefaultRoomAsDM(page);
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    const created: string[] = [];
    try {
      await joinDefaultRoom(playerPage);

      // The real toggle, not a hand-sent frame: DM MENU → Session → checkbox.
      // click() + a retrying toBeChecked, NOT check(): the input is
      // controlled off the SNAPSHOT, so its state only flips when the
      // server's broadcast comes back — check() asserts the flip
      // synchronously and loses that race.
      await page.getByRole("button", { name: /DM MENU/i }).click();
      await page.getByRole("button", { name: /Session/i }).click();
      const checkbox = page.getByRole("checkbox", { name: /players can add props/i });
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      // The launcher appears on the player's screen off the next broadcast.
      const launcher = playerPage.getByRole("button", { name: /PROPS/ });
      await expect(launcher).toBeVisible();
      await launcher.click();

      const label = `Chest${Date.now().toString(36)}`;
      await playerPage.getByPlaceholder("Treasure Chest").fill(label);
      await playerPage.getByRole("button", { name: "+ Add Prop" }).click();

      await expect
        .poll(async () => (await props(playerPage)).filter((p) => p.label === label).length)
        .toBe(1);
      const mine = (await props(playerPage)).find((p) => p.label === label)!;
      created.push(mine.id);
      const playerUid = await playerPage.evaluate(() => window.__HERO_BYTE_E2E__?.uid);
      // Owned by the sender no matter what the form sent.
      expect(mine.owner).toBe(playerUid);

      // The prop is listed as theirs and editable in place. The editor row's
      // aria-label, NOT input[value=…]: the create form is deliberately
      // sticky after an add (the ×N philosophy), so the same string sits in
      // two inputs and the value selector trips strict mode.
      const labelInput = playerPage.getByLabel("Prop label");
      await labelInput.fill(`${label}-renamed`);
      await labelInput.blur();
      await expect
        .poll(async () =>
          (await props(page)).filter((p) => p.label === `${label}-renamed`).length,
        )
        .toBe(1);
    } finally {
      await removeProps(page, created);
      await setToggle(page, false);
      await playerContext.close();
    }
  });

  test("a scatter is one message: six numbered crates land around the centre", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const base = `Crate${Date.now().toString(36)}`;
    const created: string[] = [];
    try {
      await page.evaluate(
        (label) =>
          window.__HERO_BYTE_E2E__?.sendMessage?.({
            t: "create-prop",
            label,
            imageUrl: "",
            owner: null,
            size: "small",
            viewport: { x: 0, y: 0, scale: 1 },
            count: 6,
          }),
        base,
      );

      await expect
        .poll(async () => (await props(page)).filter((p) => p.label.startsWith(base)).length)
        .toBe(6);
      const crates = (await props(page)).filter((p) => p.label.startsWith(base));
      created.push(...crates.map((p) => p.id));

      // Numbered 1..6, and scattered — not six sprites on one spot.
      expect(crates.map((p) => p.label).sort()).toEqual(
        Array.from({ length: 6 }, (_, i) => `${base} ${i + 1}`).sort(),
      );
      const distinctSpots = new Set(crates.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
      expect(distinctSpots.size).toBeGreaterThan(1);
    } finally {
      await removeProps(page, created);
    }
  });

  test("the validator rejects a count past the ceiling", async ({ page }) => {
    await joinDefaultRoomAsDM(page);
    const before = (await props(page)).length;

    await page.evaluate(() =>
      window.__HERO_BYTE_E2E__?.sendMessage?.({
        t: "create-prop",
        label: "Flood",
        imageUrl: "",
        owner: null,
        size: "tiny",
        viewport: { x: 0, y: 0, scale: 1 },
        count: 10_000,
      }),
    );

    await page.waitForTimeout(1200);
    expect((await props(page)).length).toBe(before);
  });

  test("a player can only manage their OWN props, even with the toggle on", async ({
    browser,
    page,
  }) => {
    await joinDefaultRoomAsDM(page);
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    const created: string[] = [];
    try {
      await joinDefaultRoom(playerPage);
      await setToggle(page, true);

      const dmLabel = `Statue${Date.now().toString(36)}`;
      await page.evaluate(
        (label) =>
          window.__HERO_BYTE_E2E__?.sendMessage?.({
            t: "create-prop",
            label,
            imageUrl: "",
            owner: null,
            size: "large",
            viewport: { x: 0, y: 0, scale: 1 },
          }),
        dmLabel,
      );
      await expect
        .poll(async () => (await props(page)).filter((p) => p.label === dmLabel).length)
        .toBe(1);
      const statue = (await props(page)).find((p) => p.label === dmLabel)!;
      created.push(statue.id);

      // Rename and delete attempts against the DM's prop: both refused.
      await playerPage.evaluate((id) => {
        window.__HERO_BYTE_E2E__?.sendMessage?.({
          t: "update-prop",
          id,
          label: "Vandalized",
          imageUrl: "",
          owner: "*",
          size: "tiny",
        });
        window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-prop", id });
      }, statue.id);

      await playerPage.waitForTimeout(1200);
      const after = (await props(page)).find((p) => p.id === statue.id);
      expect(after?.label).toBe(dmLabel);
      expect(after?.owner).toBeNull();
    } finally {
      await removeProps(page, created);
      await setToggle(page, false);
      await playerContext.close();
    }
  });
});
