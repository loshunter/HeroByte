/**
 * Mobile: the dice roller keeps ROLL in reach and holds still while you choose who sees a roll
 * (U10b).
 *
 * The roller is one tall column inside a scrolling box. On a short window (375x450 portrait,
 * 812x375 landscape) ROLL was below the fold until you scrolled, and U10a's audience line
 * (one line for TABLE, two for DM and ME) moved everything under it as you chose. ROLL and
 * CLEAR are now pinned to the bottom of the box, and the audience line is a fixed two-line
 * slot. Measured as bounding boxes.
 */
import { expect, test } from "../fixtures";
import { joinMobileTable } from "./mobile.helpers";

const VIEWPORTS = [
  { width: 375, height: 450 },
  { width: 812, height: 375 },
  { width: 320, height: 568 },
];

for (const viewport of VIEWPORTS) {
  test(`ROLL is on screen without scrolling, and choosing an audience moves nothing (${viewport.width}x${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await joinMobileTable(page);
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: "Dice", exact: true })
      .tap();
    const roller = page.getByTestId("dice-roller");
    await expect(roller).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const rollButton = roller.getByRole("button", { name: "Roll dice", exact: true });
    await expect(rollButton).toBeInViewport({ ratio: 1 });
    const clear = roller.getByRole("button", { name: "CLEAR", exact: true });
    await expect(clear).toBeInViewport({ ratio: 1 });

    const boxes = () =>
      roller.locator("button,input").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            name: (el.getAttribute("aria-label") || el.textContent || "").trim(),
            x: Math.round(r.x),
            y: Math.round(r.y),
          };
        }),
      );
    const audienceLine = roller.getByTestId("roll-audience");
    const group = roller.getByRole("group", { name: "Who sees this roll" });
    await group.getByRole("button", { name: "TABLE", exact: true }).tap();
    await expect(audienceLine).toHaveText(/^Everyone at the table sees this roll/);
    const baseline = await boxes();
    const lineHeight = (await audienceLine.boundingBox())!.height;

    for (const [name, text] of [
      ["DM", /^Only you and whoever is in DM mode/],
      ["ME", /^Only you see this roll/],
      ["TABLE", /^Everyone at the table/],
    ] as const) {
      await group.getByRole("button", { name, exact: true }).tap();
      await expect(audienceLine).toHaveText(text);
      expect((await audienceLine.boundingBox())!.height, `${name} line height`).toBeCloseTo(
        lineHeight,
        0,
      );
      const now = await boxes();
      expect(now.map((b) => b.name)).toEqual(baseline.map((b) => b.name));
      const moved = baseline
        .filter((b, i) => b.x !== now[i].x || b.y !== now[i].y)
        .map((b) => b.name);
      expect(moved, `controls moved when ${name} was chosen`).toEqual([]);
      await expect(rollButton).toBeInViewport({ ratio: 1 });
    }
  });
}

// The pinned block must not cover what keyboard focus scrolls to: focus the control just above
// CLEAR/ROLL (the last of the macro bar) and it stays clear of the pinned row.
for (const viewport of VIEWPORTS) {
  for (const refused of [false, true]) {
    test(`the control focus scrolls to at the bottom is not under the pinned block${refused ? ", refusal showing" : ""} (${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await joinMobileTable(page);
      await page
        .getByRole("navigation", { name: /Mobile actions/i })
        .getByRole("button", { name: "Dice", exact: true })
        .tap();
      const roller = page.getByTestId("dice-roller");
      await expect(roller).toBeVisible();
      if (refused) {
        // The pinned block is taller with a refusal in it: the padding must cover that too.
        const plusOne = roller.getByRole("button", { name: "Add +1 modifier", exact: true });
        for (let i = 0; i < 17; i += 1) await plusOne.tap();
        await roller.getByRole("button", { name: "Roll dice", exact: true }).tap();
        await expect(roller.getByTestId("dice-error")).toBeVisible();
      }
      const lastAbove = await roller.evaluateHandle((root) => {
        const buttons = [...root.querySelectorAll("button")];
        const clear = buttons.findIndex((b) => b.textContent?.trim() === "CLEAR");
        return buttons[clear - 1];
      });
      await lastAbove.evaluate((el) => (el as HTMLElement).focus());
      // The pinned block is CLEAR's row's parent (it carries the 8px of opaque padding above CLEAR).
      const [above, pinned] = await Promise.all([
        lastAbove.asElement()!.boundingBox(),
        roller
          .getByRole("button", { name: "CLEAR", exact: true })
          .locator("xpath=../..")
          .boundingBox(),
      ]);
      expect(above).not.toBeNull();
      expect(pinned).not.toBeNull();
      // The scroll box must reserve at least the pinned block's own height (a refusal makes it
      // taller), or focus can scroll a control to just under the block's top edge.
      const reserved = await roller
        .getByRole("button", { name: "CLEAR", exact: true })
        .evaluate((el) => {
          const block = el.parentElement!.parentElement!;
          return parseFloat(getComputedStyle(block.parentElement!).scrollPaddingBottom);
        });
      expect(
        reserved,
        "scroll-padding-bottom is smaller than the pinned block",
      ).toBeGreaterThanOrEqual(pinned!.height);
      expect(
        above!.y + above!.height,
        "the focused control is under the pinned block",
      ).toBeLessThanOrEqual(pinned!.y + 1);
    });
  }
}

// Why a roll was refused is on screen where the person is looking: seventeen +1 chips
// cross the server's term limit, the client refuses before sending and says so in an alert.
// The alert used to sit just above ROLL's natural spot; with ROLL pinned it would have been
// hidden behind the pinned row on a short window (review of U10b, round 1).
for (const viewport of VIEWPORTS) {
  test(`a refused roll's message is visible and clear of the pinned row (${viewport.width}x${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await joinMobileTable(page);
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: "Dice", exact: true })
      .tap();
    const roller = page.getByTestId("dice-roller");
    await expect(roller).toBeVisible();
    const plusOne = roller.getByRole("button", { name: "Add +1 modifier", exact: true });
    for (let i = 0; i < 17; i += 1) await plusOne.tap();
    await roller.getByRole("button", { name: "Roll dice", exact: true }).tap();

    const refusal = roller.getByTestId("dice-error");
    await expect(refusal).toBeVisible();
    await expect(refusal).toBeInViewport({ ratio: 1 });
    const [alert, roll] = await Promise.all([
      refusal.boundingBox(),
      roller.getByRole("button", { name: "Roll dice", exact: true }).boundingBox(),
    ]);
    expect(alert).not.toBeNull();
    expect(roll).not.toBeNull();
    // Above the pinned row, not under it.
    expect(alert!.y + alert!.height, "the refusal is under the pinned row").toBeLessThanOrEqual(
      roll!.y + 1,
    );
  });
}
