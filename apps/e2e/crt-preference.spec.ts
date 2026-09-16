import { type Page, type TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";
import { elevateViaUI } from "./docs-shots.helpers";

const toggle = (page: Page) => page.getByTitle("Toggle retro CRT visual effect");

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}

async function overlayStyles(page: Page) {
  return page.locator(".crt-filter").evaluate((element) => {
    const style = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    return {
      animation: style.animationName,
      filter: style.filter,
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      transition: style.transitionDuration,
      mask: before.content,
      maskOpacity: before.opacity,
      stripe: before.getPropertyValue("--crt-phosphor-stripe").trim(),
      after: getComputedStyle(element, "::after").content,
    };
  });
}

test.describe("CRT preference and rendered treatment", () => {
  for (const deviceScaleFactor of [1, 2]) {
    test(`desktop persists both states and renders a stable ${deviceScaleFactor}x treatment`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor,
      });
      const page = await context.newPage();
      try {
        await joinDefaultRoom(page);
        await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
        expect(await page.evaluate(() => localStorage.getItem("herobyte:crt"))).toBeNull();
        await toggle(page).click();
        await page.reload();
        await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(".crt-filter")).toHaveCount(1);
        await expect(page.locator(".crt-bezel")).toHaveCount(1);
        const styles = await overlayStyles(page);
        expect(styles).toMatchObject({
          animation: "none",
          filter: "none",
          pointerEvents: "none",
          mask: '""',
          after: "none",
        });
        // Minification shortens 0.5px to .5px; assert the length, not its spelling.
        expect(styles.stripe).toMatch(/px$/);
        expect(Number.parseFloat(styles.stripe)).toBe(deviceScaleFactor === 1 ? 1 : 0.5);
        await capture(page, info, "desktop-crt");

        // A real input gesture must reach the map through the full-screen overlay.
        await page.waitForFunction(() => Boolean(window.__HERO_BYTE_E2E__?.cam));
        const before = await page.evaluate(() => window.__HERO_BYTE_E2E__!.cam);
        const box = await page.getByTestId("map-board").boundingBox();
        expect(box).not.toBeNull();
        await page.keyboard.down("Space");
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.down();
        await page.mouse.move(box!.x + box!.width / 2 + 100, box!.y + box!.height / 2 + 80, {
          steps: 15,
        });
        await page.mouse.up();
        await page.keyboard.up("Space");
        await expect
          .poll(() => page.evaluate(() => window.__HERO_BYTE_E2E__!.cam))
          .not.toEqual(before);

        await page.getByRole("button", { name: "📜 Log", exact: true }).click();
        await expect(page.locator(".crt-filter")).toHaveCSS("opacity", "0.35");
        await expect(page.locator(".crt-vignette")).toHaveCSS("opacity", "0.5");
        expect((await overlayStyles(page)).maskOpacity).toBe("0");
        await capture(page, info, "panel-softening");
        await page.getByRole("button", { name: "📜 Log", exact: true }).click();
        await page.emulateMedia({ reducedMotion: "reduce" });
        expect((await overlayStyles(page)).transition).toBe("0s");
        await expect(page.locator(".pixel-sparkle").first()).toHaveCSS("animation-name", "none");

        await toggle(page).click();
        await page.reload();
        await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
        await expect(page.locator(".crt-filter")).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem("herobyte:crt"))).toBe("false");
      } finally {
        await context.close();
      }
    });
  }

  test("a mobile player keeps a local preference while sharing a table with a desktop DM", async ({
    browser,
  }, info) => {
    test.setTimeout(60_000);
    const dmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const playerContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    try {
      await joinDefaultRoom(dm);
      await elevateViaUI(dm);
      await joinDefaultRoom(player);
      await player.setViewportSize({ width: 375, height: 812 });
      await expect(player.getByRole("navigation", { name: "Mobile actions" })).toBeVisible();
      const identities = await Promise.all(
        [dm, player].map((page) => page.evaluate(() => window.__HERO_BYTE_E2E__!.uid)),
      );
      expect(identities[0]).not.toBe(identities[1]);
      await toggle(dm).click();
      await expect(player.locator(".crt-filter")).toHaveCount(0);
      expect(await player.evaluate(() => localStorage.getItem("herobyte:crt"))).toBeNull();

      await player.getByRole("button", { name: /Tools/ }).tap();
      const tile = toggle(player);
      const bounds = await tile.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      await tile.tap();
      await expect(tile).toHaveAttribute("aria-pressed", "true");
      await expect(player.locator(".crt-filter--mobile")).toHaveCount(1);
      await expect(player.locator(".crt-bezel")).toHaveCount(0);
      await expect(player.locator(".pixel-sparkle")).toHaveCount(0);
      expect((await overlayStyles(player)).mask).toBe("none");
      await capture(player, info, "mobile-tools");
      // Repeated real taps must each toggle exactly once, without compat-mouse doubling.
      for (const pressed of ["false", "true", "false", "true"]) {
        await tile.tap();
        await expect(tile).toHaveAttribute("aria-pressed", pressed);
      }
      await player.reload();
      await expect(player.locator(".crt-filter--mobile")).toBeVisible();
      await capture(player, info, "mobile-portrait");
      await player.setViewportSize({ width: 812, height: 375 });
      await expect(player.locator(".crt-filter--mobile")).toBeVisible();
      expect((await overlayStyles(player)).mask).toBe("none");
      await expect(player.locator(".crt-bezel")).toHaveCount(0);
      await capture(player, info, "mobile-landscape");

      // Drive the DM's actual drawing tool and assert the received drawing on
      // the other client. The dev seam only reads state; it causes no behavior.
      const count = await player.evaluate(
        () => window.__HERO_BYTE_E2E__!.snapshot!.drawings.length,
      );
      await dm.getByRole("button", { name: /Draw Tools/i }).click();
      const canvas = await dm.getByTestId("map-board").locator("canvas").first().boundingBox();
      await dm.mouse.move(canvas!.x + canvas!.width * 0.4, canvas!.y + canvas!.height * 0.4);
      await dm.mouse.down();
      await dm.mouse.move(
        canvas!.x + canvas!.width * 0.4 + 100,
        canvas!.y + canvas!.height * 0.4 + 50,
        { steps: 15 },
      );
      await dm.mouse.up();
      await expect
        .poll(() => player.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.drawings.length))
        .toBe(count + 1);
      const received = await player.evaluate(() =>
        window.__HERO_BYTE_E2E__!.snapshot!.drawings.at(-1),
      );
      expect(received?.owner).toBe(identities[0]);
      await capture(player, info, "player-received-drawing");
      await dm.getByRole("button", { name: /Draw Tools/i }).click();
      await capture(dm, info, "dm-shared-drawing");

      await toggle(dm).click();
      await expect(dm.locator(".crt-filter")).toHaveCount(0);
      await expect(player.locator(".crt-filter--mobile")).toBeVisible();
    } finally {
      await dmContext.close();
      await playerContext.close();
    }
  });

  test("blocked preference storage still allows toggling in the running app", async ({ page }) => {
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key === "herobyte:crt") throw new DOMException("Blocked", "SecurityError");
        return get.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === "herobyte:crt") throw new DOMException("Blocked", "QuotaExceededError");
        return set.call(this, key, value);
      };
    });
    await joinDefaultRoom(page);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".crt-filter")).toBeVisible();
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".crt-filter")).toHaveCount(0);
  });
});
