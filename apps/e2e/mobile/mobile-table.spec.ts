// U9 on a phone — the same Table, reached by touch. Tools → Table is the phone's way
// to your role and your Preferences; every screen carries the connection in its own
// header row (an opaque cover cannot lean on a badge painted over it); the map's top
// stack holds the connection, the public-table chip, the host's next steps and the
// turn strip in one column. Geometry is MEASURED (boundingBox), never read from CSS.

import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import {
  DM_PASSWORD,
  createTable,
  dismissNextSteps,
  elevationDialog,
  leaveDMMode,
  nextSteps,
  openTableScreen,
  ownRecord,
  viewerIsDM,
} from "../table-role.helpers";
import { send } from "../u7-party.helpers";
import { joinMobileTable, tooSmallText, undersizedControls } from "./mobile.helpers";

const dock = (page: Page) => page.getByRole("navigation", { name: "Mobile actions" });

/** `upper` ends at or above where `lower` begins. */
async function above(upper: Locator, lower: Locator) {
  const [a, b] = await Promise.all([upper.boundingBox(), lower.boundingBox()]);
  expect(a, "upper is rendered").not.toBeNull();
  expect(b, "lower is rendered").not.toBeNull();
  expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
}

/** No two of these boxes share any area. */
async function noneOverlap(members: Locator[]) {
  const boxes = await Promise.all(members.map((member) => member.boundingBox()));
  boxes.forEach((box, i) => expect(box, `member ${i} is rendered`).not.toBeNull());
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i]!, boxes[j]!];
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart, `member ${i} overlaps member ${j}`).toBe(true);
    }
  }
}

test.describe("mobile — the Table screen", () => {
  test("holds role and Preferences at the 44px floor, names Sound & motion, and keeps the dock five slots", async ({
    page,
  }) => {
    await joinMobileTable(page);
    await expect(dock(page).getByRole("button")).toHaveCount(5);

    const screen = await openTableScreen(page);
    await expect(dock(page).getByRole("button")).toHaveCount(5);
    await expect(screen).toContainText("You are a player.");
    await expect(screen.getByRole("button", { name: "Enter DM mode", exact: true })).toBeVisible();
    await expect(screen.getByRole("button", { name: /Table settings/ })).toHaveCount(0);

    // Preferences: Display and Sound & motion, both on the phone for the first time.
    await expect(screen.getByRole("group", { name: "Display" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "📺 CRT", exact: true })).toBeVisible();
    const sound = screen.getByRole("group", { name: "Sound & motion" });
    await expect(sound).toBeVisible();
    expect(await undersizedControls(page, '[data-mobile-surface="table"]')).toEqual([]);
    // ...and its words hold the phone's 11px readability floor.
    expect(await tooSmallText(page, '[data-mobile-surface="table"] .mobile-screen__body')).toEqual(
      [],
    );
    // The checkbox family is exempt from the sweep (its hit area is its row): measure the row.
    const muteRow = screen.getByText("Mute sound effects", { exact: true });
    expect((await muteRow.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // A change reaches the stored value, under the key it always used, and survives a reload.
    await sound.getByRole("combobox", { name: /Motion/ }).selectOption("off");
    await sound.getByRole("checkbox", { name: "Mute sound effects" }).check();
    const stored = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("herobyte:juice") ?? "null"));
    await expect.poll(stored).toMatchObject({ motion: "off", muted: true });
    await page.reload();
    await expect(dock(page).getByRole("button", { name: "Tools", exact: true })).toBeVisible();
    const again = await openTableScreen(page);
    await expect(again.getByRole("combobox", { name: /Motion/ })).toHaveValue("off");
    await expect(again.getByRole("checkbox", { name: "Mute sound effects" })).toBeChecked();

    await page.getByRole("button", { name: "Close Table", exact: true }).tap();
    await expect(page.locator('[data-mobile-surface="table"]')).toHaveCount(0);
  });

  test("a DM's Table settings lands on the DM screen's Table tab", async ({ page }) => {
    await joinMobileTable(page);
    await elevateToDM(page);
    const screen = await openTableScreen(page);
    await expect(screen).toContainText("You are the Dungeon Master.");
    await screen.getByRole("button", { name: /Table settings/ }).tap();
    const dm = page.getByRole("dialog", { name: "DM Menu" });
    await expect(dm).toBeVisible();
    await expect(page.locator('[data-mobile-surface="table"]')).toHaveCount(0);
    await expect(dm.getByRole("heading", { name: "Your role" })).toBeVisible();
    await expect(dm.getByRole("heading", { name: "Backups" })).toBeAttached();
  });

  test("a DM leaves DM mode from the Table screen by touch, and is a player when it is clear", async ({
    page,
  }) => {
    await joinMobileTable(page);
    await elevateToDM(page);

    // The helper drives the confirm by touch and closes the screen behind it, as entering does.
    await leaveDMMode(page, true);
    await expect(page.locator('[data-mobile-surface="table"]')).toHaveCount(0);

    const again = await openTableScreen(page);
    await expect(again.getByRole("button", { name: "Enter DM mode", exact: true })).toBeVisible();
    await expect(again.getByRole("button", { name: /Table settings/ })).toHaveCount(0);
  });
});

test.describe("mobile — the connection has a row of its own", () => {
  test("every screen puts it above its title and its ✕, where a finger would hit it", async ({
    page,
  }) => {
    await joinMobileTable(page);
    await elevateToDM(page);

    const screens: [string, () => Promise<Locator>][] = [
      [
        "Party",
        async () => {
          await dock(page).getByRole("button", { name: "Party", exact: true }).tap();
          return page.locator('[data-mobile-surface="party"]');
        },
      ],
      [
        "Chat",
        async () => {
          await dock(page).getByRole("button", { name: /Chat/i }).tap();
          return page.getByRole("dialog", { name: "Chat & Rolls", exact: true });
        },
      ],
      [
        "DM",
        async () => {
          await dock(page).getByRole("button", { name: "DM", exact: true }).tap();
          return page.getByRole("dialog", { name: "DM Menu" });
        },
      ],
      ["Table", () => openTableScreen(page)],
    ];
    for (const [name, open] of screens) {
      const screen = await open();
      await expect(screen, `${name} screen`).toBeVisible();
      const chip = screen.getByTestId("connection-chip");
      await expect(chip, `${name} carries its own chip`).toBeVisible();
      await expect(chip).toHaveText(/^(🟢|🔴)(ONLINE|OFFLINE)$/);
      const title = screen.locator(".mobile-screen__title");
      const close = screen.locator(".mobile-screen__close");
      await above(chip, title);
      await above(chip, close);
      // What a finger hits at the chip's centre is the chip (nothing is painted over it).
      const box = (await chip.boundingBox())!;
      const top = await page.evaluate(
        ([x, y]) =>
          document.elementFromPoint(x!, y!)?.closest("[data-testid]")?.getAttribute("data-testid"),
        [box.x + box.width / 2, box.y + box.height / 2],
      );
      expect(top).toBe("connection-chip");
      await close.tap();
      await expect(screen).toHaveCount(0);
    }
  });
});

test.describe("mobile — the top stack", () => {
  test.describe.configure({ timeout: 90_000 });

  test("the connection, the public-table chip and the turn strip share one column and never overlap", async ({
    page,
  }) => {
    await joinMobileTable(page);
    await elevateToDM(page);
    const hero = await page.evaluate(() => {
      const state = window.__HERO_BYTE_E2E__;
      return state?.snapshot?.characters.find(
        (c) => c.type === "pc" && c.ownedByPlayerUID === state.uid,
      )?.id;
    });
    expect(hero).toBeTruthy();
    await send(page, { t: "set-initiative", characterId: hero!, initiative: 12 });
    const strip = page.locator(".mobile-combat-strip");
    await expect(strip.getByRole("button", { name: "Next turn" })).toBeVisible();

    const stack = page.locator(".mobile-top-stack");
    const members = [
      stack.getByTestId("connection-chip"),
      stack.getByTestId("public-table-chip"),
      strip.locator(".mobile-combat-strip__turn"),
      strip.getByRole("button", { name: "Next turn" }),
    ];
    // The connection heads the column, the public-table chip is next, and no two members
    // share any area — the strip's own buttons and its turn pill included.
    await above(members[0]!, members[1]!);
    for (const below of members.slice(2)) await above(members[1]!, below);
    await noneOverlap(members);
    const viewport = page.viewportSize()!;
    for (const member of members) {
      const box = (await member.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    await send(page, { t: "end-combat" });
    await expect(strip.getByRole("button", { name: "Next turn" })).toHaveCount(0);
  });

  test("a new host's next steps sit in it; Enter DM mode by touch fits the screen; Invite copies", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseURL!).origin,
    });
    const link = await createTable(page, "u9-phone-host", true);
    const steps = nextSteps(page);
    await expect(steps).toBeVisible();
    const stack = page.locator(".mobile-top-stack");
    await expect(stack.locator(steps)).toHaveCount(1);
    await above(stack.getByTestId("connection-chip"), steps);
    expect(await undersizedControls(page, ".host-steps")).toEqual([]);
    expect(await tooSmallText(page, ".host-steps")).toEqual([]);
    expect(await viewerIsDM(page)).toBe(false);
    // Invite waits for DM mode, here too.
    await expect(steps.getByRole("button", { name: "Invite players", exact: true })).toBeDisabled();

    // The card's own button opens the dialog, which fits the phone; a wrong password
    // names itself and leaves a player.
    await steps.getByRole("button", { name: "Enter DM mode", exact: true }).tap();
    const dialog = elevationDialog(page);
    const fit = (await dialog.boundingBox())!;
    expect(fit.x).toBeGreaterThanOrEqual(0);
    expect(fit.x + fit.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await dialog.getByLabel("DM password", { exact: true }).fill("not-the-dm-password");
    await dialog.getByRole("button", { name: "Enter DM mode", exact: true }).tap();
    await expect(dialog.getByText("Invalid DM password")).toBeVisible();
    expect(await viewerIsDM(page)).toBe(false);
    await dialog.getByLabel("DM password", { exact: true }).fill(DM_PASSWORD);
    await dialog.getByRole("button", { name: "Enter DM mode", exact: true }).tap();
    await expect.poll(() => viewerIsDM(page)).toBe(true);
    await expect(steps).toContainText("You are the DM.");

    await steps.getByRole("button", { name: "Invite players", exact: true }).tap();
    await expect(steps).toContainText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      new URL(link).origin + "/?room=" + new URL(link).searchParams.get("room"),
    );
    // A refused clipboard leaves the link in a field to copy by hand. It must be as easy to
    // land a finger in as any button, and as readable (found live: 21px tall, 13px type on a
    // phone, and no phone spec had ever put it on screen).
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => Promise.reject(new Error("the clipboard is refused")),
        configurable: true,
      });
    });
    // "✓ Copied" lasts two seconds and then reads Invite players again: match either.
    await steps.getByRole("button", { name: /^(Invite players|✓ Copied)$/ }).tap();
    await expect(steps.getByLabel("Invite link — copy this manually")).toBeVisible();
    expect(await undersizedControls(page, ".host-steps")).toEqual([]);
    expect(await tooSmallText(page, ".host-steps")).toEqual([]);

    await dismissNextSteps(page, true);
    await expect(steps).toHaveCount(0);
  });
});

test.describe("mobile — character file", () => {
  test("Save character and Load character on the row's EDIT sheet; other kinds are named", async ({
    page,
  }, testInfo) => {
    await joinMobileTable(page);
    await dock(page).getByRole("button", { name: "Party", exact: true }).tap();
    // A player is offered EDIT on their own row only, so there is exactly one to find.
    await page.getByRole("button", { name: /EDIT/ }).tap();
    const sheet = page.locator('[data-mobile-surface="settings"]');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Character file");
    await expect(sheet).toContainText("plus your own drawings");
    const save = sheet.getByRole("button", { name: "Save character" });
    const load = sheet.getByRole("button", { name: "Load character…" });
    for (const control of [save, load]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    const original = await ownRecord(page);
    const [download] = await Promise.all([page.waitForEvent("download"), save.tap()]);
    const saved = testInfo.outputPath("phone-hero.json");
    await download.saveAs(saved);
    expect(download.suggestedFilename()).toMatch(/character.*\.json$/);

    // The file holds THIS character as the table shows it, and Load gives it back: change the
    // character, load the file, and it is what was saved. (The buttons alone prove neither.)
    const { readFile } = await import("node:fs/promises");
    expect(JSON.parse(await readFile(saved, "utf8"))).toMatchObject({
      name: original!.name,
      hp: original!.hp,
      maxHp: original!.maxHp,
    });
    const { id } = original!;
    await send(page, { t: "update-character-name", characterId: id, name: "Renamed Hero" });
    await send(page, { t: "update-character-hp", characterId: id, hp: 13, maxHp: 50 });
    await expect
      .poll(() => ownRecord(page))
      .toEqual({ id, name: "Renamed Hero", hp: 13, maxHp: 50 });
    await sheet.getByLabel("Choose a character file to load").setInputFiles(saved);
    await expect.poll(() => ownRecord(page)).toEqual(original);

    // A table backup is not a character: said by name, nothing applied.
    const says: string[] = [];
    page.on("dialog", (dialog) => {
      says.push(dialog.message());
      void dialog.accept();
    });
    const { writeFile } = await import("node:fs/promises");
    const table = testInfo.outputPath("table.json");
    await writeFile(table, JSON.stringify({ schemaVersion: 1, snapshot: { players: [] } }));
    await sheet.getByLabel("Choose a character file to load").setInputFiles(table);
    await expect.poll(() => says.length).toBe(1);
    expect(says[0]).toMatch(/table backup.*not a character file/);
  });
});
