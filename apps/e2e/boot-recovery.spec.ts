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
 */
import { expect, test } from "./fixtures";

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
});
