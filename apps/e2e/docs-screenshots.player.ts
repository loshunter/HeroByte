import { expect, test } from "./fixtures";
import { openCharacterDetails, openOwnCharacterSettings, ownRosterRow } from "./party.helpers";
import { joinDefaultRoom } from "./helpers";
import { openTouch, touchDrag } from "./mobile/touch.helpers";
import {
  boardCenter,
  closePartyDetails,
  closeTopWindow,
  dragPath,
  ensureImgDir,
  focusOwnToken,
  hideEntitiesPanel,
  makeSteps,
  shotPage,
  waitSnap,
} from "./docs-shots.helpers";

// Documentation screenshots — login + player-facing surface.
// Run via `pnpm docs:screenshots`; images land in docs/user-guide/img/.

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";
const DM_PASSWORD = process.env.E2E_DM_PASSWORD ?? "FunDM";

test.describe("docs screenshots: player", () => {
  test("login screen and table lobby", async ({ page }) => {
    ensureImgDir();
    const { step, failures } = makeSteps();

    await step(
      "login gate",
      async () => {
        await page.goto("/");
        await expect(page.getByPlaceholder("Table password")).toBeEnabled({ timeout: 15_000 });
        await shotPage(page, "login-join-table");
      },
      { required: true },
    );

    await step("new table form", async () => {
      await page.getByRole("button", { name: /New Table/i }).click();
      await expect(page.getByLabel("New table password")).toBeVisible();
      await page.getByRole("button", { name: "Create private table" }).scrollIntoViewIfNeeded();
      await expect(page.getByLabel("New table password")).toBeInViewport({ ratio: 1 });
      await expect(page.getByLabel("New DM password")).toBeInViewport({ ratio: 1 });
      await shotPage(page, "login-new-table");
    });

    await step("private table + first-time DM password setup", async () => {
      // Create a table WITHOUT the optional DM password…
      await page.getByLabel("New table password").fill("docs-table-pw");
      await page.getByRole("button", { name: "Create private table" }).click();
      await expect(page.getByRole("button", { name: "Snap" })).toBeVisible({ timeout: 20_000 });
      // A new host arrives as a player, with the two next steps offered (U9).
      await expect(page.getByRole("region", { name: "Next steps for the host" })).toBeVisible();
      await shotPage(page, "table-next-steps");
      // The card is done with: the Table menu is shot without it half-hidden behind the popover.
      await page.getByRole("button", { name: "Dismiss next steps", exact: true }).click();
      await expect(page.getByRole("region", { name: "Next steps for the host" })).toHaveCount(0);
      // …then try to elevate: the modal flips into bootstrap mode so the DM
      // seat is still claimable.
      await page.getByRole("button", { name: /^Table menu:/ }).click();
      await shotPage(page, "table-menu");
      await page
        .getByRole("dialog", { name: "Table menu" })
        .getByRole("button", { name: "Enter DM mode", exact: true })
        .click();
      await page.locator("input[type='password']:visible").first().fill("first-try");
      await page
        .getByRole("dialog", { name: "Enter DM mode" })
        .getByRole("button", { name: "Enter DM mode", exact: true })
        .click();
      await expect(page.getByText(/doesn't have a DM password yet/)).toBeVisible({
        timeout: 10_000,
      });
      await shotPage(page, "dm-bootstrap-modal");
      await page.locator("#dm-new-password").fill("docs-dm-password");
      await page.locator("#dm-confirm-password").fill("docs-dm-password");
      await page.getByRole("button", { name: "Set password & enter DM mode" }).click();
      await expect(page.getByRole("button", { name: /DM MENU/i })).toBeVisible({
        timeout: 10_000,
      });
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("player basics: table, card, dice, drawing, measure", async ({ page }) => {
    test.setTimeout(150_000);
    ensureImgDir();
    const { step, failures } = makeSteps();

    await step(
      "join table",
      async () => {
        await joinDefaultRoom(page);
        await expect(page.getByTitle("Open table chat and dice roll history")).toBeVisible();
        await focusOwnToken(page);
        await page.waitForTimeout(500);
        await shotPage(page, "table-first-join");
      },
      { required: true },
    );

    await step("party details", async () => {
      await openCharacterDetails(page, ownRosterRow(page));
      await page.waitForTimeout(300);
      await shotPage(page, "party-details");
    });

    await step("player settings + portrait", async () => {
      await openOwnCharacterSettings(page);
      await page.getByPlaceholder("Enter Name").fill("Aria the Bold");
      await page.keyboard.press("Enter");
      await page.getByPlaceholder("https://example.com/portrait.png").fill("/icon-512.png");
      await page.getByRole("button", { name: "Apply Portrait" }).click();
      await page.waitForTimeout(400);
      await shotPage(page, "player-settings");
      await closeTopWindow(page, "Player Settings");
      await closePartyDetails(page);
    });

    await step("dice roller build + result", async () => {
      await page.getByTitle("Open 3D dice roller").click();
      await page.getByTitle("Open table chat and dice roll history").click();
      await expect(page.getByRole("button", { name: "Close Chat & Rolls" })).toBeVisible();
      await page.getByRole("tab", { name: "ROLLS", exact: true }).click();
      await page.getByRole("button", { name: "Add d20", exact: true }).click();
      await page.getByRole("button", { name: "Add d20", exact: true }).click();
      await page.getByRole("button", { name: "Add +1 modifier" }).click();
      await shotPage(page, "dice-roller-built");
      await page.getByRole("button", { name: "Roll dice" }).click();
      await expect(page.getByText("TOTAL")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("No rolls yet...")).toBeHidden();
      await page.waitForTimeout(700);
      await shotPage(page, "dice-result");
      // Toolbar toggles close the roller + log reliably; the floating result
      // panel keeps its own ×.
      await page.getByTitle("Open table chat and dice roll history").click();
      await page.getByTitle("Open 3D dice roller").click();
      await closeTopWindow(page);
      await page.waitForTimeout(300);
    });

    await step("drawing tools", async () => {
      // Give both strokes a visible canvas release point, clear of the header
      // and the expanded character cards used by the preceding captures.
      await hideEntitiesPanel(page);
      await page.getByTitle("Open drawing tools menu").click();
      await page.getByRole("button", { name: "✏️ Freehand", exact: true }).click();
      await page.getByTitle("#ff0000").click();
      const center = await boardCenter(page);
      await dragPath(page, [
        { x: center.x + 120, y: center.y - 60 },
        { x: center.x + 200, y: center.y - 140 },
        { x: center.x + 290, y: center.y - 70 },
        { x: center.x + 360, y: center.y - 150 },
      ]);
      await waitSnap(page, () =>
        Boolean(window.__HERO_BYTE_E2E__?.snapshot?.drawings?.some((d) => d.type === "freehand")),
      );
      await page.getByRole("button", { name: /⬤ Circle/ }).click();
      await dragPath(page, [
        { x: center.x + 140, y: center.y + 60 },
        { x: center.x + 240, y: center.y + 150 },
      ]);
      await waitSnap(page, () =>
        Boolean(window.__HERO_BYTE_E2E__?.snapshot?.drawings?.some((d) => d.type === "circle")),
      );
      await page.waitForTimeout(400);
      await shotPage(page, "drawing-tools");
      await closeTopWindow(page, "Drawing Tools");
    });

    await step("measure tool", async () => {
      await page.getByTitle("Measure distances on the grid").click();
      const center = await boardCenter(page);
      await page.mouse.click(center.x - 200, center.y + 120);
      await page.mouse.move(center.x + 60, center.y - 40, { steps: 10 });
      await page.mouse.click(center.x + 60, center.y - 40);
      await page.waitForTimeout(300);
      await shotPage(page, "measure-tool");
      await page.getByTitle("Measure distances on the grid").click();
    });

    await step("pointer ping", async () => {
      await page.getByRole("button", { name: "👆 Ping" }).click();
      const center = await boardCenter(page);
      await page.mouse.click(center.x - 80, center.y + 40);
      await page.waitForTimeout(350);
      await shotPage(page, "pointer-ping");
      await page.getByRole("button", { name: "👆 Ping" }).click();
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("mobile layout", async ({ browser }) => {
    test.setTimeout(90_000);
    ensureImgDir();
    const { step, failures } = makeSteps();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();

    try {
      await step(
        "mobile join",
        async () => {
          await page.goto("/");
          const passwordInput = page.getByPlaceholder("Table password");
          await expect(passwordInput).toBeEnabled({ timeout: 15_000 });
          await passwordInput.fill(ROOM_PASSWORD);
          await page.getByRole("button", { name: /Enter Table/i }).click();
          await expect(page.getByRole("button", { name: "Party", exact: true })).toBeVisible({
            timeout: 15_000,
          });
          await expect(page.getByRole("button", { name: "Chat", exact: true })).toBeVisible();
          await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible();
          const touch = await openTouch(page);
          try {
            await touchDrag(touch, { x: 100, y: 150 }, [{ x: 265, y: 400 }]);
          } finally {
            await touch.detach();
          }
          await page.waitForTimeout(600);
          await shotPage(page, "mobile-table");
        },
        { required: true },
      );

      await step("mobile tools sheet", async () => {
        await page.getByRole("button", { name: "Tools", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Map tools", exact: true })).toBeVisible();
        await shotPage(page, "mobile-tools");
        // U9: the Table tile opens the phone's Table screen — role and Preferences.
        await page.getByRole("button", { name: "Table", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Table", exact: true })).toBeVisible();
        await page.waitForTimeout(300);
        await shotPage(page, "mobile-table-screen");
        await page.getByRole("button", { name: "Close Table", exact: true }).click();
      });

      await step("mobile party drawer", async () => {
        await page.getByRole("button", { name: "Party", exact: true }).click();
        await expect(
          page.getByRole("dialog", { name: "Party Members", exact: true }),
        ).toBeVisible();
        await shotPage(page, "mobile-party");
        await page.getByRole("button", { name: "Close Party Members" }).click();
      });

      await step("mobile dm screen", async () => {
        // Elevate through the app's own message, as the e2e helpers do.
        await page.evaluate((dmPassword) => {
          window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "elevate-to-dm", dmPassword });
        }, DM_PASSWORD);
        await page.waitForFunction(() => {
          const data = window.__HERO_BYTE_E2E__;
          return data?.snapshot?.players?.find((p) => p.uid === data.uid)?.isDM === true;
        });
        await page.getByRole("button", { name: /^DM$/ }).click();
        // The menu is a lazy chunk; wait for its tabs before shooting — and
        // for the elevation toast to clear, or it covers the chip row.
        await expect(page.getByRole("button", { name: "Maps", exact: true })).toBeVisible({
          timeout: 15_000,
        });
        await expect(page.getByText(/You are in DM mode\./i)).toBeHidden({ timeout: 10_000 });
        await page.waitForTimeout(300);
        await shotPage(page, "mobile-dm");
      });

      expect(failures, failures.join("\n")).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
