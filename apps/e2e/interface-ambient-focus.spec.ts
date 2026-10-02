/**
 * Ambient light by keyboard (U10c, found in the journeys: a DM stepping the slider with the arrow
 * keys lost focus after the first step).
 *
 * The slider waited for the server by being `disabled`, and a browser takes focus off a control
 * that becomes disabled. The next key then lands on the page (where the movement keys step a
 * token) and the person has to Tab back to the slider from the top. The slider now says it is
 * waiting with `aria-disabled` and keeps focus.
 *
 * The server's replies are held back on the DM's socket so the "waiting" state lasts long
 * enough to look at; on a local server it is over in a millisecond, which is why the pane's single
 * key presses never showed it.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hideParty } from "./party.helpers";
import { chooseBuildTool } from "./build-palette.helpers";
import { armGrass, createAndJoin } from "./u2-cancel.helpers";

/** Delay every frame the server sends this page by `ms.current` (0: pass straight through). */
async function slowReplies(page: Page, ms: { current: number }) {
  await page.routeWebSocket(
    (url) => url.protocol === "ws:" && url.port === (process.env.E2E_WS_PORT ?? "8788"),
    (route) => {
      const server = route.connectToServer();
      route.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        if (ms.current === 0) route.send(message);
        else setTimeout(() => route.send(message), ms.current);
      });
      route.onClose((code, reason) => void server.close({ code, reason }));
      server.onClose((code, reason) => void route.close({ code, reason }));
    },
  );
}

test("the ambient light slider keeps keyboard focus while its change is saved", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } });
  const playerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 720 },
  });
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();
  const delay = { current: 0 };
  await slowReplies(dm, delay);
  try {
    await createAndJoin(dm, player, false, "U10c ambient focus");
    await hideParty(dm);
    await armGrass(dm, false, true);
    await chooseBuildTool(dm, "light");
    const slider = dm.getByRole("slider", { name: "Ambient light", exact: true });
    await slider.focus();
    await expect(slider).toBeFocused();
    const waiting = () =>
      slider.evaluate(
        (el: HTMLInputElement) => el.disabled || el.getAttribute("aria-disabled") === "true",
      );

    delay.current = 1500;
    await slider.press("ArrowLeft");
    // The change is on its way and not yet acknowledged: the slider says so, and a key
    // pressed now still lands on it.
    await expect.poll(waiting).toBe(true);
    await expect(slider).toBeFocused();
    await slider.press("ArrowLeft");
    await expect(slider).toBeFocused();

    delay.current = 0;
    await expect.poll(waiting, { timeout: 15_000 }).toBe(false);
    await expect(slider).toBeFocused();
    await expect(slider).toHaveValue("0.95");
    // And the next step after the save works without going back to find the slider.
    await slider.press("ArrowLeft");
    await expect(slider).toHaveValue("0.9");
    await expect(slider).toBeFocused();
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
