/**
 * Enter and leave DM mode the way a person does (U9): from the TABLE, not from a
 * character's settings window. Desktop: the header's Table button → Enter DM mode →
 * the password dialog. Phone: Tools → Table → Enter DM mode → the same dialog.
 *
 * These drive the real UI, so a spec that uses them proves the path a new host
 * would take. Setup that merely needs a DM (and is not about how one becomes one)
 * can still use `elevateToDM` / `elevateBySeam`, which send the message directly.
 */
import { expect, type Locator, type Page } from "@playwright/test";

type Seam = {
  uid?: string;
  snapshot?: { players: { uid: string; isDM?: boolean }[] };
};

/** Observe-only: the viewer's DM flag as the snapshot has it. */
export const viewerIsDM = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
    return Boolean(state?.snapshot?.players.find((player) => player.uid === state.uid)?.isDM);
  });

/** Press a control by mouse, or by a finger on a touch context. */
export const press = (locator: Locator, touch = false) => (touch ? locator.tap() : locator.click());

/** Desktop: open the header's Table menu. */
export async function openTableMenu(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /^Table menu:/ }).click();
  const menu = page.getByRole("dialog", { name: "Table menu" });
  await expect(menu).toBeVisible();
  return menu;
}

/** Phone: open the Table screen from the Tools sheet. */
export async function openTableScreen(page: Page): Promise<Locator> {
  await page
    .getByRole("navigation", { name: "Mobile actions" })
    .getByRole("button", { name: "Tools", exact: true })
    .tap();
  await page.getByRole("button", { name: "Table", exact: true }).tap();
  const screen = page.getByRole("dialog", { name: "Table", exact: true });
  await expect(screen).toBeVisible();
  return screen;
}

/** The password dialog, once it is open. */
export const elevationDialog = (page: Page) =>
  page.getByRole("dialog", { name: /Enter DM mode|Set the DM password|Leave DM mode/ });

/**
 * Open the password dialog from the Table menu (desktop) or Table screen (phone)
 * and submit `dmPassword`. Resolves when the snapshot says the viewer is a DM.
 */
export async function enterDMMode(page: Page, dmPassword: string, touch = false): Promise<void> {
  const surface = touch ? await openTableScreen(page) : await openTableMenu(page);
  await press(surface.getByRole("button", { name: "Enter DM mode", exact: true }), touch);
  const dialog = page.getByRole("dialog", { name: "Enter DM mode" });
  await dialog.getByLabel("DM password", { exact: true }).fill(dmPassword);
  await press(dialog.getByRole("button", { name: "Enter DM mode", exact: true }), touch);
  await expect.poll(() => viewerIsDM(page)).toBe(true);
  if (touch) await closeTableScreen(page);
}

/** The phone's Table screen stays up behind the password dialog; both ways of changing role leave the map clear. */
async function closeTableScreen(page: Page): Promise<void> {
  await press(page.getByRole("button", { name: "Close Table", exact: true }), true);
  await expect(page.locator('[data-mobile-surface="table"]')).toHaveCount(0);
}

/** Leave DM mode: Table menu / screen → Leave DM mode → the confirm. */
export async function leaveDMMode(page: Page, touch = false): Promise<void> {
  const surface = touch ? await openTableScreen(page) : await openTableMenu(page);
  await press(surface.getByRole("button", { name: "Leave DM mode", exact: true }), touch);
  const dialog = page.getByRole("dialog", { name: "Leave DM mode" });
  await press(dialog.getByRole("button", { name: "Leave DM mode", exact: true }), touch);
  await expect.poll(() => viewerIsDM(page)).toBe(false);
  if (touch) await closeTableScreen(page);
}

/** After creating a table the host is shown next steps; a spec that is not about them clears the card. */
export async function dismissNextSteps(page: Page, touch = false): Promise<void> {
  const dismiss = page.getByRole("button", { name: "Dismiss next steps", exact: true });
  if (await dismiss.isVisible()) await press(dismiss, touch);
}

/** The header's Table button (desktop): the table's name, your role and the connection. */
export const tableButton = (page: Page): Locator =>
  page.getByRole("button", { name: /^Table menu:/ });

/** The host's next steps, shown once after creating a table. */
export const nextSteps = (page: Page): Locator =>
  page.getByRole("region", { name: "Next steps for the host" });

/** Wait until the page holds a seat: the board is drawn and the server's snapshot has arrived. */
export async function seated(page: Page): Promise<void> {
  await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible();
  await page.waitForFunction(
    () => {
      const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
      return Boolean(state?.uid && state.snapshot);
    },
    undefined,
    { timeout: 20_000 },
  );
}

/** Test values for a disposable private table (they live here, never in chat or in a doc). */
export const TABLE_PASSWORD = "U9-local-table-password";
export const DM_PASSWORD = "U9-local-dm-password";

/**
 * Create a private table through the lobby and arrive in it as an ordinary player:
 * creation never elevates. Returns the table's link. `dmPassword: false` leaves the
 * optional DM password empty, the table whose DM seat goes to whoever enters first.
 */
export async function createTable(
  page: Page,
  label: string,
  touch = false,
  options: { dmPassword?: boolean } = {},
): Promise<string> {
  await page.goto("/");
  await press(page.getByRole("button", { name: /New Table/i }), touch);
  await page.getByLabel("New table name", { exact: true }).fill(label);
  await page.getByLabel("New table password", { exact: true }).fill(TABLE_PASSWORD);
  if (options.dmPassword !== false) {
    await page.getByLabel("New DM password", { exact: true }).fill(DM_PASSWORD);
  }
  await press(page.getByRole("button", { name: "Create private table", exact: true }), touch);
  await seated(page);
  return page.url();
}

/** Open a table's link and enter its password: a guest who was sent the invite. */
export async function joinWithLink(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await page.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
  await page.getByRole("button", { name: /Enter Table/i }).click();
  await seated(page);
}

/** The viewer's own (first) character: what a character file saves and loads. */
export const ownRecord = (page: Page) =>
  page.evaluate(() => {
    const state = window.__HERO_BYTE_E2E__;
    const own = state?.snapshot?.characters.find(
      (c) => c.type === "pc" && c.ownedByPlayerUID === state.uid,
    );
    return own ? { id: own.id, name: own.name, hp: own.hp, maxHp: own.maxHp } : null;
  });
