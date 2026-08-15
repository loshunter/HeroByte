/**
 * A TABLET ROTATING ACROSS THE LAYOUT RULE.
 *
 * `mobileLayout.ts` puts the boundary at `(pointer: coarse) and (max-width:
 * 1024px)`, so an 11" tablet is DESKTOP in landscape (1194 wide) and MOBILE in
 * portrait (834 wide). Rotating one therefore swaps the whole authoring
 * palette mid-edit — the desktop lazy-chunk toolbar for the mobile sheet — and
 * M5's review listed that as unexamined, on the suspicion that the DM's dial
 * state went with it.
 *
 * It does not, and this pins why: every dial (activeSubTool, hallwayWidth,
 * splineKind, floorFamily) lives in `useMapEditState`, which App mounts
 * unconditionally, so it is layout-independent in fact and not merely in
 * intention. `mobile-map-edit-resize.spec.ts` asserts that for the MODE.
 * Nothing asserted it for the values the DM actually set.
 *
 * Two things about this file are deliberate:
 *
 * NO `?mobile` PIN, for the same reason the resize spec omits it — this is
 * about the media-query path `App.tsx` listens on, and pinning the layout
 * would defeat the test outright.
 *
 * IT ASSERTS ON THE MOBILE SIDE. The desktop swatches express selection with
 * `variant="primary"` — a style, not an accessible state — while the mobile
 * ones carry `aria-pressed`. So the desktop is where state gets SET and the
 * phone is where it gets READ, and the round trip ends portrait for that
 * reason rather than by accident.
 *
 * 834 is also the first coverage the `(pointer: coarse)` clause has ever had:
 * every other crossing in the suite lands under 700, where `max-width` alone
 * decides and the coarse half is never consulted.
 */
import { expect, test, type Page } from "../fixtures";
import { elevateToDM } from "../helpers";

const ROOM_PASSWORD = process.env.E2E_ROOM_PASSWORD ?? "Fun1";

/** iPad Pro 11", both ways up. */
const LANDSCAPE = { width: 1194, height: 834 };
const PORTRAIT = { width: 834, height: 1194 };

const mobilePalette = (page: Page) => page.getByRole("navigation", { name: /Map edit actions/i });

async function joinUnpinned(page: Page): Promise<void> {
  await page.setViewportSize(LANDSCAPE);
  await page.goto("/");

  const passwordInput = page.getByPlaceholder("Table password");
  await expect(passwordInput).toBeEnabled({ timeout: 15_000 });
  await passwordInput.fill(ROOM_PASSWORD);
  await page.getByRole("button", { name: /Enter Table/i }).click();

  await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForFunction(() => {
    const data = window.__HERO_BYTE_E2E__;
    return Boolean(data?.snapshot && data.uid && data.cam);
  });
}

/** The mobile sheet's tool tiles and dials, which is where we read state. */
async function openMobileToolSheet(page: Page) {
  await mobilePalette(page).getByRole("button", { name: /Tool/ }).click();
  const grid = page.locator(".mobile-tool-sheet__grid").first();
  await expect(grid).toBeVisible({ timeout: 15_000 });
}

async function expectHallAtWidthThree(page: Page) {
  await openMobileToolSheet(page);

  // The armed tool.
  await expect(page.getByRole("button", { name: /^Hall$/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // And the dial's VALUE, which is the half nothing tested before.
  const widthRow = page.locator(".mobile-tool-sheet__section", { hasText: "Width (cells)" });
  await expect(widthRow.getByRole("button", { name: "3", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

test.describe("a tablet rotating across the layout rule", () => {
  test("keeps the armed tool and its dial through a full rotation round trip", async ({ page }) => {
    test.setTimeout(150_000);
    await joinUnpinned(page);
    await elevateToDM(page);

    // ---- LANDSCAPE is the DESKTOP layout: 1194 clears the 1024 clause ----
    await expect(mobilePalette(page)).toHaveCount(0);
    await page.getByTitle("Author the live map on the table").click();
    await page.getByRole("button", { name: /START LIVE MAP/i }).click();
    await page.waitForFunction(
      () => Boolean(window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId),
      undefined,
      { timeout: 30_000 },
    );

    // Arm Hall and set a width the DM would notice losing. The desktop grid is
    // a label followed by its buttons, so scope through the label's parent.
    await page.getByRole("button", { name: /🚇 Hall/ }).click();
    const widthGrid = page.getByText("Width (cells):", { exact: true }).locator("xpath=..");
    await widthGrid.getByRole("button", { name: "3", exact: true }).click();

    // ---- rotate to PORTRAIT: 834 crosses into the mobile layout ----
    await page.setViewportSize(PORTRAIT);
    await expect(mobilePalette(page)).toBeVisible({ timeout: 15_000 });
    await expectHallAtWidthThree(page);

    // ---- rotate back to LANDSCAPE: the desktop toolbar returns, still live ----
    await page.setViewportSize(LANDSCAPE);
    await expect(mobilePalette(page)).toHaveCount(0);
    await expect(page.getByText("● LIVE")).toBeVisible({ timeout: 15_000 });

    // ---- and back to PORTRAIT, which is the actual claim ----
    // Surviving one crossing could be a palette that had not re-mounted yet.
    // Surviving the round trip means the state never lived in either palette.
    await page.setViewportSize(PORTRAIT);
    await expect(mobilePalette(page)).toBeVisible({ timeout: 15_000 });
    await expectHallAtWidthThree(page);
  });
});
