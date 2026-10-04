// U9 — the Table: a new host finds DM mode and the invitation, a player finds their
// own settings, and the connection is said somewhere that cannot cover a title.
// Everything is driven through the page on disposable private tables; the dev seam
// only observes (and sets a second seat up) — it never elevates anyone here.

import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";
import {
  DM_PASSWORD,
  TABLE_PASSWORD,
  createTable,
  dismissNextSteps,
  elevationDialog,
  enterDMMode,
  joinWithLink,
  leaveDMMode,
  nextSteps,
  openTableMenu,
  tableButton,
  viewerIsDM,
} from "./table-role.helpers";
import { ownCharacters, uidOf } from "./u7-party.helpers";

test.describe("U9 — a new host", () => {
  test.describe.configure({ timeout: 60_000 });

  test("goes from creating the table to DM mode to an invitation, and a wrong password changes nothing", async ({
    page: host,
    browser,
    baseURL,
  }) => {
    await host.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseURL!).origin,
    });
    const guestContext = await browser.newContext();
    try {
      const link = await createTable(host, "u9-host-steps");

      // Creation does not elevate: the host arrives as a player with next steps.
      const steps = nextSteps(host);
      await expect(steps).toBeVisible();
      await expect(steps.getByRole("button", { name: "Enter DM mode", exact: true })).toBeVisible();
      // Invite waits for DM mode: the seat is claimed before the link goes out.
      const invite = steps.getByRole("button", { name: "Invite players", exact: true });
      await expect(invite).toBeVisible();
      await expect(invite).toBeDisabled();
      expect(await viewerIsDM(host)).toBe(false);
      await expect(tableButton(host)).toHaveAttribute(
        "aria-label",
        /u9-host-steps, Player, online/,
      );
      await expect(host.getByRole("button", { name: /DM MENU/i })).toHaveCount(0);

      // A wrong password: the error stays, the dialog stays, the viewer is a player...
      await steps.getByRole("button", { name: "Enter DM mode", exact: true }).click();
      const dialog = elevationDialog(host);
      const field = dialog.getByLabel("DM password", { exact: true });
      await field.fill("not-the-dm-password");
      await dialog.getByRole("button", { name: "Enter DM mode", exact: true }).click();
      await expect(dialog.getByText("Invalid DM password")).toBeVisible();
      expect(await viewerIsDM(host)).toBe(false);
      await expect(host.getByRole("button", { name: /DM MENU/i })).toHaveCount(0);
      await expect(dialog).toBeVisible();

      // ...and the cursor is back in the field with the wrong text selected, so the
      // next keystrokes replace it: no mouse, no Tab, no Ctrl+A.
      await expect(field).toBeFocused();
      await host.keyboard.type(DM_PASSWORD);
      await host.keyboard.press("Enter");
      await expect.poll(() => viewerIsDM(host)).toBe(true);
      await expect(dialog).toHaveCount(0);
      await expect(tableButton(host)).toHaveAttribute("aria-label", /Dungeon Master, online/);
      // The step that is done says so, and Invite opens.
      await expect(steps).toContainText("You are the DM.");
      await expect(invite).toBeEnabled();

      // Invite: the link goes to the clipboard and never carries a password.
      await invite.click();
      await expect(steps).toContainText("Link copied.");
      const copied = await host.evaluate(() => navigator.clipboard.readText());
      // The room the lobby created is the room the clipboard carries.
      const room = new URL(link).searchParams.get("room");
      expect(room).toBeTruthy();
      expect(new URL(copied).searchParams.get("room")).toBe(room);
      expect(copied).not.toContain(TABLE_PASSWORD);
      expect(copied).not.toContain(DM_PASSWORD);

      // The person who is sent it opens the link and enters the table password: a
      // player, with no DM entry point beyond the ordinary, password-gated one.
      const guest = await guestContext.newPage();
      await joinWithLink(guest, copied);
      await expect(nextSteps(guest)).toHaveCount(0);
      expect(await viewerIsDM(guest)).toBe(false);
      await expect(guest.getByRole("button", { name: /DM MENU/i })).toHaveCount(0);
      const guestMenu = await openTableMenu(guest);
      await expect(guestMenu).toContainText("You are a player.");
      await expect(guestMenu.getByRole("button", { name: /Table settings/ })).toHaveCount(0);

      // Dismissing the steps is remembered for this tab.
      await steps.getByRole("button", { name: "Dismiss next steps" }).click();
      await expect(steps).toHaveCount(0);
      await host.reload();
      // The card renders only once the roster says who this is, so an absence counts for
      // something only after that: wait for a known role, THEN look for the card.
      await expect(tableButton(host)).toHaveAttribute(
        "aria-label",
        /, (Player|Dungeon Master), online/,
      );
      await expect(nextSteps(host)).toHaveCount(0);
    } finally {
      await guestContext.close();
    }
  });

  test("is handed a link to copy by hand when the browser refuses the clipboard", async ({
    page: host,
  }) => {
    await host.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => Promise.reject(new DOMException("denied", "NotAllowedError")),
      });
    });
    await createTable(host, "u9-manual-copy");
    await enterDMMode(host, DM_PASSWORD);
    await nextSteps(host).getByRole("button", { name: "Invite players", exact: true }).click();
    const manual = host.getByLabel("Invite link — copy this manually");
    await expect(manual).toBeVisible();
    expect(new URL(await manual.inputValue()).searchParams.get("room")).toBe(
      new URL(host.url()).searchParams.get("room"),
    );
    await expect(nextSteps(host)).not.toContainText("Link copied.");
  });
});

test.describe("U9 — a table made without a DM password", () => {
  test.describe.configure({ timeout: 60_000 });

  test("holds Invite until the host has claimed the DM seat by setting the password", async ({
    page: host,
  }) => {
    // With no DM password, the first person to enter DM mode sets one and becomes the
    // DM: an invitation sent first could hand the seat to the first guest.
    await createTable(host, "u9-no-dm-password", false, { dmPassword: false });
    const steps = nextSteps(host);
    const invite = steps.getByRole("button", { name: "Invite players", exact: true });
    await expect(invite).toBeDisabled();
    await expect(steps).toContainText("Enter DM mode first");

    // Entering DM mode offers to set the password (bootstrap), and only then is the seat claimed.
    await steps.getByRole("button", { name: "Enter DM mode", exact: true }).click();
    await host.getByRole("dialog", { name: "Enter DM mode" }).getByLabel("DM password").fill("x");
    await host
      .getByRole("dialog", { name: "Enter DM mode" })
      .getByRole("button", { name: "Enter DM mode", exact: true })
      .click();
    await expect(host.getByText(/doesn't have a DM password yet/)).toBeVisible();
    await expect(invite).toBeDisabled();
    await host.locator("#dm-new-password").fill(DM_PASSWORD);
    await host.locator("#dm-confirm-password").fill(DM_PASSWORD);
    await host.getByRole("button", { name: "Set password & enter DM mode" }).click();
    await expect.poll(() => viewerIsDM(host)).toBe(true);
    await expect(invite).toBeEnabled();
  });
});

test.describe("U9 — role at a table", () => {
  test.describe.configure({ timeout: 90_000 });

  test("Table settings opens the Table tab; a permission flips for the player; leaving DM mode keeps the seat", async ({
    page: dm,
    browser,
  }) => {
    const playerContext = await browser.newContext();
    try {
      const player = await playerContext.newPage();
      const roomUrl = await createTable(dm, "u9-role");
      await enterDMMode(dm, DM_PASSWORD);
      await dismissNextSteps(dm);
      await joinWithLink(player, roomUrl);
      const seat = await uidOf(dm);
      const charactersBefore = (await ownCharacters(dm)).length;

      // The DM's way in: the Table button → Table settings… → the DM menu, ON its Table tab.
      const menu = await openTableMenu(dm);
      await expect(menu).toContainText("You are the Dungeon Master.");
      await menu.getByRole("button", { name: /Table settings/ }).click();
      await expect(menu).toHaveCount(0);
      await expect(dm.getByRole("heading", { name: "Your role" })).toBeVisible();
      await expect(dm.getByRole("heading", { name: "Players at this table" })).toBeVisible();

      // A permission set there reaches the player's screen.
      const props = dm.getByRole("checkbox", { name: /players can add props/i });
      await props.click();
      await expect(props).toBeChecked();
      await expect(player.getByRole("button", { name: /PROPS/ })).toBeVisible();

      // Leave DM mode from the tab itself: the tools go, the seat and character stay.
      await dm.getByRole("button", { name: "Leave DM mode", exact: true }).click();
      await dm
        .getByRole("dialog", { name: "Leave DM mode" })
        .getByRole("button", { name: "Leave DM mode", exact: true })
        .click();
      await expect.poll(() => viewerIsDM(dm)).toBe(false);
      await expect(dm.getByRole("button", { name: "Close Dungeon Master Tools" })).toHaveCount(0);
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toHaveCount(0);
      await expect(tableButton(dm)).toHaveAttribute("aria-label", /Player, online/);
      expect(await uidOf(dm)).toBe(seat);
      expect((await ownCharacters(dm)).length).toBe(charactersBefore);
      const asPlayer = await openTableMenu(dm);
      await expect(asPlayer).toContainText("You are a player.");
      await expect(asPlayer.getByRole("button", { name: /Table settings/ })).toHaveCount(0);
      await dm.keyboard.press("Escape");

      // The password brings the tools back.
      await enterDMMode(dm, DM_PASSWORD);
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible();
      await leaveDMMode(dm);
    } finally {
      await playerContext.close();
    }
  });
});

test.describe("U9 — preferences", () => {
  test("Sound & motion keep the stored shape across a reload, and change from the Table menu", async ({
    page,
  }) => {
    // Seeded once: an init script runs on every load, and must not undo the change below.
    await page.addInitScript(() => {
      if (localStorage.getItem("herobyte:juice") === null) {
        localStorage.setItem(
          "herobyte:juice",
          JSON.stringify({ motion: "subtle", muted: true, volume: 0.25 }),
        );
      }
    });
    await joinDefaultRoom(page);
    const menu = await openTableMenu(page);
    const motion = menu.getByRole("combobox", { name: /Motion/ });
    const mute = menu.getByRole("checkbox", { name: "Mute sound effects" });
    const volume = menu.getByRole("slider", { name: /Volume/ });

    // What an existing player already chose is what the new home shows.
    await expect(motion).toHaveValue("subtle");
    await expect(mute).toBeChecked();
    await expect(volume).toBeDisabled();
    await expect(volume).toHaveValue("0.25");
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe("subtle");

    await motion.selectOption("full");
    await mute.uncheck();
    await volume.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    const stored = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("herobyte:juice") ?? "null"));
    await expect.poll(async () => (await stored())?.volume).toBeCloseTo(0.4, 5);
    const saved = await stored();
    expect(Object.keys(saved).sort()).toEqual(["motion", "muted", "volume"]);
    expect(saved).toMatchObject({ motion: "full", muted: false });

    await page.reload();
    await expect(tableButton(page)).toBeVisible();
    const again = await openTableMenu(page);
    await expect(again.getByRole("combobox", { name: /Motion/ })).toHaveValue("full");
    await expect(again.getByRole("checkbox", { name: "Mute sound effects" })).not.toBeChecked();
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe("full");
  });
});
