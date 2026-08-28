/**
 * The DM screen (M4b): a DM on a phone reaches the full menu — background,
 * grid, fog, staging zone, NPC/prop CRUD, session save/load, invite link and
 * table password — through a scrollable chip row of the same five tabs the
 * desktop window has. The tab views are reused unchanged; what this spec
 * proves is REACHABILITY on a 375px screen, where "on screen at once" is the
 * wrong bar (the body scrolls) but "reachable by scrolling, at the 44px
 * floor" is the contract.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";

async function openDMScreen(page: Page): Promise<void> {
  await elevateToDM(page);
  await page
    .getByRole("navigation", { name: /Mobile actions/i })
    .getByRole("button", { name: /^DM$/i })
    .click();
  await expect(page.getByRole("dialog", { name: "DM Menu" })).toBeVisible();
  // The menu is a lazy chunk on mobile exactly as on desktop — wait for it.
  await expect(page.getByRole("button", { name: "Map Setup" })).toBeVisible({ timeout: 15_000 });
}

/** Assert a control is reachable by scrolling, then leave it in view. */
async function reach(page: Page, locator: ReturnType<Page["getByText"]>): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
}

test.describe("mobile — the DM screen", () => {
  test("every tab is a >=44px chip on one scrollable row, and each opens its view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openDMScreen(page);

    const dialog = page.getByRole("dialog", { name: "DM Menu" });

    // The chip row: all five tabs on ONE row at the touch floor. On a 375px
    // screen five labelled chips cannot fit at once, so the row itself must
    // scroll — that is the M4b design, not an accident to paper over.
    const chips = await page.evaluate(() => {
      const labels = ["Map Setup", "NPCs & Monsters", "Props & Objects", "Players", "Session"];
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) =>
        labels.includes((b.textContent || "").trim()),
      );
      const row = buttons[0]?.parentElement;
      return {
        count: buttons.length,
        shortest: Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().height))),
        rows: new Set(buttons.map((b) => b.offsetTop)).size,
        rowScrolls: row ? row.scrollWidth > row.clientWidth : false,
      };
    });
    expect(chips.count).toBe(5);
    expect(chips.shortest).toBeGreaterThanOrEqual(44);
    expect(chips.rows).toBe(1);
    expect(chips.rowScrolls).toBe(true);

    // Map (the default tab): background, grid, fog, staging zone — the four
    // §M4b done-when items that live here, each reachable by scrolling.
    await reach(page, dialog.getByText("Map Background", { exact: true }));
    await expect(dialog.getByPlaceholder("Paste image URL")).toBeVisible();
    await reach(page, dialog.getByText("Grid Controls"));
    await reach(page, dialog.getByText("Grid Size"));
    await reach(page, dialog.getByText("Fog of War"));
    await reach(page, dialog.getByText("Player Staging Zone"));

    // NPCs.
    await dialog.getByRole("button", { name: "NPCs & Monsters" }).click();
    await reach(page, dialog.getByRole("button", { name: "+ Add NPC" }));

    // Props.
    await dialog.getByRole("button", { name: "Props & Objects" }).click();
    await reach(page, dialog.getByRole("button", { name: "+ Add Prop" }));

    // Players.
    await dialog.getByRole("button", { name: "Players", exact: true }).click();
    await reach(page, dialog.getByRole("button", { name: /SELECT ALL/i }).first());

    // Session: save/load, invite link, and — on the public test table — the
    // save-as-private-table flow that stands in for the password control.
    await dialog.getByRole("button", { name: "Session", exact: true }).click();
    await reach(page, dialog.getByText("Session Save/Load"));
    await reach(page, dialog.getByText("Invite Players"));
    await reach(page, dialog.getByText(/Save as a Private Table/i));
  });

  test("NPC create and delete, end to end by touch", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openDMScreen(page);

    const dialog = page.getByRole("dialog", { name: "DM Menu" });
    await dialog.getByRole("button", { name: "NPCs & Monsters" }).click();

    const before = await page.evaluate(
      () =>
        (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? [])
          .filter((c: { type?: string }) => c.type === "npc")
          .map((c: { id: string }) => c.id) as string[],
    );

    try {
      const addNpc = dialog.getByRole("button", { name: "+ Add NPC" });
      await addNpc.scrollIntoViewIfNeeded();
      await addNpc.click();

      // The round trip is real: the snapshot grows an NPC and its card shows.
      await page.waitForFunction((count) => {
        const npcs = (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
          (c: { type?: string }) => c.type === "npc",
        );
        return npcs.length === count + 1;
      }, before.length);
      await expect(dialog.getByText(/No NPCs yet/i)).toBeHidden();
    } finally {
      // The default table is shared between specs AND runs; delete exactly
      // what this spec added, through the app's own message.
      await page.evaluate((preexisting) => {
        const npcs = (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
          (c: { type?: string }) => c.type === "npc",
        );
        for (const npc of npcs) {
          if (!preexisting.includes(npc.id)) {
            window.__HERO_BYTE_E2E__?.sendMessage?.({ t: "delete-npc", id: npc.id });
          }
        }
      }, before);
      await page.waitForFunction((count) => {
        const npcs = (window.__HERO_BYTE_E2E__?.snapshot?.characters ?? []).filter(
          (c: { type?: string }) => c.type === "npc",
        );
        return npcs.length === count;
      }, before.length);
    }
  });

  for (const vp of [
    { width: 375, height: 812, label: "portrait" },
    { width: 812, height: 375, label: "landscape" },
  ]) {
    test(`no tab view clips content off the screen's edge (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await joinMobileTable(page);
      await openDMScreen(page);
      const dialog = page.getByRole("dialog", { name: "DM Menu" });

      // The chip row scrolls horizontally BY DESIGN; anything else that makes
      // the body wider than the screen is content a phone can never reach —
      // .mobile-layout-root is overflow:hidden, so clipped-right is gone, not
      // scrollable.
      //
      // This used to add "44px floors inside the reused tab views are a
      // deliberate non-goal — the owner's deferred panel-wide pass". That pass
      // has landed, and the floor is asserted across all five tabs in
      // mobile-panel-touch-floor.spec.ts. Width is still this test's job;
      // height is that one's.
      const tabs = ["Map Setup", "NPCs & Monsters", "Props & Objects", "Players", "Session"];
      for (const tab of tabs) {
        await dialog.getByRole("button", { name: tab, exact: true }).click();
        const report = await page.evaluate((label) => {
          const body = document.querySelector(".mobile-screen__body") as HTMLElement;
          const wide = [...body.querySelectorAll<HTMLElement>("*")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              // Ignore elements inside a horizontal scroller (the chip row).
              const scroller = el.closest("[style*='overflow-x']");
              return r.right > window.innerWidth + 1 && !scroller;
            })
            .slice(0, 5)
            .map((el) => `${(el.className || el.tagName).toString().slice(0, 40)}`);
          return {
            label,
            bodyClips: body.scrollWidth > body.clientWidth + 1,
            wide,
            pageOverflows: document.documentElement.scrollWidth > window.innerWidth,
          };
        }, tab);
        expect(report.wide, `${vp.label}/${tab}: ${report.wide.join(", ")}`).toEqual([]);
        expect(report.bodyClips, `${vp.label}/${tab} body clips`).toBe(false);
        expect(report.pageOverflows).toBe(false);
      }
    });
  }

  test("Map Studio is reachable and usable on a phone", async ({ page }) => {
    // M4b's completeness critic named this: MapStudioControl became
    // phone-reachable with no phone coverage at all. It is a dense control —
    // a text field, two number fields, a select and six buttons — written for
    // a 360-500px desktop window, so "it renders" is not the question; the
    // question is whether a finger can operate it.
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openDMScreen(page);
    const dialog = page.getByRole("dialog", { name: "DM Menu" });

    await reach(page, dialog.getByText("HeroByte Map Studio"));

    // The create form: every field reachable, and nothing clipped sideways.
    await reach(page, dialog.getByLabel("New map name"));
    await reach(page, dialog.getByLabel("Width in pixels"));
    await reach(page, dialog.getByLabel("Height in pixels"));
    const create = dialog.getByRole("button", { name: /CREATE EDITABLE MAP/i });
    await reach(page, create);
    // NOT asserting the 44px floor here. Measured: 26px — and that is the
    // OWNER-DEFERRED class, not a new defect. Every JRPGButton inside these
    // tab views is the same height (handoff §3D records chat's SEND at 25px),
    // and M4b recorded "44px floors INSIDE the tab views" as an explicit
    // non-goal awaiting a deliberate panel-wide pass. Asserting it here would
    // either fail on shipped behaviour or quietly re-scope that decision.

    // The saved-maps row is four controls wide on a 375px screen — the shape
    // most likely to spill. Assert it does not, rather than assuming.
    await reach(page, dialog.getByLabel("Saved maps"));
    for (const name of [/^OPEN$/, /^DELETE$/, /IMPORT JSON BACKUP/i]) {
      const control = dialog.getByRole("button", { name });
      await reach(page, control);
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(375);
    }

    const report = await page.evaluate(() => {
      const body = document.querySelector(".mobile-screen__body") as HTMLElement;
      return {
        bodyClips: body.scrollWidth > body.clientWidth + 1,
        pageOverflows: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(report.bodyClips).toBe(false);
    expect(report.pageOverflows).toBe(false);
  });

  test("the alignment wizard, armed, still fits the phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await openDMScreen(page);
    const dialog = page.getByRole("dialog", { name: "DM Menu" });

    await reach(page, dialog.getByText("Grid Alignment Wizard"));
    await dialog.getByRole("button", { name: "Start Alignment" }).click();

    // M4c closed the gap M4b recorded here. Arming now YIELDS THE SCREEN,
    // because capturing points needs the map underneath it — it used to mean
    // close, tap two points, reopen, apply. The wizard stays armed across the
    // dismissal: the mode is App state, not screen state.
    await expect(dialog).toBeHidden();
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: /^DM$/i })
      .click();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();

    // The armed wizard was the redesign doc's predicted offender — measure it
    // armed, not at rest.
    const report = await page.evaluate(() => {
      const body = document.querySelector(".mobile-screen__body") as HTMLElement;
      return {
        bodyClips: body.scrollWidth > body.clientWidth + 1,
        pageOverflows: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(report.bodyClips).toBe(false);
    expect(report.pageOverflows).toBe(false);

    // And it disarms cleanly from the same screen — WITHOUT the screen
    // vanishing under the DM who pressed Cancel. Arming yields the map;
    // disarming is not the same edge inverted.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Start Alignment" })).toBeVisible();
  });

  test("the chips hold the floor in landscape too", async ({ page }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    await joinMobileTable(page);
    await openDMScreen(page);

    const shortest = await page.evaluate(() => {
      const labels = ["Map Setup", "NPCs & Monsters", "Props & Objects", "Players", "Session"];
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) =>
        labels.includes((b.textContent || "").trim()),
      );
      return Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().height)));
    });
    expect(shortest).toBeGreaterThanOrEqual(44);

    await expect(
      page.getByRole("dialog", { name: "DM Menu" }).getByPlaceholder("Paste image URL"),
    ).toBeVisible();
  });
});
