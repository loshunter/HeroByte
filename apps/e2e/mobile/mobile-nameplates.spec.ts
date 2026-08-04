/**
 * S4 mobile commitment (arc §7a): nameplates must stay legible at 375px, not
 * just on a 1440px canvas. The canvas is opaque to DOM queries, so this reads
 * the REAL rendered scene graph: Konva self-injects onto window, and MapBoard
 * owns the app's only Stage — `window.Konva.stages[0].find(".token-nameplate")`
 * is the actual Text node that painted, not a parallel bookkeeping value.
 *
 * Two review-hardened properties:
 *  - The plate carries the CHARACTER's name. On the default table the
 *    character and its owner share the string "Player 1", which cannot
 *    discriminate the two sources — so the spec renames the CHARACTER through
 *    the app's own message and asserts the distinctive name, which the
 *    owner-name fallback could never produce.
 *  - Zoom-invariance is only proven if the zoom actually lands: the spec
 *    drives the REAL camera setter exposed on the e2e bridge (mutating the cam
 *    object in place never re-renders) and polls the plate's parent world
 *    scale until the zoom demonstrably applied before asserting the floor.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

const CHARACTER_NAME = "Sir Testalot";

interface PlateReading {
  text: string;
  screenFontPx: number;
  /** Absolute scale of the plate's parent chain = the camera's world scale. */
  worldScale: number;
}

async function readPlates(page: import("@playwright/test").Page): Promise<PlateReading[]> {
  return page.evaluate(() => {
    const konva = (window as unknown as { Konva?: { stages: unknown[] } }).Konva;
    const stage = konva?.stages?.[0] as
      | {
          find: (selector: string) => {
            text(): string;
            fontSize(): number;
            getAbsoluteScale(): { x: number; y: number };
            getParent(): {
              getParent(): { getAbsoluteScale(): { x: number; y: number } };
            };
          }[];
        }
      | undefined;
    if (!stage) return [];
    return stage.find(".token-nameplate").map((node) => ({
      text: node.text(),
      screenFontPx: node.fontSize() * node.getAbsoluteScale().y,
      // Text → plate group (counter-scaled, absolute scale always ~1) →
      // per-token group, whose absolute scale IS the camera's world scale.
      worldScale: node.getParent().getParent().getAbsoluteScale().y,
    }));
  });
}

test.describe("mobile nameplates", () => {
  test("the plate wears the CHARACTER's name, legibly, at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);

    // Rename the CHARACTER (not the player) through the app's own message —
    // the one string the owner-name fallback cannot produce.
    await page.evaluate((name) => {
      const bridge = window.__HERO_BYTE_E2E__;
      const characterId = bridge?.snapshot?.characters?.[0]?.id;
      bridge?.sendMessage?.({ t: "update-character-name", characterId, name });
    }, CHARACTER_NAME);

    await expect
      .poll(async () => (await readPlates(page)).map((p) => p.text), { timeout: 10_000 })
      .toContain(CHARACTER_NAME);

    const plates = await readPlates(page);
    const plate = plates.find((p) => p.text === CHARACTER_NAME)!;
    expect(plate.screenFontPx).toBeGreaterThanOrEqual(11);
    // And it is NOT the player's name — the fallback string is gone.
    expect(plates.some((p) => p.text.startsWith("Player "))).toBe(false);
  });

  test("zooming out cannot shrink the name below the floor", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await expect
      .poll(async () => (await readPlates(page)).length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    // Drive the REAL camera setter (React state) — and prove the zoom landed
    // by polling the world scale before asserting anything about fonts.
    await page.evaluate(() => {
      window.__HERO_BYTE_E2E__?.setCam?.({ x: 0, y: 0, scale: 0.25 });
    });
    await expect
      .poll(async () => (await readPlates(page))[0]?.worldScale, { timeout: 10_000 })
      .toBeLessThan(0.3);

    const plates = await readPlates(page);
    expect(plates.length).toBeGreaterThan(0);
    for (const plate of plates) {
      expect(plate.screenFontPx).toBeGreaterThanOrEqual(11);
    }
  });
});
