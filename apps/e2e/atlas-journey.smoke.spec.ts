import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";

// The Maya loop, end to end (Atlas arc A7): a DM turns two promises into
// dungeons, travels the whole table between them, pins a travel sprite, and
// the suspended scene RESUMES exactly — while the player's socket never
// carries an undiscovered node's name, any recipe provenance, or a
// sceneState.
//
// UI drives the moments that matter (CREATE NODE, the generate panel, the
// TRAVEL confirm, the ⚓ AIM placement); the harness seam drives bookkeeping
// (door toggles, wire assertions). Secrecy is asserted on KEYS, never on
// value substrings — a decimal seed inside epoch-millisecond soup is the
// CI #828 false-positive shape. Serial like every spec here; cleanup deletes
// the nodes, the link and both generated documents in `finally`, and the
// shared resetRoom fixture is the backstop if the run dies mid-journey.

async function waitForSnap<T>(
  page: Page,
  predicate: (arg: T) => boolean,
  arg?: T,
  timeout = 20_000,
) {
  await page.waitForFunction(predicate, arg as T, { timeout });
}

async function openAtlasTab(page: Page) {
  // 🛠️ DM MENU is a TOGGLE — clicking it with the window already open closes
  // it, and the Atlas click then waits forever for a button that never comes.
  const atlasTab = page.getByRole("button", { name: "Atlas" });
  if (!(await atlasTab.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "🛠️ DM MENU" }).click();
  }
  await atlasTab.click();
  await expect(page.getByLabel("New node name")).toBeVisible({ timeout: 15_000 });
}

async function createNode(page: Page, name: string) {
  await page.getByLabel("New node name").fill(name);
  await page.getByRole("button", { name: "+ CREATE NODE" }).click();
  await expect(page.getByLabel(`promise: ${name}`)).toBeVisible();
}

/** Generate the named promise through the panel UI (small = fastest). */
async function generateNode(page: Page, name: string) {
  const row = page.getByLabel(`promise: ${name}`).locator("xpath=ancestor::li[1]");
  await row.getByRole("button", { name: "🎲 Generate…" }).click();
  await page.getByLabel(`Size for ${name}`).selectOption("small");
  // Playwright role-name matching is SUBSTRING by default, and "🎲 GENERATE"
  // is inside every row's "🎲 Generate…" — scope to the panel.
  await page
    .getByTestId("atlas-generate-panel")
    .getByRole("button", { name: "🎲 GENERATE" })
    .click();
  await waitForSnap(
    page,
    (wanted) =>
      Boolean(
        window.__HERO_BYTE_E2E__?.snapshot?.atlasNodes?.find(
          (node) => node.name === wanted && (node as { mapDocumentId?: string }).mapDocumentId,
        ),
      ),
    name,
    30_000,
  );
}

function nodeByName(page: Page, name: string) {
  return page.evaluate(
    (wanted) =>
      window.__HERO_BYTE_E2E__!.snapshot!.atlasNodes!.find((node) => node.name === wanted) as {
        id: string;
        mapDocumentId?: string;
      },
    name,
  );
}

/** Click the row's 🚩 TRAVEL (the dialog listener accepts the confirm). */
async function travelTo(page: Page, name: string) {
  const target = await nodeByName(page, name);
  const row = page
    .getByLabel(new RegExp(`^(mapped|promise|you are here): ${name}$`))
    .locator("xpath=ancestor::li[1]");
  await row.getByRole("button", { name: "🚩 TRAVEL" }).click();
  await waitForSnap(
    page,
    (id) => window.__HERO_BYTE_E2E__?.snapshot?.currentAtlasNodeId === id,
    target.id,
    30_000,
  );
}

test.describe("Atlas journey smoke", () => {
  test("promise → dungeon → travel → link → back: scenes resume, players see only the discovered world", async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    // Every window.confirm in the journey (TRAVEL, deletes) is a yes.
    dm.on("dialog", (dialog) => void dialog.accept());

    try {
      await joinDefaultRoomAsDM(dm);
      await openAtlasTab(dm);

      // ---- Two promises; only what the DM travels to is ever discovered ----
      await createNode(dm, "Vault A");
      await createNode(dm, "Vault B");
      await generateNode(dm, "Vault A");
      await generateNode(dm, "Vault B");
      const vaultA = await nodeByName(dm, "Vault A");
      const vaultB = await nodeByName(dm, "Vault B");

      // ---- Travel to A (auto-discovers it); the table gets A's dungeon ----
      await travelTo(dm, "Vault A");
      await waitForSnap(dm, () => {
        const scene = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene;
        return (scene?.walls?.length ?? 0) > 4 && (scene?.doors?.length ?? 0) > 0;
      });

      // ---- The player joins mid-campaign: A visible, B does not exist ----
      await joinDefaultRoom(player);
      await waitForSnap(player, () =>
        Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length),
      );
      const playerWire = await player.evaluate(() => {
        const snapshot = window.__HERO_BYTE_E2E__!.snapshot!;
        return {
          names: snapshot.atlasNodes!.map((node) => node.name),
          nodeKeySets: snapshot.atlasNodes!.map((node) => Object.keys(node).sort()),
          raw: JSON.stringify(snapshot),
        };
      });
      expect(playerWire.names).toEqual(["Vault A"]);
      // The whitelist at the wire: no recipe (seed lives inside it), no DM
      // prep state — the exact projected key set, nothing more.
      expect(playerWire.nodeKeySets).toEqual([["discovered", "id", "kind", "name"]]);
      expect(playerWire.raw).not.toContain("Vault B");
      expect(playerWire.raw).not.toContain('"recipe"');
      expect(playerWire.raw).not.toContain('"sceneStates"');

      // ---- Leave a mark on A: open its first door ----
      const doorId = await dm.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const door = data.snapshot!.compiledScene!.doors[0]!;
        data.sendMessage!({ t: "toggle-door", doorId: door.id });
        return door.id;
      });
      await waitForSnap(
        dm,
        (id) =>
          window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.find((door) => door.id === id)
            ?.state === "open",
        doorId,
      );

      // ---- Travel to B: the player's map follows, discovery reaches them ----
      await travelTo(dm, "Vault B");
      await waitForSnap(
        player,
        (docId) => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId === docId,
        vaultB.mapDocumentId,
      );
      // Generated nodes conceal by default: the player renders B under fog.
      expect(await player.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.fogEnabled)).toBe(
        true,
      );
      // NOW a scene is actually suspended (A, with its open door) — the only
      // moment the sceneStates secrecy claim can be non-vacuous. The first
      // wire capture ran before any suspension existed (the arc's review).
      const suspendedWire = await player.evaluate(() =>
        JSON.stringify(window.__HERO_BYTE_E2E__!.snapshot),
      );
      expect(suspendedWire).not.toContain('"sceneStates"');
      expect(suspendedWire).not.toContain('"doorStates"');

      // ---- The player's world map: both discovered, "you are here" on B ----
      await player.getByRole("button", { name: "🗺 WORLD" }).click();
      await expect(player.getByLabel("you are here: Vault B")).toBeVisible();
      await expect(player.getByLabel("Vault A", { exact: true })).toBeVisible();

      // ---- The DM pins a stair on B leading back to A, by aiming ----
      await openAtlasTab(dm);
      await dm.getByLabel("Link target from Vault B").selectOption(vaultA.id);
      await dm.getByLabel("Link type").selectOption("stair");
      await dm.getByRole("button", { name: "⚓ AIM ON MAP" }).click();
      await dm.locator(".konvajs-content").click({ position: { x: 200, y: 150 } });
      await waitForSnap(
        player,
        () => (window.__HERO_BYTE_E2E__?.snapshot?.atlasLinks?.length ?? 0) === 1,
      );

      // ---- Travel back to A: the suspended scene RESUMES — the door is open ----
      await openAtlasTab(dm);
      await travelTo(dm, "Vault A");
      await waitForSnap(
        dm,
        (id) =>
          window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors?.find((door) => door.id === id)
            ?.state === "open",
        doorId,
      );
      await waitForSnap(
        player,
        (docId) => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId === docId,
        vaultA.mapDocumentId,
      );
    } finally {
      // Best-effort teardown so the NEXT spec's reset has less to clear:
      // the link, both nodes, and both generated documents.
      await dm
        .evaluate(() => {
          const data = window.__HERO_BYTE_E2E__;
          if (!data?.snapshot) return;
          for (const link of data.snapshot.atlasLinks ?? []) {
            data.sendMessage!({ t: "atlas-delete-link", linkId: link.id });
          }
          for (const node of data.snapshot.atlasNodes ?? []) {
            const documentId = (node as { mapDocumentId?: string }).mapDocumentId;
            data.sendMessage!({ t: "atlas-delete-node", nodeId: node.id });
            if (documentId) {
              data.sendMessage!({ t: "map-studio-delete", documentId });
            }
          }
        })
        .catch(() => undefined);
      await dmContext.close();
      await playerContext.close();
    }
  });
});
