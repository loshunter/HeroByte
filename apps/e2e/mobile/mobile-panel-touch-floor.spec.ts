/**
 * The 44px floor inside the PANELS, not just the mobile shell.
 *
 * The shell's own controls — the dock, the tool sheet, the chips — have had the
 * floor since M3, and `mobile-shell.spec.ts` measures it. What that never
 * covered is everything the shell HOSTS: chat, the roll log, the dice roller
 * and the entity cards are the desktop components, and every button in them is
 * a JRPGButton at `font-size: 10px; padding: 6px 12px` — about 25px tall.
 *
 * Chat's SEND is the one that got reported, and the handoff was right that
 * fixing SEND alone would have been the wrong shape: it is not special, it is
 * just the button a player presses most. So this asserts the FLOOR over every
 * visible control in the panel, and names anything under it.
 *
 * The rule is scoped to `(pointer: coarse)`, which is why this lives in the
 * mobile project — a desktop run would measure the deliberate dense styling and
 * fail for the wrong reason.
 */
import { expect, test, type Page } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

const PHONE = { width: 390, height: 844 };

/** Every visible interactive control in a surface, with what it measures. */
async function undersizedControls(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((root) => {
    const scope = document.querySelector<HTMLElement>(root);
    if (!scope) return [`missing surface: ${root}`];
    return [...scope.querySelectorAll<HTMLElement>("button, input, select, textarea")]
      .filter((control) => {
        const rect = control.getBoundingClientRect();
        // A zero box is scrolled out of a scroller or genuinely hidden; a range
        // and the checkbox family are excluded because they are dragged and
        // tapped rather than pressed, and their own rules cover them.
        if (rect.height === 0 || rect.width === 0) return false;
        const type = (control as HTMLInputElement).type;
        if (type === "range" || type === "checkbox" || type === "radio") return false;
        return rect.height < 44 || rect.width < 44;
      })
      .map((control) => {
        const rect = control.getBoundingClientRect();
        const label = (control.getAttribute("aria-label") ?? control.textContent ?? "?")
          .trim()
          .slice(0, 20);
        return `${control.tagName}:${label} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      });
  }, selector);
}

test.describe("the panels a phone hosts clear the touch floor", () => {
  test("chat's SEND and its message box are both pressable", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await joinMobileTable(page);

    // Chat is a TAB inside the roll-log screen on a phone, not a dock slot.
    await page.getByRole("button", { name: /^Log$/ }).click();
    await page.getByRole("button", { name: "CHAT" }).click();
    const send = page.getByRole("button", { name: "SEND" });
    await expect(send).toBeVisible();

    // Named directly as well as swept, because SEND is the reported case and a
    // sweep that silently stopped finding it would still pass.
    //
    // What this pair pins is the RENDERED outcome, not either CSS rule on its
    // own: SEND and the box share a flex row at the default align-items:
    // stretch, so whichever of them has a floor lifts the other. Measured —
    // removing either rule alone leaves this green, removing both reports
    // "SEND is 25px tall". The sweep below is what pins the button rule
    // specifically, through the tab strip, which has no tall sibling.
    const box = (await send.boundingBox())!;
    expect(box.height, `SEND is ${Math.round(box.height)}px tall`).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);

    const input = page.getByPlaceholder(/Say something/i);
    const inputBox = (await input.boundingBox())!;
    expect(
      inputBox.height,
      `the message box is ${Math.round(inputBox.height)}px tall`,
    ).toBeGreaterThanOrEqual(44);
  });

  test("no control in the chat or roll-log surface is under the floor", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await joinMobileTable(page);

    await page.getByRole("button", { name: /^Log$/ }).click();
    // The ROLLS tab first: the tab strip, CLEAR, and every roll row's controls.
    const rolls = await undersizedControls(page, "[data-mobile-surface]");
    expect(rolls, `roll-log controls under 44px: ${rolls.join(", ")}`).toEqual([]);

    await page.getByRole("button", { name: "CHAT" }).click();
    const chat = await undersizedControls(page, "[data-mobile-surface]");
    expect(chat, `chat controls under 44px: ${chat.join(", ")}`).toEqual([]);
  });
});
