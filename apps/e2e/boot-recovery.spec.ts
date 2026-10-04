/**
 * The boot watchdog: one failed chunk must not mean a forever-blank page.
 *
 * The app is an ES-module graph, and a single failed vendor-chunk fetch kills
 * the whole graph silently — React never runs, so no error boundary exists
 * yet, and the page stays blank with nothing to say. This was the e2e suite's
 * one recurring flake (~1 in 1900 page loads across 41 preserved gate runs,
 * four sightings, every one showing zero websocket contact), reproduced
 * 2026-08-30 under a 3000-load hunt with request forensics: vendor-voice
 * answered net::ERR_CONNECTION_FAILED between two requests that succeeded.
 *
 * These tests are that flake, made deterministic. Route interception kills a
 * vendor chunk exactly the way the wild failure did; the watchdog in
 * index.html must recover (reload once) or, failing twice, say so visibly.
 * Sabotage note: with the watchdog removed from index.html, the first test IS
 * the original bug and times out.
 *
 * A separate failure leaves React mounted without the core stylesheet. Those
 * cases inject a CSS download failure, prove recovery restores the mobile map,
 * and stop a terminal mounted app through React cleanup. Storage cases prove an unwritable
 * retry marker cannot turn either startup failure into an endless reload.
 */
import { expect, test, type Page } from "./fixtures";

test.describe("boot recovery", () => {
  test("a failed vendor chunk on first load heals itself with one reload", async ({ page }) => {
    let killedOnce = false;
    await page.route("**/assets/vendor-*.js", (route) => {
      if (!killedOnce) {
        killedOnce = true;
        return route.abort("connectionfailed");
      }
      return route.continue();
    });

    await page.goto("/");

    // No manual help: the watchdog notices the empty mount ~4s after load and
    // reloads once; the second load's chunks all succeed. 20s covers
    // load + grace + reload + boot with margin.
    await expect(page.getByPlaceholder("Table password")).toBeEnabled({ timeout: 20_000 });
  });

  test("a boot that fails twice says so instead of staying blank", async ({ page }) => {
    await page.route("**/assets/vendor-*.js", (route) => route.abort("connectionfailed"));

    await page.goto("/");

    // First load fails -> guarded reload -> fails again -> the watchdog must
    // paint the failure message rather than loop or stay silent.
    await expect(page.getByText(/HeroByte didn't load/i)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/failed to download/i)).toBeVisible();
  });

  for (const failure of ["read", "write", "discard"] as const) {
    test(`a failed vendor chunk with denied retry storage does not reload forever (${failure})`, async ({
      page,
    }) => {
      await denyRetryStorage(page, failure);
      let documentLoads = 0;
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) documentLoads += 1;
      });
      await page.route("**/assets/vendor-*.js", (route) => route.abort("connectionfailed"));
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toBeVisible({
        timeout: 10_000,
      });
      await expectNoFurtherNavigation(page);
      expect(documentLoads).toBe(1);
    });
  }
});

test.describe("stylesheet boot recovery", () => {
  // A CSS failure still executes main.tsx, which registers the service worker.
  // Keep both attempts on the intercepted network path for this fault injection.
  test.use({ serviceWorkers: "block", viewport: { width: 375, height: 812 } });

  test("a failed core stylesheet recovers even after React has mounted", async ({ page }) => {
    let cssAttempts = 0;
    let documentLoads = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) documentLoads += 1;
    });
    await page.route("**/assets/index-*.css", (route) => {
      cssAttempts += 1;
      return cssAttempts === 1 ? route.abort("connectionfailed") : route.continue();
    });

    await page.goto("/?mobile=true");
    // This is the gap in the original watchdog: the auth form mounts without
    // styles, so a nonempty root alone reports this broken startup as healthy.
    await expect(page.getByPlaceholder("Table password")).toBeEnabled();
    expect(cssAttempts).toBe(1);
    const failedStyles = await readCoreStylesheets(page);
    await test.info().attach("failed-css-state", {
      contentType: "application/json",
      body: JSON.stringify(failedStyles),
    });
    expect(failedStyles.length).toBeGreaterThan(0);
    expect(failedStyles.some((style) => !style.readable)).toBe(true);

    await expect.poll(() => cssAttempts, { timeout: 20_000 }).toBe(2);
    await expect(page.getByPlaceholder("Table password")).toBeEnabled();
    await expect
      .poll(() =>
        readCoreStylesheets(page).then(
          (styles) =>
            styles.length > 0 && styles.every((style) => style.readable && style.rules > 0),
        ),
      )
      .toBe(true);
    expect(documentLoads).toBe(2);

    await page.getByPlaceholder("Table password").fill(process.env.E2E_ROOM_PASSWORD ?? "Fun1");
    await page.getByRole("button", { name: /Enter Table/i }).click();
    await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: /Mobile actions/i })).toHaveCSS(
      "display",
      "grid",
    );
    // The successful startup must release the guard, so a later independent
    // failure gets its own one retry rather than inheriting this one.
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("herobyte-boot-retried")))
      .toBeNull();
  });

  test("repeated stylesheet failure unmounts the app through React cleanup", async ({
    page,
    browser,
    baseURL,
  }) => {
    const observer = await browser.newPage({ baseURL, serviceWorkers: "block" });
    try {
      await observer.goto("/");
      await observer
        .getByPlaceholder("Table password")
        .fill(process.env.E2E_ROOM_PASSWORD ?? "Fun1");
      await observer.getByRole("button", { name: /Enter Table/i }).click();
      await expect.poll(() => readOwnToken(observer)).not.toBeNull();
      let cssAttempts = 0;
      let documentLoads = 0;
      const stepFrames: string[] = [];
      page.on("websocket", (socket) => {
        socket.on("framesent", ({ payload }) => {
          const text = payload.toString();
          if (JSON.parse(text).t === "step-object") stepFrames.push(text);
        });
      });
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) documentLoads += 1;
      });
      await page.route("**/assets/index-*.css", (route) => {
        cssAttempts += 1;
        return route.abort("connectionfailed");
      });

      await page.goto("/?mobile=true");
      await expect(page.getByPlaceholder("Table password")).toBeEnabled();
      await page.getByPlaceholder("Table password").fill(process.env.E2E_ROOM_PASSWORD ?? "Fun1");
      await page.getByRole("button", { name: /Enter Table/i }).click();
      await expect.poll(() => readOwnToken(page)).not.toBeNull();
      const initialToken = (await readOwnToken(page))!;
      // Positive control: the unstyled, authenticated page really can move the
      // token from body before recovery. Its global handler must stop at failure.
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await readOwnToken(page))?.x).toBe(initialToken.x + 1);
      expect(stepFrames.length).toBeGreaterThan(0);
      expect(cssAttempts).toBe(1);

      await expect.poll(() => cssAttempts, { timeout: 20_000 }).toBe(2);
      await expect.poll(async () => (await readOwnToken(page))?.id).toBe(initialToken.id);
      const restoredToken = await readOwnToken(page);
      const mountedChild = await page.locator("#root > *").first().elementHandle();
      expect(mountedChild).not.toBeNull();

      await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/failed to download/i)).toBeVisible();
      await expect(page.locator("#root")).toBeHidden();
      await expect(page.getByTestId("map-board")).toHaveCount(0);
      await expect(page.locator("#root")).toBeEmpty();
      expect(await mountedChild!.evaluate((element) => element.isConnected)).toBe(false);
      stepFrames.length = 0;
      await page.getByRole("heading", { name: "HeroByte didn't load" }).click();
      await page.keyboard.press("ArrowRight");
      await expectNoFurtherNavigation(page);
      expect(stepFrames).toEqual([]);
      // The failed page's testing seam survives unmount and can be stale. Read
      // the authoritative replicated token from a separate, still-live client.
      expect(
        await observer.evaluate((id) => {
          const token = window.__HERO_BYTE_E2E__?.snapshot?.tokens.find(
            (candidate) => candidate.id === id,
          );
          return token ? { id: token.id, x: token.x, y: token.y } : null;
        }, initialToken.id),
      ).toEqual(restoredToken);
      expect(cssAttempts).toBe(2);
      expect(documentLoads).toBe(2);
    } finally {
      await observer.close();
    }
  });

  test("a stylesheet failure with denied retry storage stops without reloading", async ({
    page,
  }) => {
    await denyRetryStorage(page);
    let documentLoads = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) documentLoads += 1;
    });
    await page.route("**/assets/index-*.css", (route) => route.abort("connectionfailed"));
    await page.goto("/?mobile=true");
    await expect(page.getByPlaceholder("Table password")).toBeEnabled();
    await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("#root")).toBeHidden();
    await expectNoFurtherNavigation(page);
    expect(documentLoads).toBe(1);
  });

  test("a healthy startup stays usable with denied retry storage", async ({ page }) => {
    await denyRetryStorage(page);
    let documentLoads = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) documentLoads += 1;
    });
    await page.goto("/");
    await expect(page.getByPlaceholder("Table password")).toBeEnabled();
    await expectNoFurtherNavigation(page);
    await expect(page.getByPlaceholder("Table password")).toBeEnabled();
    await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toHaveCount(0);
    expect(documentLoads).toBe(1);
  });
});

async function expectNoFurtherNavigation(page: Page): Promise<void> {
  // Observe beyond the watchdog's 4s interval; an immediate count could miss
  // a wrongly scheduled third attempt. This waits for a forbidden event.
  await expect(
    page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: 5_000,
    }),
  ).rejects.toThrow(/Timeout/i);
}

async function denyRetryStorage(
  page: Page,
  failure: "read" | "write" | "discard" = "read",
): Promise<void> {
  await page.addInitScript((failureMode) => {
    const read = Storage.prototype.getItem;
    const write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "herobyte-boot-retried" && failureMode === "read") {
        throw new DOMException("Denied", "SecurityError");
      }
      return read.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "herobyte-boot-retried") {
        if (failureMode === "write") throw new DOMException("Denied", "QuotaExceededError");
        if (failureMode === "discard") return;
      }
      write.call(this, key, value);
    };
  }, failure);
}

async function readCoreStylesheets(page: Page) {
  return page.locator('link[rel="stylesheet"]').evaluateAll((links) =>
    links
      .map((link) => link as HTMLLinkElement)
      .filter((link) => new URL(link.href).origin === location.origin)
      .map((link) => {
        try {
          return {
            href: link.href,
            sheet: Boolean(link.sheet),
            readable: Boolean(link.sheet?.cssRules),
            rules: link.sheet?.cssRules.length ?? 0,
          };
        } catch {
          return { href: link.href, sheet: Boolean(link.sheet), readable: false, rules: 0 };
        }
      }),
  );
}

async function readOwnToken(page: Page) {
  return page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    const token = data?.snapshot?.tokens.find((candidate) => candidate.owner === data.uid);
    return token ? { id: token.id, x: token.x, y: token.y } : null;
  });
}
