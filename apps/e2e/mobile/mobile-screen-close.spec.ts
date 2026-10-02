// U10b — the phone screens' ✕ is the contract for leaving a screen. herobyte.css
// asks for an 18 px glyph and no padding on `.mobile-screen__close`, but `jrpg.css`
// loads later and `.jrpg-button` (10 px, 6px 12px) won at equal specificity: the ✕
// shipped as a tiny glyph in a padded box. The rule is measured, as computed style
// (what the browser resolved) and as the box a thumb has to hit.

import { expect, test } from "../fixtures";
import { openTableScreen } from "../table-role.helpers";
import { joinMobileTable } from "./mobile.helpers";

test.describe("U10b — the phone screens' ✕", () => {
  test("is an 18 px glyph with no padding, in a box at the 44 px floor", async ({ page }) => {
    await joinMobileTable(page);
    await openTableScreen(page);

    const close = page.getByRole("button", { name: "Close Table", exact: true });
    await expect(close).toBeVisible();

    const style = await close.evaluate((node) => {
      const computed = getComputedStyle(node);
      return {
        fontSize: computed.fontSize,
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
      };
    });
    expect(style.fontSize).toBe("18px");
    expect([style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]).toEqual([
      "0px",
      "0px",
      "0px",
      "0px",
    ]);

    const box = await close.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
