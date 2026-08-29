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
import { elevateToDM } from "../helpers";
import { joinMobileTable } from "./mobile.helpers";
import { openTouch, touchTap } from "./touch.helpers";

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

  test("no control in any DM-menu tab is under the floor", async ({ page }) => {
    // The vision-default slice left this as an explicit follow-up: "DM-menu
    // controls on mobile are sub-44px exactly like every neighbour on that
    // tab, which is the panel-wide pass the handoff already identified for the
    // chat SEND button." Same pass, so this is where that closes — and
    // mobile-dm.spec.ts's fit test can stop calling the floor a non-goal.
    test.setTimeout(120_000);
    await page.setViewportSize(PHONE);
    await joinMobileTable(page);
    await elevateToDM(page);
    await page.getByRole("button", { name: /^DM$/i }).click();

    const dialog = page.getByRole("dialog", { name: "DM Menu" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    for (const tab of ["Map Setup", "NPCs & Monsters", "Props & Objects", "Players", "Session"]) {
      await dialog.getByRole("button", { name: tab, exact: true }).click();
      const small = await undersizedControls(page, "[data-mobile-surface='dm']");
      expect(small, `${tab}: controls under 44px — ${small.join(", ")}`).toEqual([]);
    }
  });

  test("the player settings window joins the touch floor", async ({ page }) => {
    // PlayerSettingsMenu portals to document.body, OUTSIDE every mobile
    // surface — so the phone Party screen's only rename and portrait fields
    // sat at their desktop ~23-28px, and this file's own sweep (scoped to the
    // same attribute) could never see them. The portal now carries its own
    // surface, which both the floor and this sweep resolve.
    await page.setViewportSize(PHONE);
    await joinMobileTable(page);

    await page.getByRole("button", { name: /^Party$/ }).click();
    await page.getByRole("button", { name: "⚙️ EDIT" }).first().click();

    const small = await undersizedControls(page, "[data-mobile-surface='settings']");
    expect(small, `settings controls under 44px: ${small.join(", ")}`).toEqual([]);
  });

  test("the dice chip's ✕ stays a corner badge, and the chip still opens its editor", async ({
    page,
  }) => {
    // The floor's min-height stretched this 20px badge to 44px — and `top` is
    // its anchor, so the growth went DOWNWARD, covering the right half of the
    // 48px chip it sits on. A tap meant to open the quantity editor deleted
    // the die instead. The fix keeps the 20px box and moves the 44px touch
    // target into a ::after — hit area, not box, the checkbox carve-out's own
    // philosophy — which is why this measures the box SMALL on purpose.
    await page.setViewportSize(PHONE);
    await joinMobileTable(page);

    await page.getByRole("button", { name: /^Dice$/ }).click();
    await page.getByRole("button", { name: "Add d20" }).click();

    const chip = page.locator(".dice-token").first();
    await expect(chip).toBeVisible();
    const badge = (await page.locator("button.dice-token__remove").first().boundingBox())!;
    expect(badge.height, `the ✕ box is ${Math.round(badge.height)}px tall`).toBeLessThanOrEqual(24);

    // The functional half: a tap on the chip's lower-right — inside the zone
    // the stretched badge used to cover (it reached nearly the chip's full
    // height), but clear of the fixed badge's 44px hit-slop, which stops
    // ~29px down. Opens the editor, not the trash.
    const chipBox = (await chip.boundingBox())!;
    const cdp = await openTouch(page);
    await touchTap(cdp, {
      x: chipBox.x + chipBox.width - 12,
      y: chipBox.y + chipBox.height - 14,
    });
    await expect(chip.locator("input")).toBeVisible();
    await expect(page.locator(".dice-token")).toHaveCount(1);
  });
});
