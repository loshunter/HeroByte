/**
 * The ARGUMENTS a click tool takes, on a phone.
 *
 * Separate from `mobile-map-edit-place.spec.ts`, which is about the GESTURE
 * (press aims, release drops). These three controls are the ones a desktop
 * reaches by keyboard — Alt for a free stamp, R to turn it, Ctrl to sample —
 * so on touch they were not "hard to reach", they were unreachable.
 *
 * Every assertion is on the ELEMENT the server received, never on a button's
 * pressed state: a control wired to nothing looks identical to one wired to
 * something until a drop lands.
 */
import { expect, test } from "../fixtures";
import { armLiveMapEdit, firstElementScreenPos, placedElements } from "./mobile.helpers";
import { openTouch, touchTap } from "./touch.helpers";

type Page = Parameters<typeof placedElements>[0];

const elements = async (page: Page) => (await placedElements(page)).length;

/** A tool's commit is SKIPPED while a command is in flight and is not retried,
 * so a gesture started too soon after the last one is dropped in silence. */
const settle = (page: Page) => page.waitForTimeout(800);

test.describe("M7 — the dials a phone has no key for", () => {
  test("the drop-mode and rotation controls change what actually lands", async ({ page }) => {
    // Alt and R do this on a desktop and a phone has neither, so these two
    // controls are the only way a touch DM reaches either. A control wired to
    // nothing looks identical to one wired to something until a drop lands, so
    // the assertion is on the ELEMENT, not on the button's pressed state.
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    await toolGrid.getByRole("button", { name: /^Place$/ }).click();
    const dropRow = page.locator(".mobile-tool-sheet__section", { hasText: "Drop as" });
    await expect(dropRow).toBeVisible();

    // Default is a grid TILE — the positive control for the toggle below.
    await page.getByRole("button", { name: /To the map/i }).click();
    await touchTap(cdp, at(0.35, 0.3));
    await expect.poll(() => placedElements(page), { timeout: 30_000 }).toHaveLength(1);
    expect((await placedElements(page))[0]!.type).toBe("tile");

    // Free stamp, turned twice clockwise: 30°.
    await settle(page);
    await dock.getByRole("button", { name: /Tool/ }).click();
    await dropRow.getByRole("button", { name: /Free stamp/ }).click();
    // The rotate row only exists once stamping — a rotation dial over a tile
    // would be a control that cannot do anything.
    const rotate = page.getByRole("button", { name: /Rotate stamp clockwise/i });
    await expect(rotate).toBeVisible();
    await rotate.click();
    await rotate.click();
    await expect(page.locator(".mobile-tool-sheet__label", { hasText: "Rotation" })).toHaveText(
      /30°/,
    );
    await page.getByRole("button", { name: /To the map/i }).click();

    await touchTap(cdp, at(0.65, 0.6));
    await expect.poll(() => placedElements(page), { timeout: 30_000 }).toHaveLength(2);
    const stamp = (await placedElements(page)).find((element) => element.type === "stamp");
    expect(stamp, "the second drop should be a free stamp, not another tile").toBeDefined();
    expect(stamp!.rotation).toBe(30);
  });

  test("Sample picks up what is under the finger and re-arms Place with it", async ({ page }) => {
    // The eyedropper was Ctrl+click, which a phone cannot press — so on touch
    // it was not "hard to reach", it was unreachable. As a sub-tool it is one
    // tap, and it hands over to Place, so the DM is armed with what they just
    // pointed at rather than having to find it in the picker.
    test.setTimeout(150_000);
    const { dock, toolGrid } = await armLiveMapEdit(page);

    const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
    const cdp = await openTouch(page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });

    // Put something on the map that is NOT the default crate, so "the sample
    // worked" cannot be satisfied by the tool simply having stayed as it was.
    await toolGrid.getByRole("button", { name: /^Place$/ }).click();
    const picker = page.locator(".mobile-tool-sheet__section", { hasText: "Place" }).first();
    const swatches = picker.locator(".mobile-tool-sheet__grid").getByRole("button");
    const otherName = (await swatches.nth(1).textContent())!.trim();
    await swatches.nth(1).click();
    await page.getByRole("button", { name: /To the map/i }).click();
    await touchTap(cdp, at(0.45, 0.35));
    await expect.poll(() => elements(page), { timeout: 30_000 }).toBe(1);

    // Arm the default crate again, so the sample has something to change.
    await settle(page);
    await dock.getByRole("button", { name: /Tool/ }).click();
    await swatches.first().click();
    const defaultName = (await swatches.first().textContent())!.trim();
    expect(defaultName).not.toBe(otherName);

    // Sample takes no argument, so it closes the sheet — and hands over after
    // one tap, which is why it is a moment rather than a mode.
    await toolGrid.getByRole("button", { name: /^Sample$/ }).click();
    await expect(page.locator(".mobile-tool-sheet")).toBeHidden();
    const target = (await firstElementScreenPos(page))!;
    expect(target, "nothing was placed to sample").not.toBeNull();
    await touchTap(cdp, target);

    await dock.getByRole("button", { name: /Tool/ }).click();
    // Handed over to Place...
    await expect(toolGrid.getByRole("button", { name: /^Place$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // ...armed with what was under the finger, not what was armed before.
    await expect(
      picker.locator(".mobile-tool-sheet__grid").getByRole("button", { name: otherName }),
    ).toHaveAttribute("aria-pressed", "true");

    // And a sample places NOTHING. A miss that fell through to the place tool
    // would drop a crate where the DM was pointing at empty floor.
    expect(await elements(page)).toBe(1);
  });
});
