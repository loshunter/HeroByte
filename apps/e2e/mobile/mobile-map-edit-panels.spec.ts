/**
 * The tallest sheet this shell has ever had, measured at both orientations.
 *
 * This exists because the sibling "palette fits a 375x812 phone" test does not
 * cover what its name suggests: it never binds a live document, so it measures
 * the dock and the PRE-BIND sheet (one button) and would pass no matter how
 * badly the real tool grid fitted. M5 tripled that grid and added dials and a
 * Populate footer under it, so the claim needed a test that opens the thing.
 *
 * The content here is the genuine maximum a DM can produce: Room armed, so the
 * wall-ring row and the shelved floor picker are both showing, AND a region
 * placed, so Populate's category and density rows are showing too. This is the
 * case mobile-shell.spec.ts had to inject 900px of filler to stand in for —
 * its own comment says so.
 *
 * What is asserted is the contract M3 established and S8 paid for: the sheet
 * stays inside the viewport, scrolls rather than overflowing, and its sticky
 * header keeps the ✕ reachable AFTER scrolling to the bottom. S8 shipped a
 * sheet whose close button sat at −57px in landscape; that is the bug this
 * measures, in the orientation that produced it.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchDrag } from "./touch.helpers";

interface Fit {
  viewport: { w: number; h: number };
  sheet: { top: number; bottom: number };
  closeAfterScroll: { top: number; bottom: number };
  scrolls: boolean;
  tooSmall: string[];
  clipped: string[];
  bodyScrollsSideways: boolean;
}

/** Scroll the sheet to its end, then measure everything that matters. */
function measure(page: Page): Promise<Fit> {
  return page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>(".mobile-tool-sheet")!;
    sheet.scrollTop = sheet.scrollHeight;
    const s = sheet.getBoundingClientRect();
    const close = sheet
      .querySelector<HTMLElement>(".mobile-tool-sheet__close")!
      .getBoundingClientRect();
    const buttons = [...sheet.querySelectorAll<HTMLElement>("button")];
    const label = (b: HTMLElement) => (b.textContent ?? "").trim().slice(0, 20);
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      sheet: { top: Math.round(s.top), bottom: Math.round(s.bottom) },
      closeAfterScroll: { top: Math.round(close.top), bottom: Math.round(close.bottom) },
      scrolls: sheet.scrollHeight > sheet.clientHeight + 1,
      // The 44px touch floor is INHERITED from .mobile-tool-sheet__button and
      // .mobile-chip; nothing in the panels restates it, so this is what
      // catches a stylesheet edit that drops it.
      tooSmall: buttons
        .filter(
          (b) => b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44,
        )
        .map(label),
      clipped: buttons.filter((b) => b.scrollWidth > b.clientWidth + 1).map(label),
      bodyScrollsSideways: document.body.scrollWidth > window.innerWidth + 1,
    };
  });
}

/**
 * How much MAP the sheet leaves, which is a different question from whether the
 * sheet fits. The measurements below all ask "is the sheet inside the
 * viewport"; a sheet can satisfy every one of them and still cover the half of
 * the map the DM needs to tap.
 *
 * It matters most in Select, the one mode where you must tap the map WITH the
 * sheet open — the readout and DELETE live in it. M7 is what made the question
 * real: three new tiles took the grid from eleven buttons to fourteen, which at
 * four columns is a fourth row, and on an 820x1180 tablet the sheet top moved
 * from 588px to 533px. A sibling spec that tapped "empty canvas" at 566px
 * started hitting the sheet, and the failure read as a selection bug.
 *
 * A fifth column at >=700px put it back. This is what stops the next tool
 * quietly taking it again — and it is a floor on the MAP, not a ceiling on the
 * sheet, because the sheet is allowed to grow as long as the map does not
 * shrink past what a hand can aim at.
 */
const MIN_TABLET_MAP_HEIGHT = 560;

test.describe("the map-edit sheet's footprint on the map", () => {
  test("leaves a tablet DM enough map to aim at with the sheet open", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 820, height: 1180 });
    await joinMobileTable(page);
    await elevateToDM(page);

    await page.getByRole("button", { name: /^DM$/i }).click();
    await page.getByRole("button", { name: /Edit the live map/i }).click();
    const dock = page.getByRole("navigation", { name: /Map edit actions/i });
    await dock.getByRole("button", { name: /Tool/ }).click();
    await page.getByRole("button", { name: /Start live map/i }).click();
    await page.waitForFunction(
      () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
      undefined,
      { timeout: 30_000 },
    );

    // Select is the mode this is about, and it also carries a panel — so this
    // measures the grid AND a panel under it, the shape a DM actually aims
    // through.
    await page
      .locator(".mobile-tool-sheet__grid")
      .first()
      .getByRole("button", { name: /^Select$/ })
      .click();
    await expect(page.getByTestId("mobile-select-status")).toBeVisible();

    const sheet = (await page.locator(".mobile-tool-sheet").boundingBox())!;
    const canvas = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const mapAbove = sheet.y - canvas.y;

    expect(
      mapAbove,
      `the sheet leaves only ${Math.round(mapAbove)}px of map above it`,
    ).toBeGreaterThanOrEqual(MIN_TABLET_MAP_HEIGHT);
  });
});

test.describe("the map-edit sheet at its tallest", () => {
  test("fits, scrolls and keeps its close reachable in both orientations", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await joinMobileTable(page);
    await elevateToDM(page);

    await page.getByRole("button", { name: /^DM$/i }).click();
    await page.getByRole("button", { name: /Edit the live map/i }).click();
    const dock = page.getByRole("navigation", { name: /Map edit actions/i });
    await dock.getByRole("button", { name: /Tool/ }).click();
    await page.getByRole("button", { name: /Start live map/i }).click();
    await page.waitForFunction(
      () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
      undefined,
      { timeout: 30_000 },
    );

    // Draw a room, so Populate's dials are part of the tallest content rather
    // than a footer sentence. A tap would do — a region tool commits a minimum
    // unit — but a real drag is what a DM does.
    const toolGrid = page.locator(".mobile-tool-sheet__grid");
    await toolGrid.getByRole("button", { name: /^Room$/ }).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    await touchDrag(cdp, { x: box.x + box.width * 0.25, y: box.y + box.height * 0.3 }, [
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.6 },
    ]);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.walls?.length ?? 0,
          ),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);
    await page.waitForTimeout(800);

    // Reopen with Room still armed: grid + wall ring + floor shelves + floor
    // swatches + Populate armed with its two dial rows.
    await dock.getByRole("button", { name: /Tool/ }).click();
    await expect(page.getByTestId("mobile-populate-status")).toHaveText(/just drew/i);
    // Scoped to the HEADING, not the page: one of the bundled families is
    // called "Cavern Floor", so a bare getByText("Floor") resolves to two
    // elements and fails as a strict-mode violation rather than a fit failure.
    await expect(
      page.locator(".mobile-tool-sheet__label").filter({ hasText: /^Floor$/ }),
    ).toBeVisible();

    // Both dial-heavy panels, not just Room. Arming only Room left the Generate
    // panel's seed row out of the measured DOM entirely, and that row holds the
    // one control in the sheet that is NOT sized by the grid — a content-sized
    // ⟳ that measured 31px wide while this spec reported the floor clean.
    for (const tool of [/^Room$/, /^Gen$/]) {
      await toolGrid.getByRole("button", { name: tool }).click();

      for (const size of [
        { width: 375, height: 812 },
        { width: 812, height: 375 },
      ]) {
        await page.setViewportSize(size);
        // Give the layout a frame to settle before measuring.
        await page.waitForTimeout(300);

        const fit = await measure(page);
        const where = `${tool.source} @ ${size.width}x${size.height}`;

        expect(fit.sheet.top, `${where}: sheet starts above the viewport`).toBeGreaterThanOrEqual(
          0,
        );
        expect(fit.sheet.bottom, `${where}: sheet runs past the viewport`).toBeLessThanOrEqual(
          fit.viewport.h,
        );
        // After scrolling to the very bottom — this is the S8 bug, exactly.
        expect(
          fit.closeAfterScroll.top,
          `${where}: close scrolled off the top`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          fit.closeAfterScroll.bottom,
          `${where}: close scrolled off the bottom`,
        ).toBeLessThanOrEqual(fit.viewport.h);
        expect(fit.tooSmall, `${where}: controls under the 44px touch floor`).toEqual([]);
        expect(fit.clipped, `${where}: clipped labels`).toEqual([]);
        expect(fit.bodyScrollsSideways, `${where}: the page scrolls sideways`).toBe(false);
      }
    }
  });
});
