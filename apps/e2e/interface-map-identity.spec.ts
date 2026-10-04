import { expect, test, type Page } from "./fixtures";
import {
  activate,
  createAndJoin,
  dock,
  mapLauncher,
  observeWire,
  publicBarrier,
} from "./u2-cancel.helpers";
import { readState } from "./chat-journey.helpers";

// U6: maps are three different things. The DM always sees what the party is on
// ("On table") and, when different, what is open in the library ("Viewing in
// library"). Opening a saved map never moves the party; Build names both and
// resumes the table's map only when asked; Use at table moves the party only
// after a confirm that names both maps. The player's own snapshot is the
// oracle for "the party moved": its compiled scene names its source document.

const REGION = { x: 3, y: 3, cols: 24, rows: 20 };
const LIBRARY_MAP = "Tavern U6";

const sceneSource = async (page: Page) =>
  (await readState(page)).snapshot.compiledScene?.sourceDocumentId;
const sceneWalls = async (page: Page) =>
  (await readState(page)).snapshot.compiledScene?.walls.length ?? 0;
const liveId = async (dm: Page) => (await readState(dm)).snapshot.liveMapDocumentId;

async function openMaps(dm: Page, touch: boolean) {
  const tab = dm.getByRole("button", { name: "Maps", exact: true });
  if (!(await tab.isVisible())) {
    const launcher = touch
      ? dm
          .getByRole("navigation", { name: "Mobile actions" })
          .getByRole("button", { name: "DM", exact: true })
      : dm.getByRole("button", { name: /DM MENU/i });
    await activate(launcher, touch);
  }
  await activate(tab, touch);
  return dm.getByTestId("table-map-identity");
}

async function closeMaps(dm: Page, touch: boolean) {
  if (touch) await dm.getByRole("button", { name: "Close DM Menu", exact: true }).tap();
  // The window can cover its own launcher at 1366×768; close it by its own ×.
  else await dm.getByRole("button", { name: "Close Dungeon Master Tools", exact: true }).click();
  await expect(dm.getByTestId("table-map-identity")).toHaveCount(0);
}

/** Enter Build and show its palette; returns the palette's scope. */
async function openBuild(dm: Page, touch: boolean) {
  if (touch) {
    await dm
      .getByRole("navigation", { name: "Mobile actions" })
      .getByRole("button", { name: "DM", exact: true })
      .tap();
    await dm.getByRole("button", { name: /Edit the live map/i }).tap();
    await dock(dm).getByRole("button", { name: "Tool", exact: true }).tap();
    return dm.getByRole("dialog", { name: "Map tools", exact: true });
  }
  await mapLauncher(dm).click();
  return dm.getByTestId("build-settings");
}

async function leaveBuild(dm: Page, touch: boolean) {
  if (touch) {
    const sheet = dm.getByRole("dialog", { name: "Map tools", exact: true });
    if (await sheet.isVisible()) await sheet.getByRole("button", { name: "Close tools" }).tap();
    await dock(dm)
      .getByRole("button", { name: /Done building/ })
      .tap();
  } else {
    await dm.getByRole("button", { name: "Done building", exact: true }).click();
  }
  await expect(mapLauncher(dm)).toHaveCount(touch ? 0 : 1);
}

async function selectSaved(dm: Page, touch: boolean, name: string) {
  const select = dm.getByLabel("Saved maps", { exact: true });
  const value = await select.locator("option", { hasText: name }).first().getAttribute("value");
  await select.selectOption(value!);
  return value!;
}

for (const layout of ["desktop", "phone"] as const) {
  const touch = layout === "phone";
  test(`U6 ${layout}: the table map and the library map are named apart; only Use at table moves the party`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const dmContext = await browser.newContext(
      touch
        ? { baseURL, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true }
        : { baseURL, viewport: { width: 1366, height: 768 } },
    );
    const playerContext = await browser.newContext({ baseURL });
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    dm.setDefaultTimeout(15_000);
    player.setDefaultTimeout(15_000);
    const wire = observeWire(dm);
    const prompts: string[] = [];
    dm.on("dialog", (dialog) => {
      prompts.push(dialog.message());
      void dialog.accept();
    });
    try {
      await createAndJoin(dm, player, touch, `U6 map identity ${layout}`);

      // A goes on the table, with real geometry the player receives.
      const build = await openBuild(dm, touch);
      await activate(build.getByRole("button", { name: /Start live map/i }), touch);
      await expect.poll(() => liveId(dm)).toBeTruthy();
      const mapA = (await liveId(dm))!;
      await dm.evaluate(
        ([documentId, region]) =>
          window.__HERO_BYTE_E2E__!.sendMessage!({
            t: "map-studio-generate",
            documentId: documentId as string,
            commandId: `u6-map-a-${Date.now()}`,
            recipe: "dungeon",
            seed: 20260927,
            bounds: region as typeof REGION,
            params: { theme: "stone", density: "medium" },
          }),
        [mapA, REGION] as const,
      );
      await expect.poll(() => sceneWalls(player), { timeout: 20_000 }).toBeGreaterThan(0);
      expect(await sceneSource(player)).toBe(mapA);
      const wallsOnA = await sceneWalls(player);
      await leaveBuild(dm, touch);

      // The Maps tab names the table map; nothing else is open.
      let identity = await openMaps(dm, touch);
      await expect(identity).toContainText("On table: Live Map");
      await expect(identity).not.toContainText("Viewing in library");
      const nameA = ((await identity.textContent()) ?? "").replace("On table: ", "").trim();

      // A new library map opens for viewing; the party stays on A.
      await dm.getByLabel("New map name", { exact: true }).fill(LIBRARY_MAP);
      await activate(dm.getByRole("button", { name: "＋ Create map in library" }), touch);
      await expect(identity).toContainText(`Viewing in library: ${LIBRARY_MAP}`);
      await expect(identity).toContainText(`On table: ${nameA}`);
      await publicBarrier(player, [dm, player], "U6 library map created");
      expect(await sceneSource(player)).toBe(mapA);
      await closeMaps(dm, touch);

      // Build names both, keeps B open, and resumes A only when asked.
      const beforeBuild = wire.sent.length;
      const rxBeforeBuild = wire.received.length;
      const entry = await openBuild(dm, touch);
      await expect(entry.getByText(/^On table:/)).toHaveText(`On table: ${nameA}`);
      await expect(entry.getByText(/^Viewing in library:/)).toHaveText(
        `Viewing in library: ${LIBRARY_MAP}`,
      );
      await expect(entry.getByRole("button", { name: /Start live map/i })).toHaveCount(0);
      const resume = entry.getByRole("button", { name: `▶ Resume editing ${nameA}` });
      await expect(resume).toBeEnabled();
      // Opening Build alone must not swap documents. The one async event entry
      // starts is its quiet list; once that reply has landed (and a round trip
      // after it), the wire says whether anything opened or bound.
      await expect
        .poll(() => wire.received.slice(rxBeforeBuild).some((m) => m.t === "map-studio-documents"))
        .toBe(true);
      await publicBarrier(player, [dm, player], "U6 Build entry settled");
      const swaps = wire.sent
        .slice(beforeBuild)
        .filter((m) => m.t === "map-studio-get" || m.t === "map-studio-set-live");
      expect(swaps).toEqual([]);
      await expect(resume).toBeVisible();
      await activate(resume, touch);
      await expect(dm.getByTestId("build-persistent-controls")).toBeVisible();
      // Resume opened A for editing; nothing moved: the binding and the party stay on A.
      expect(await liveId(dm)).toBe(mapA);
      await publicBarrier(player, [dm, player], "U6 resume");
      expect(await sceneSource(player)).toBe(mapA);
      await leaveBuild(dm, touch);
      identity = await openMaps(dm, touch);
      await expect(identity).not.toContainText("Viewing in library");

      // Use at table: confirmed, names both maps, and the player follows.
      const mapB = await selectSaved(dm, touch, LIBRARY_MAP);
      let asked = prompts.length;
      await activate(dm.getByRole("button", { name: "Use at table", exact: true }), touch);
      await expect.poll(() => sceneSource(player)).toBe(mapB);
      expect(prompts, "one confirmation, not two").toHaveLength(asked + 1);
      expect(prompts.at(-1)).toContain(`Put "${LIBRARY_MAP}" on the table for everyone?`);
      expect(prompts.at(-1)).toContain(`"${nameA}"`);
      await expect(identity).toContainText(`On table: ${LIBRARY_MAP}`);
      await expect(
        dm.getByRole("status").filter({ hasText: `"${LIBRARY_MAP}" is on the table.` }),
      ).toBeVisible();
      expect(await sceneWalls(player)).toBe(0);

      // Reopening the menu and resizing cannot bind a different map.
      await closeMaps(dm, touch);
      await dm.setViewportSize(touch ? { width: 812, height: 375 } : { width: 1024, height: 700 });
      identity = await openMaps(dm, touch);
      await expect(identity).toContainText(`On table: ${LIBRARY_MAP}`);
      await publicBarrier(player, [dm, player], "U6 reopen and resize");
      expect(await sceneSource(player)).toBe(mapB);

      // And back: A returns exactly as it stood.
      await selectSaved(dm, touch, nameA);
      asked = prompts.length;
      await activate(dm.getByRole("button", { name: "Use at table", exact: true }), touch);
      await expect.poll(() => sceneSource(player)).toBe(mapA);
      expect(prompts, "one confirmation, not two").toHaveLength(asked + 1);
      await expect.poll(() => sceneWalls(player)).toBe(wallsOnA);
      expect(await liveId(dm)).toBe(mapA);
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });
}
