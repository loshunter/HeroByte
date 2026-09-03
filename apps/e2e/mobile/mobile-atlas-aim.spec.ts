/**
 * The atlas-link aim under a finger — the mobile-surface review lens's L1/L2/L3,
 * driven the way a phone DM actually drives them (CDP touch, not compat clicks).
 *
 *   L3  the aim survives a pan and a pinch, and neither places a link; a real
 *       tap still does (Konva fires a Stage `tap` at the end of EVERY gesture —
 *       useAimTouchGuard is what tells them apart).
 *   L2  an aimed tap that lands on a door places the link instead of swinging
 *       the door for the whole table.
 *   L1  with a tool armed (Draw), a tap on a travel sprite opens NO travel
 *       confirm — the badge went deaf, the press belonged to the tool.
 *
 * The observables are the seam's snapshot (links, doors, the camera) and the
 * count of native confirm dialogs — the travel prompt is a window.confirm, so
 * "no dialog fired" is the only faithful way to say "no travel was offered".
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { boardBox, joinMobileTable, readCam } from "./mobile.helpers";
import { openTouch, touchDrag, touchPinch, touchTap, type Pt } from "./touch.helpers";

const VIEWPORT = { width: 375, height: 812 };

async function openAtlasChip(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "DM Menu" });
  // TRAVEL leaves the full-viewport DM screen up, and it covers the dock —
  // so only reach for the dock button when the screen is not already open.
  if (!(await dialog.isVisible().catch(() => false))) {
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: /^DM$/i })
      .click();
  }
  await expect(dialog).toBeVisible();
  const atlasChip = dialog.getByRole("button", { name: "Atlas" });
  await atlasChip.scrollIntoViewIfNeeded();
  await atlasChip.click();
  await expect(dialog.getByLabel("New node name")).toBeVisible({ timeout: 15_000 });
}

const linkCount = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.atlasLinks?.length ?? 0);

/** Arm the one-shot aim from the Atlas tab: target the promise, ⚓ AIM ON MAP. */
async function armAim(page: Page): Promise<void> {
  await openAtlasChip(page);
  const dialog = page.getByRole("dialog", { name: "DM Menu" });
  // The target select starts on "Pick a node…" with the aim disabled.
  const target = dialog.getByLabel("Link target from Waystone");
  await target.scrollIntoViewIfNeeded();
  await target.selectOption({ label: "Beyond" });
  const aim = dialog.getByRole("button", { name: "⚓ AIM ON MAP" });
  await aim.scrollIntoViewIfNeeded();
  await aim.click();
  // Arming closes the DM screen (the surface machine's rising edge) and the
  // aim banner takes its place.
  await expect(page.getByText("Link Placement")).toBeVisible();
}

/** Put a DOCUMENT-px point at the centre of the canvas, and return its screen position. */
async function centreOn(page: Page, doc: Pt): Promise<Pt> {
  const box = await boardBox(page);
  await page.evaluate(
    ({ doc, w, h }) => {
      const data = window.__HERO_BYTE_E2E__!;
      const scale = data.cam!.scale;
      data.setCam!({ x: w / 2 - doc.x * scale, y: h / 2 - doc.y * scale, scale });
    },
    { doc, w: box.width, h: box.height },
  );
  await page.waitForTimeout(100);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("mobile — the atlas-link aim under a finger", () => {
  test("pan and pinch survive the aim, a door yields to it, and a deaf badge never prompts", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const dmContext = await browser.newContext({ viewport: VIEWPORT });
    const dm = await dmContext.newPage();
    let dialogs = 0;
    dm.on("dialog", (dialog) => {
      dialogs += 1;
      void dialog.accept();
    });

    try {
      await joinMobileTable(dm);
      await elevateToDM(dm);
      await openAtlasChip(dm);
      const dialog = dm.getByRole("dialog", { name: "DM Menu" });

      // A cashed node to stand on (its doors are L2's targets) and a promise
      // to aim at.
      await dialog.getByLabel("New node name").fill("Waystone");
      await dialog.getByRole("button", { name: "+ CREATE NODE" }).click();
      const generateOpen = dialog.getByRole("button", { name: "🎲 Generate…" });
      await generateOpen.scrollIntoViewIfNeeded();
      await generateOpen.click();
      await dialog.getByLabel("Size for Waystone").selectOption("small");
      await dialog
        .getByTestId("atlas-generate-panel")
        .getByRole("button", { name: "🎲 GENERATE" })
        .click();
      await dm.waitForFunction(
        () =>
          Boolean(
            window.__HERO_BYTE_E2E__?.snapshot?.atlasNodes?.find(
              (node) =>
                node.name === "Waystone" && (node as { mapDocumentId?: string }).mapDocumentId,
            ),
          ),
        undefined,
        { timeout: 30_000 },
      );
      const travel = dialog.getByRole("button", { name: "🚩 TRAVEL" });
      await travel.scrollIntoViewIfNeeded();
      await travel.click();
      await dm.waitForFunction(
        () => {
          const data = window.__HERO_BYTE_E2E__;
          const here = data?.snapshot?.atlasNodes?.find(
            (node) => node.id === data.snapshot?.currentAtlasNodeId,
          );
          return here?.name === "Waystone";
        },
        undefined,
        { timeout: 30_000 },
      );
      const dialogsAfterTravel = dialogs;
      await openAtlasChip(dm);
      await dialog.getByLabel("New node name").fill("Beyond");
      await dialog.getByRole("button", { name: "+ CREATE NODE" }).click();
      await expect(dialog.getByLabel("promise: Beyond")).toBeVisible();
      // The screen covers the dock; its own ✕ is the way out.
      await dialog.getByRole("button", { name: "Close DM Menu" }).click();
      await expect(dialog).toBeHidden();

      const cdp = await openTouch(dm);
      const box = await boardBox(dm);
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

      // ---- L3: pan, pinch, tap ----
      await armAim(dm);
      expect(await linkCount(dm)).toBe(0);
      const before = (await readCam(dm))!;
      await touchDrag(cdp, centre, [{ x: centre.x + 120, y: centre.y + 40 }]);
      await dm.waitForTimeout(300);
      expect(await linkCount(dm)).toBe(0); // a pan is not a tap
      const panned = (await readCam(dm))!;
      expect(Math.abs(panned.x - before.x)).toBeGreaterThan(60); // and it DID pan
      await expect(dm.getByText("Link Placement")).toBeVisible(); // the aim survived
      await touchPinch(
        cdp,
        [
          { x: centre.x - 40, y: centre.y },
          { x: centre.x + 40, y: centre.y },
        ],
        [
          { x: centre.x - 90, y: centre.y },
          { x: centre.x + 90, y: centre.y },
        ],
      );
      await dm.waitForTimeout(300);
      expect(await linkCount(dm)).toBe(0); // a pinch is not a tap
      const pinched = (await readCam(dm))!;
      expect(pinched.scale).toBeGreaterThan(panned.scale * 1.3); // and it DID zoom
      await expect(dm.getByText("Link Placement")).toBeVisible();
      await touchTap(cdp, centre);
      await dm.waitForFunction(
        () => (window.__HERO_BYTE_E2E__?.snapshot?.atlasLinks?.length ?? 0) === 1,
        undefined,
        { timeout: 15_000 },
      );
      await expect(dm.getByText("Link Placement")).toBeHidden(); // one-shot

      // ---- L2: an aimed tap on a door places the link, the door stays shut ----
      const door = await dm.evaluate(() => {
        const doors = window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors ?? [];
        const first = doors[0];
        return first
          ? {
              id: first.id,
              state: first.state,
              mid: { x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 },
            }
          : null;
      });
      expect(door).not.toBeNull();
      await armAim(dm);
      const doorScreen = await centreOn(dm, door!.mid);
      await touchTap(cdp, doorScreen);
      await dm.waitForFunction(
        () => (window.__HERO_BYTE_E2E__?.snapshot?.atlasLinks?.length ?? 0) === 2,
        undefined,
        { timeout: 15_000 },
      );
      const doorAfter = await dm.evaluate(
        (id) =>
          window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.doors.find((d) => d.id === id)?.state,
        door!.id,
      );
      expect(doorAfter).toBe(door!.state);

      // ---- L1: a deaf badge under an armed tool never prompts ----
      const anchor = await dm.evaluate(() => {
        const link = window.__HERO_BYTE_E2E__?.snapshot?.atlasLinks?.[0];
        return link ? { x: link.anchor.x, y: link.anchor.y } : null;
      });
      expect(anchor).not.toBeNull();
      const badgeScreen = await centreOn(dm, anchor!);
      await dm.getByRole("button", { name: /Tools/i }).click();
      await dm.getByRole("button", { name: /^Draw$/i }).click();
      const dialogsBeforeTap = dialogs;
      const hereBefore = await dm.evaluate(
        () => window.__HERO_BYTE_E2E__?.snapshot?.currentAtlasNodeId,
      );
      await touchTap(cdp, badgeScreen);
      await dm.waitForTimeout(600);
      expect(dialogs).toBe(dialogsBeforeTap); // no travel confirm
      expect(await dm.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.currentAtlasNodeId)).toBe(
        hereBefore,
      );
      expect(dialogsAfterTravel).toBeGreaterThanOrEqual(1); // the counter itself works
    } finally {
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
    }
  });
});
