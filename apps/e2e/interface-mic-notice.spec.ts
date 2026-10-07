// U10b — a failed microphone is told where the person is looking, in a live region that already
// exists before it speaks. Since voice everywhere, the mic starts at the voice control's Join
// (the Party card's mic button is the call's Mute toggle, shown only once you are in it).
// getUserMedia is stubbed to refuse (NotAllowedError), which is what a blocked permission does;
// the stub is page-side only, so every other behaviour is the app's own.

import { expect, test } from "./fixtures";
import { createTable, dismissNextSteps } from "./table-role.helpers";

test.describe("U10b — the microphone's failure notice", () => {
  test("the status region is in the accessibility tree before it speaks, then says what to do, at Join voice", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () =>
            Promise.reject(
              Object.assign(new Error("Permission denied"), { name: "NotAllowedError" }),
            ),
        },
      });
    });
    await createTable(page, "u10b-mic-notice");
    await dismissNextSteps(page);

    const voice = page.getByRole("group", { name: "Voice chat" });
    const mic = voice.getByRole("button", { name: /Join voice/ });
    await expect(mic).toBeVisible();
    const region = voice.locator(".player-card-mic-notice");

    // Before any failure: attached, and NOT display:none (that would take it out of the
    // accessibility tree, and a region that joins the tree already filled is not reliably
    // announced). It is clipped to nothing instead.
    await expect(region).toBeAttached();
    expect(await region.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
    // A role query skips anything hidden from the accessibility tree (display:none, visibility,
    // aria-hidden): the empty region is found by it.
    await expect(page.getByRole("status").and(region)).toHaveCount(1);
    await expect(mic).not.toHaveAttribute("aria-describedby", /.+/);

    await mic.click();
    await expect(region).toContainText(/Mic blocked/);
    await expect(region).toContainText(/privacy settings/);
    await expect(region).toBeInViewport({ ratio: 1 });
    // A real box once it speaks: clipped to 1px it would be "in the viewport" and unseen. At
    // least one line of text tall (on the old 130 px card it wrapped to several; beside the
    // header's Join voice it fits on one).
    const box = (await region.boundingBox())!;
    expect(box.width).toBeGreaterThan(60);
    expect(box.height).toBeGreaterThanOrEqual(12);
    await expect(mic).toHaveAttribute("aria-describedby", (await region.getAttribute("id"))!);
    // The control reads off: the microphone did not start, so this player is not in the call.
    await expect(voice).toHaveAttribute("data-voice-state", "off");
    await expect(voice.getByRole("button", { name: /Join voice/ })).toBeVisible();
    await expect(voice.getByRole("button", { name: /Mute/ })).toHaveCount(0);
  });
});
