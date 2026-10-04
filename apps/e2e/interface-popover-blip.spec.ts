// U10b — keyboard focus survives a connection blip while the Table menu is open. The role UI is
// derived: a socket close nulls the snapshot, the role goes unknown, and "Table settings..." (the
// control that held focus) is REMOVED. The browser would drop focus to the page, where the
// popover's Tab handling can no longer see a key; the popover takes focus back instead. A real
// socket drop, in a real browser (the same seam as interface-table-role-drop.spec.ts).

import { expect, test } from "./fixtures";
import {
  DM_PASSWORD,
  createTable,
  enterDMMode,
  openTableMenu,
  tableButton,
} from "./table-role.helpers";
import { holdableSocket } from "./socket-drop.helpers";

test.describe("U10b — the Table menu through a connection blip", () => {
  test.describe.configure({ timeout: 120_000 });

  test("focus falls back to the menu, not the page, when the control that held it goes away", async ({
    page,
  }) => {
    const socket = await holdableSocket(page);
    await createTable(page, "u10b-popover-blip");
    await enterDMMode(page, DM_PASSWORD);
    const menu = await openTableMenu(page);
    // Nothing is focused by hand: opening put focus on the first control, the role button, which
    // is the one a blip always removes.
    const leave = menu.getByRole("button", { name: "Leave DM mode", exact: true });
    await expect(leave).toBeFocused();

    await socket.drop();
    await expect(menu).toContainText("Reconnecting…");
    await expect(leave).toHaveCount(0);
    // Not on the page behind it (document.body): on the menu itself.
    await expect(menu).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);

    // Shift+Tab only works through the popover's own key handler (Escape would close the menu
    // from anywhere): it lands on the launcher, so the handler is still hearing keys.
    await page.keyboard.press("Shift+Tab");
    await expect(menu).toBeHidden();
    await expect(tableButton(page)).toBeFocused();
    await socket.release();
  });
});
