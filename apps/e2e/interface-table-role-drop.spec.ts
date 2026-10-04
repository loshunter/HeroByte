// U9 — role is DERIVED, never latched. Two ways a DM stops being one under the
// page's feet, each driven through the real UI and the real server:
//  - a successful demotion while a build stroke is in flight and a tool is armed;
//  - a real socket drop, during which the snapshot is gone and the DM flag reads
//    false even though the person is still a DM.

import { openChat } from "./chat-journey.helpers";
import { expect, test } from "./fixtures";
import { holdableSocket } from "./socket-drop.helpers";
import {
  armGrass,
  cancelStroke,
  mapCommands,
  mapLauncher,
  mouseStroke,
  observeWire,
  publicBarrier,
  uncoveredRow,
} from "./u2-cancel.helpers";
import {
  DM_PASSWORD,
  createTable,
  dismissNextSteps,
  elevationDialog,
  enterDMMode,
  joinWithLink,
  nextSteps,
  openTableMenu,
  tableButton,
  viewerIsDM,
} from "./table-role.helpers";
import { uidOf } from "./u7-party.helpers";

test.describe("U9 — demotion while something is active", () => {
  test.describe.configure({ timeout: 120_000 });

  test("leaves no DM control and no unfinished stroke: a release after demotion sends nothing", async ({
    page: dm,
    browser,
  }) => {
    const observerContext = await browser.newContext();
    const wire = observeWire(dm);
    try {
      const observer = await observerContext.newPage();
      const link = await createTable(dm, "u9-demote");
      await enterDMMode(dm, DM_PASSWORD);
      await dismissNextSteps(dm);
      await joinWithLink(observer, link);
      // The observer speaks in public once the stroke is over: its chat is the barrier
      // that proves everything the DM's page sent has been through the server.
      await openChat(observer);
      await armGrass(dm, false, true);

      // A stroke in flight: the button is down and the brush is on the map.
      const [from, to] = await uncoveredRow(dm, 0.49);
      const sent = mapCommands(wire).length;
      await mouseStroke(dm, [from, to], false);
      await expect(cancelStroke(dm)).toBeEnabled();

      // Leave DM mode by keyboard (the pointer is busy): Table button → Leave → confirm.
      await tableButton(dm).focus();
      await dm.keyboard.press("Enter");
      await expect(dm.getByRole("dialog", { name: "Table menu" })).toBeVisible();
      await dm.getByRole("button", { name: "Leave DM mode", exact: true }).focus();
      await dm.keyboard.press("Enter");
      const confirm = dm.getByRole("dialog", { name: "Leave DM mode" });
      await confirm.getByRole("button", { name: "Leave DM mode", exact: true }).focus();
      await dm.keyboard.press("Enter");
      await expect.poll(() => viewerIsDM(dm)).toBe(false);

      // No DM control is left on screen, and nothing of the stroke is pending.
      await expect(mapLauncher(dm)).toHaveCount(0);
      await expect(cancelStroke(dm)).toHaveCount(0);
      await expect(dm.getByText("Brush: Grass", { exact: true })).toHaveCount(0);
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toHaveCount(0);
      await expect(dm.getByRole("button", { name: "Player View" })).toHaveCount(0);
      await expect(tableButton(dm)).toHaveAttribute("aria-label", /Player, online/);

      // Letting go now commits nothing: no command leaves this page, and nothing lands.
      await dm.mouse.up();
      await publicBarrier(observer, [dm, observer], "after-demotion");
      expect(mapCommands(wire)).toHaveLength(sent);

      // The DM password brings the tools back, and the build mode does NOT come back armed.
      await enterDMMode(dm, DM_PASSWORD);
      await expect(mapLauncher(dm)).toBeVisible();
      await expect(mapLauncher(dm)).toHaveAttribute("aria-pressed", "false");
      await expect(dm.getByText("Brush: Grass", { exact: true })).toHaveCount(0);
    } finally {
      await observerContext.close();
    }
  });
});

test.describe("U9 — a real socket drop", () => {
  test.describe.configure({ timeout: 120_000 });

  test("role reads unknown, not player, until the table answers; the DM is the DM again, with the same seat, and nobody is asked for a password", async ({
    page: dm,
  }) => {
    // The page's socket passes everything through until the drop: then the server side closes
    // it, and the next one opens but nothing answers it (the table has not come back yet)
    // until it is released.
    const socket = await holdableSocket(dm);
    await createTable(dm, "u9-blip");
    await enterDMMode(dm, DM_PASSWORD);
    // The host's next steps stay up: they are the other thing that must not judge a role
    // the page cannot know. Seen now, gone while the table is away, back with it.
    await expect(nextSteps(dm)).toContainText("You are the DM.");
    const seat = await uidOf(dm);
    // A window on the right edge, where the notice will want to be: Chat & Rolls opens there.
    await openChat(dm);
    await expect(tableButton(dm)).toHaveAttribute("aria-label", /Dungeon Master, online/);
    await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible();
    const menu = await openTableMenu(dm);
    await expect(menu).toContainText("You are the Dungeon Master.");
    await expect(menu.getByRole("button", { name: /Table settings/ })).toBeVisible();

    // What must be true whenever the page cannot know its role — asserted in BOTH phases of the
    // outage below. "Player" would be a guess (the flag reads false with no snapshot), a DM's
    // controls would outlive the authority that backs them, and Enter DM mode is not offered
    // to someone who may already be one.
    const roleUnknown = async (connection: RegExp) => {
      await expect(tableButton(dm)).toHaveAttribute("aria-label", connection);
      await expect(menu).toContainText("Reconnecting…");
      await expect(menu.getByRole("button", { name: "Enter DM mode", exact: true })).toBeDisabled();
      await expect(menu.getByRole("button", { name: "Leave DM mode", exact: true })).toHaveCount(0);
      await expect(menu.getByRole("button", { name: /Table settings/ })).toHaveCount(0);
      await expect(dm.getByRole("button", { name: /DM MENU/i })).toHaveCount(0);
      await expect(nextSteps(dm)).toHaveCount(0);
      await expect(elevationDialog(dm)).toHaveCount(0);
      await noticeClearOfTheHeader();
    };

    // The gate's "Reconnecting…" used to be a fixed banner at the top right: 134px of it lay over
    // RECENTER and swallowed their clicks, and "Re-authenticating…" clipped SNAP as well. It sits
    // below the header's bottom edge now, clear of every control in the header, takes no tap, and
    // paints above a floating window (Chat & Rolls is open at the right edge).
    const noticeClearOfTheHeader = async () => {
      await expect(dm.getByTestId("reconnect-notice")).toBeVisible();
      const report = await dm.evaluate(() => {
        const notice = document.querySelector<HTMLElement>('[data-testid="reconnect-notice"]')!;
        const header = document.querySelector<HTMLElement>("[data-header-root]")!;
        const box = notice.getBoundingClientRect();
        const frame = header.getBoundingClientRect();
        const covered = [...header.querySelectorAll("button")]
          .filter((button) => {
            const b = button.getBoundingClientRect();
            return (
              b.width > 0 &&
              b.height > 0 &&
              b.left < box.right &&
              b.right > box.left &&
              b.top < box.bottom &&
              b.bottom > box.top
            );
          })
          .map((button) => (button.textContent ?? "").trim());
        // The notice AND the box it sits in: a dock that takes taps swallows the few pixels of its
        // line box around the notice, which the notice's own setting never shows.
        const dock = notice.closest<HTMLElement>(".reconnect-notice-dock");
        const tapsPass =
          getComputedStyle(notice).pointerEvents === "none" &&
          dock !== null &&
          getComputedStyle(dock).pointerEvents === "none";
        // Hit-testing skips an element that takes no taps, so the probe lets this one take them
        // for the length of the measurement: what answers at its centre is what paints on top.
        const before = notice.style.pointerEvents;
        notice.style.pointerEvents = "auto";
        const atCentre = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        notice.style.pointerEvents = before;
        const describe = (el: Element | null) =>
          el === null ? "nothing" : `${el.tagName.toLowerCase()}.${el.className.toString()}`;
        return {
          below: box.top >= frame.bottom,
          covered,
          tapsPass,
          topmostAtItsCentre:
            atCentre && notice.contains(atCentre) ? "the notice" : describe(atCentre),
        };
      });
      expect(report).toEqual({
        below: true,
        covered: [],
        tapsPass: true,
        topmostAtItsCentre: "the notice",
      });
    };

    // The drop: the server side closes the page's socket, and the next one is held. A toast is the
    // app's top layer by design (z-index 10000, the notice's own corner, three seconds, tap to
    // dismiss), so one may cover the notice while it lives; the elevation toast is gone first, so
    // what the probe sees is the windows. (The phase-A window is short: nothing slow goes in it.)
    await expect(dm.getByTitle("Click to dismiss")).toHaveCount(0);
    await expect(dm.getByTestId("reconnect-notice")).toHaveCount(0);
    await socket.drop();

    // Phase A, the socket closed: offline, and the role unknown. The open menu's own chip
    // says so too (it was once a constant "online" beside a dead table).
    await roleUnknown(/, …, offline/);
    await expect(menu.getByTestId("connection-chip")).toContainText("OFFLINE");

    // Phase B, the page's retry has connected but nothing answers: the dot may say online,
    // because a socket IS open, yet the table has not said who anyone is — the role stays
    // unknown, which is the state a snapshot-derived flag used to misreport as "Player".
    await expect.poll(() => socket.held(), { timeout: 30_000 }).toBeGreaterThan(0);
    await roleUnknown(/, …, (online|offline)/);

    // Released: the page reconnects and re-authenticates by its session, not by a password.
    await socket.release();
    await expect(tableButton(dm)).toHaveAttribute("aria-label", /Dungeon Master, online/, {
      timeout: 30_000,
    });
    await expect(menu).toContainText("You are the Dungeon Master.");
    await expect(menu.getByRole("button", { name: /Table settings/ })).toBeVisible();
    await expect(dm.getByRole("button", { name: /DM MENU/i })).toBeVisible();
    await expect(nextSteps(dm)).toContainText("You are the DM.");
    await expect(dm.getByTestId("reconnect-notice")).toHaveCount(0);
    expect(await viewerIsDM(dm)).toBe(true);
    expect(await uidOf(dm)).toBe(seat);
    await expect(elevationDialog(dm)).toHaveCount(0);
    // One password entry in the whole test: the one that made this person a DM. The
    // way back was a session (authenticate carries its token), not another password.
    expect(socket.frames.filter((frame) => frame.t === "elevate-to-dm")).toHaveLength(1);
    const logins = socket.frames.filter((frame) => frame.t === "authenticate");
    expect(logins.length).toBeGreaterThanOrEqual(2);
    expect(logins.at(-1)?.token).toBeTruthy();
  });
});
