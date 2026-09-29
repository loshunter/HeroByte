// The desktop Party (U7) opens as a compact roster: one row per character, its
// full card in an inspector on selection, and every card at once under "Cards".
// These helpers reach a surface the way a person does — through the Party bar
// and the roster — so specs written against the old always-open cards keep
// their assertions and only change how they get there.

import { expect, type Locator, type Page } from "@playwright/test";

/** The Party bar's heading; present whether the panel is shown or hidden. */
export const partyHeading = (page: Page): Locator =>
  page.getByRole("heading", { name: "Party", exact: true });

/** Show the Party panel if it was hidden. */
export async function showParty(page: Page): Promise<void> {
  const show = page.getByRole("button", { name: "▲ Show party" });
  if (await show.isVisible().catch(() => false)) await show.click();
  await expect(page.getByRole("button", { name: "▼ Hide party" })).toBeVisible();
}

/** Show every character's full card (the pre-U7 view). */
export async function showPartyCards(page: Page): Promise<void> {
  await showParty(page);
  const cards = page.getByRole("button", { name: "▦ Cards", exact: true });
  if ((await cards.getAttribute("aria-pressed")) !== "true") await cards.click();
  await expect(cards).toHaveAttribute("aria-pressed", "true");
}

/** The roster row of the viewer's own (first) character. */
export function ownRosterRow(page: Page): Locator {
  return page
    .locator(".party-roster__entry")
    .filter({ has: page.getByRole("button", { name: /\(You\).*: details$/ }) })
    .first();
}

/** The roster row of a character, by name. */
export function rosterRow(page: Page, name: string): Locator {
  return page.locator(".party-roster__entry").filter({
    has: page.getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}\\b.*: details$`) }),
  });
}

/** The inspector that shows the selected character's card. */
export const partyInspector = (page: Page): Locator => page.locator(".party-inspector");

/** Open a roster row's details (no-op if they are already open). */
export async function openCharacterDetails(page: Page, row: Locator): Promise<Locator> {
  await showParty(page);
  const select = row.locator(".party-roster__select");
  if ((await select.getAttribute("aria-expanded")) !== "true") await select.click();
  await expect(select).toHaveAttribute("aria-expanded", "true");
  return partyInspector(page);
}

/** Close the Party inspector, if a character's details are open. */
export async function closePartyDetails(page: Page): Promise<void> {
  const close = partyInspector(page).getByRole("button", { name: /^Close .* details$/ });
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(partyInspector(page)).toHaveCount(0);
}

/** Fold the Party panel down to its bar (it overlays the bottom of the board). */
export async function hideParty(page: Page): Promise<void> {
  await page.getByRole("button", { name: "▼ Hide party" }).click();
  await expect(page.getByRole("button", { name: "▲ Show party" })).toBeVisible();
}

/** The viewer's own character's settings window, through the roster and inspector. */
export async function openOwnCharacterSettings(page: Page): Promise<Locator> {
  const inspector = await openCharacterDetails(page, ownRosterRow(page));
  await inspector.getByTitle("Open player settings", { exact: true }).click();
  const settings = page.locator('[data-mobile-surface="settings"]');
  await expect(settings).toBeVisible();
  return settings;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
