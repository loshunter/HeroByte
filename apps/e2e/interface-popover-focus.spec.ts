// U10b — where keyboard focus goes around the header's two popovers (Help and the
// Table menu). The owner's contract: opening takes focus in; Escape and the toggle
// give it back to the launcher and nothing else does; an item that opens something
// else hands focus to that thing; Tab is never trapped. Keys are real key presses; named
// controls are asserted with toBeFocused (document.activeElement). The click test and the slider
// check use .click()/.focus() to put focus where the keys start.

import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createTable, dismissNextSteps, elevationDialog, tableButton } from "./table-role.helpers";
import { createTableAsDM } from "./u7-party.helpers";

const helpButton = (page: Page) => page.getByRole("button", { name: "Help", exact: true });

/** Is focus inside this popover right now? (Named controls are asserted with toBeFocused.) */
const focusIn = (page: Page, dialog: Locator) =>
  dialog.evaluate((node) => node.contains(document.activeElement));

/** Tab until the popover is gone, proving focus stayed inside it on every press before that. */
async function tabOut(page: Page, dialog: Locator): Promise<number> {
  for (let presses = 1; presses <= 150; presses += 1) {
    await page.keyboard.press("Tab");
    if (!(await dialog.isVisible())) return presses;
    expect(await focusIn(page, dialog)).toBe(true);
  }
  throw new Error("Tab never left the popover in 150 presses");
}

test.describe("U10b — popover focus", () => {
  test.describe.configure({ timeout: 90_000 });

  test("Help: focus goes in, Escape and the toggle give it back, Tab and Shift+Tab are not trapped", async ({
    page,
  }) => {
    await createTable(page, "u10b-help-focus");
    await dismissNextSteps(page);
    const help = page.getByRole("dialog", { name: "HeroByte help" });

    await helpButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(help).toBeVisible();
    expect(await focusIn(page, help)).toBe(true);
    await expect(helpButton(page)).not.toBeFocused();

    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
    await expect(helpButton(page)).toBeFocused();

    // The toggle button closes it and takes focus back. (Chromium focuses a clicked button
    // anyway, so only the unit test, HelpMenuButton.focus.test.tsx, can tell this from a
    // popover that forgot to hand focus back.)
    await helpButton(page).click();
    await expect(help).toBeVisible();
    await helpButton(page).click();
    await expect(help).toBeHidden();
    await expect(helpButton(page)).toBeFocused();

    // Tab off the last control: the popover closes and focus carries on with the control that
    // follows Help in the page (the party panel's Roster toggle), not lost, not the launcher.
    await helpButton(page).click();
    await expect(help).toBeVisible();
    await tabOut(page, help);
    await expect(help).toBeHidden();
    await expect(page.getByRole("button", { name: /^\W*Roster$/i })).toBeFocused();

    // Shift+Tab off the first control lands on the launcher.
    await helpButton(page).click();
    await expect(help).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await expect(help).toBeHidden();
    await expect(helpButton(page)).toBeFocused();
  });

  test("a click elsewhere closes a popover and leaves focus where the click was", async ({
    page,
  }) => {
    await createTable(page, "u10b-click-focus");
    await dismissNextSteps(page);
    const help = page.getByRole("dialog", { name: "HeroByte help" });
    await helpButton(page).click();
    await expect(help).toBeVisible();
    await page.getByTestId("map-board").click({ position: { x: 200, y: 300 } });
    await expect(help).toBeHidden();
    await expect(helpButton(page)).not.toBeFocused();
    // Focus is where the click put it: the page or the map, never handed back to the launcher.
    expect(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          Boolean(document.activeElement?.closest('[data-testid="map-board"]')),
      ),
    ).toBe(true);
  });

  // Rule 3 for "Enter DM mode": the password field autofocuses itself, so this cannot tell a menu
  // that handed focus on from one that returned it to the launcher first; the unit test
  // (TableMenu.focus.test.tsx, "does not hand focus back ...") is the guard for that.
  test("Table menu: focus goes in, Escape returns it, and Enter DM mode hands it to the password field", async ({
    page,
  }) => {
    await createTable(page, "u10b-table-focus");
    await dismissNextSteps(page);
    const menu = page.getByRole("dialog", { name: "Table menu" });

    await tableButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    expect(await focusIn(page, menu)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(tableButton(page)).toBeFocused();

    // Tab off the last control: closes, and focus carries on with the next control in the
    // header after the Table button (Move), not the launcher and not the top of the page.
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await tabOut(page, menu);
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: /^\W*Move$/i })).toBeFocused();

    // Shift+Tab off the first control lands on the launcher.
    await tableButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await expect(menu).toBeHidden();
    await expect(tableButton(page)).toBeFocused();

    // The Volume slider is on the Tab path: it shows keyboard focus (its outline was off).
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    const volume = menu.getByRole("slider", { name: /Volume/ });
    await volume.focus();
    // It is the menu's last control (Tab from it would leave the menu): go back one and return.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(volume).toBeFocused();
    const ring = await volume.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(ring).toEqual({ style: "solid", width: "2px" });
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(tableButton(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Enter DM mode", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    const field = elevationDialog(page).getByLabel("DM password", { exact: true });
    await expect(field).toBeFocused();
    await expect(tableButton(page)).not.toBeFocused();
  });

  test("Table settings… hands focus to the DM menu's Table tab, not back to the launcher", async ({
    page,
  }) => {
    await createTableAsDM(page, "u10b-settings-focus");
    const menu = page.getByRole("dialog", { name: "Table menu" });

    await tableButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: /Table settings/ }).focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();

    const tab = page.getByRole("button", { name: "Table", exact: true, pressed: true });
    await expect(tab).toBeVisible();
    await expect(tab).toBeFocused();
    await expect(tableButton(page)).not.toBeFocused();
  });
});
