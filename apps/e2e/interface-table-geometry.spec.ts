// U9 — where the connection is said on a desktop, MEASURED. The fixed ONLINE badge sat
// over whatever was at the top centre; it now lives in the header's own Table button, and
// the menu behind it opens BELOW the header so it can never cover the controls beside it.
// A claim about pixels is asserted with boundingBox, and each has a browser mutant that
// moves the thing back (see the U9 record).

import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";
import { createTable, openTableMenu, tableButton } from "./table-role.helpers";

type Box = { x: number; y: number; width: number; height: number };

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  expect(box, "rendered").not.toBeNull();
  return box!;
};

const disjoint = (a: Box, b: Box) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

/** Every visible header control's box, by name. */
const headerControls = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-header-root] button")]
      .filter((el) => el.checkVisibility())
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 30),
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      }),
  );

async function expectClear(page: Page) {
  const controls = await headerControls(page);
  expect(controls.length).toBeGreaterThan(6);
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      expect(
        disjoint(controls[i]!, controls[j]!),
        `${controls[i]!.name} overlaps ${controls[j]!.name}`,
      ).toBe(true);
    }
  }
  const viewport = page.viewportSize()!;
  for (const control of controls) {
    expect(control.x + control.width, `${control.name} ends on screen`).toBeLessThanOrEqual(
      viewport.width,
    );
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}

/** The Play tools sit on ONE row: their tops agree to within a few pixels. */
async function playToolsRows(page: Page) {
  const tops = await page
    .locator('[role="group"][aria-label="Play tools"] button')
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => (button as HTMLElement).checkVisibility())
        .map((button) => Math.round(button.getBoundingClientRect().top)),
    );
  expect(tops.length).toBeGreaterThan(6);
  return new Set(tops.map((top) => Math.round(top / 6))).size;
}

/**
 * WCAG contrast of the role text against the button it sits on, by computed colour. The
 * pointer is moved off the button first: a hovered button has no gold ground (its
 * background computes transparent), which is not the state a person reads the open menu in
 * — the pointer is on the menu — and measured there the gold-on-gold mistake passes.
 */
async function expectLegibleRole(page: Page) {
  await page.mouse.move(700, 420);
  const ratio = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>(".table-menu-button")!;
    const role = button.querySelector<HTMLElement>(".table-menu-button__role")!;
    const channels = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    // The first opaque ground at or above the button (a transparent one shows what is behind).
    const groundOf = (start: Element | null) => {
      for (let node = start; node; node = node.parentElement) {
        const css = getComputedStyle(node).backgroundColor;
        // `split(",")[3]` is " 0.9)" for rgba(..., 0.9): parseFloat reads it, Number() gave NaN
        // and every translucent ground was skipped as if it were transparent.
        const alpha = css.startsWith("rgba") ? parseFloat(css.split(",")[3]!) : 1;
        if (alpha > 0) return css;
      }
      return "rgb(0, 0, 0)";
    };
    const luminance = ([r, g, b]: number[]) => {
      const lin = (v: number) => {
        const c = v! / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
    };
    const text = luminance(channels(getComputedStyle(role).color));
    const ground = luminance(channels(groundOf(button)));
    const [hi, lo] = text > ground ? [text, ground] : [ground, text];
    return (hi + 0.05) / (lo + 0.05);
  });
  expect(ratio, "the role reads against the button").toBeGreaterThanOrEqual(4.5);
}

test.describe("U9 — the connection on a desktop", () => {
  for (const width of [1440, 1024]) {
    test(`is the Table button's, overlaps no header control, and opens a menu below the header (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await joinDefaultRoom(page);

      // With the menu closed the connection is said by the button alone: no badge is
      // fixed over the page, and the public-table warning rides in the header's own row.
      await expect(page.getByTestId("connection-chip")).toHaveCount(0);
      await expect(tableButton(page)).toHaveAttribute(
        "aria-label",
        /, (Player|Dungeon Master), online/,
      );
      await expectClear(page);

      // Open, the menu hangs from the bottom edge of the WHOLE header (the button sits
      // beside two rows of controls), inside the screen, and its own chip clears its title.
      // The button reads in both states: its role is legible on its own ground (open, the
      // button turns gold and the role once stayed gold on it).
      await expectLegibleRole(page);
      const menu = await openTableMenu(page);
      await expectLegibleRole(page);
      const header = await boxOf(page.locator("[data-header-root]"));
      const panel = await boxOf(menu);
      expect(panel.y).toBeGreaterThanOrEqual(header.y + header.height);
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(900);
      const chip = await boxOf(menu.getByTestId("connection-chip"));
      const name = await boxOf(menu.getByRole("heading", { level: 3 }));
      expect(disjoint(chip, name)).toBe(true);
      // And it covers no header control: every one is still where it was, under the same hit test.
      for (const control of await headerControls(page)) {
        const hit = await page.evaluate(
          ([x, y]) =>
            document
              .elementFromPoint(x!, y!)
              ?.closest('[role="dialog"][aria-label="Table menu"]') !== null,
          [control.x + control.width / 2, control.y + control.height / 2],
        );
        expect(hit, `${control.name} is under the menu`).toBe(false);
      }
    });
  }

  test("at 1280px a player's header keeps its Play tools on one row on the public table", async ({
    page,
  }) => {
    // The Table button replaced a narrower UID block; at 340px the logo block pushed
    // RECENTER onto a second row, the header grew a row, and windows opened at a fixed
    // place landed on the row that had moved (the docs harness could not close the Dice
    // roller). The button is sized to leave the row whole.
    await page.setViewportSize({ width: 1280, height: 720 });
    await joinDefaultRoom(page);
    expect(await playToolsRows(page)).toBe(1);
    await expectClear(page);
  });

  test("a floating window opens below the header's controls, so the button that toggles it stays reachable", async ({
    page,
  }) => {
    // Windows open at a fixed place unless a remembered one says otherwise; under a header
    // that had grown a row, that place was ON the Panels row, and the Dice toggle could not
    // be pressed again to close what it had opened (the docs harness hung on it).
    await page.setViewportSize({ width: 1280, height: 720 });
    await joinDefaultRoom(page);
    const dice = page.getByTitle("Open 3D dice roller");
    await dice.click();
    const roller = page
      .locator("div[style*='position: fixed']")
      .filter({ has: page.getByRole("button", { name: /^Close .*Dice Roller$/i }) });
    await expect(roller).toBeVisible();
    const windowBox = await boxOf(roller);
    const controls = await headerControls(page);
    const lowest = Math.max(...controls.map((control) => control.y + control.height));
    expect(
      windowBox.y,
      "the window starts under the header's lowest control",
    ).toBeGreaterThanOrEqual(lowest);
    // The toggle takes its own click, and closes the window again.
    await dice.click();
    await expect(roller).toHaveCount(0);
  });

  test("...and on a private table with the longest name, which the button cuts rather than spills", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await createTable(page, "A very long table name that goes on and on and on, for sixty");
    expect(await playToolsRows(page)).toBe(1);
    await expectClear(page);
  });

  test("a table with the longest name keeps the button inside its width and the header clear", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const name = "A very long table name that goes on and on and on, for sixty".slice(0, 60);
    expect(name).toHaveLength(60);
    await createTable(page, name);
    const button = tableButton(page);
    await expect(button).toHaveAttribute("aria-label", new RegExp(`Table menu: ${name}`));
    expect((await boxOf(button)).width).toBeLessThanOrEqual(200);
    await expectClear(page);
    // The name is cut with an ellipsis, not spilled over the role beside it.
    const clipped = await button.evaluate((el) => {
      const label = el.querySelector<HTMLElement>(".table-menu-button__name")!;
      return label.scrollWidth > label.clientWidth;
    });
    expect(clipped).toBe(true);
  });
});

test.describe("U9 — the Table menu on a short window", () => {
  test("stays on screen and scrolls inside itself, so Preferences and Your ID can be reached", async ({
    page,
  }) => {
    // The menu is taller than what is left under the header on a short laptop. Uncapped it runs
    // off the bottom and its last sections cannot be reached at all; capped, it scrolls.
    await page.setViewportSize({ width: 1280, height: 480 });
    await createTable(page, "u9-short-window");
    const menu = await openTableMenu(page);
    const panel = await boxOf(menu);
    expect(panel.y + panel.height).toBeLessThanOrEqual(480);

    const scrolls = await menu.evaluate((dialog) => {
      const inner = [...dialog.querySelectorAll<HTMLElement>("*")].find(
        (node) => getComputedStyle(node).overflowY === "auto",
      );
      return inner ? inner.scrollHeight > inner.clientHeight : false;
    });
    expect(scrolls, "there is more menu than window, inside a scroller").toBe(true);

    const id = menu.getByText(/^Your ID /);
    await id.scrollIntoViewIfNeeded();
    const reached = await boxOf(id);
    expect(reached.y + reached.height, "Your ID is on screen once scrolled to").toBeLessThanOrEqual(
      480,
    );
    await expect(menu.getByRole("group", { name: "Sound & motion" })).toBeAttached();
  });
});

test.describe("U9 — the host's next steps, on a desktop", () => {
  test.describe.configure({ timeout: 60_000 });

  test("sit below the header, inside the screen, and never over the header's controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await createTable(page, "u9-card-geometry");
    const card = await boxOf(page.getByRole("region", { name: "Next steps for the host" }));
    const header = await boxOf(page.locator("[data-header-root]"));
    // Parked by the header's own measured height: a card at top 0 would cover the tools.
    expect(card.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(1280);
    for (const control of await headerControls(page)) {
      expect(disjoint(card, control), `the card is clear of ${control.name}`).toBe(true);
    }
  });
});
