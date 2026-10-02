// U10b — a failed microphone is told where the person is looking, in a live region that already
// exists before it speaks. The mic control is on the desktop Party card (the phone has none).
// getUserMedia is stubbed to refuse (NotAllowedError), which is what a blocked permission does;
// the stub is page-side only, so every other behaviour is the app's own.

import { expect, test } from "./fixtures";
import { createTable, dismissNextSteps } from "./table-role.helpers";

test.describe("U10b — the microphone's failure notice", () => {
  test("the status region is in the accessibility tree before it speaks, then says what to do, on the card", async ({
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
    await page.getByRole("button", { name: /^\W*Cards$/i }).click();

    const mic = page.getByRole("button", { name: "Enable mic", exact: true });
    await expect(mic).toBeVisible();
    const region = page.locator(".player-card-mic-notice");

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
    // A real box once it speaks: clipped to 1px it would be "in the viewport" and unseen.
    const box = (await region.boundingBox())!;
    expect(box.width).toBeGreaterThan(60);
    expect(box.height).toBeGreaterThanOrEqual(24);
    await expect(mic).toHaveAttribute("aria-describedby", (await region.getAttribute("id"))!);
    // The control reads off: the microphone did not start.
    await expect(page.getByRole("button", { name: "Enable mic", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mute mic", exact: true })).toHaveCount(0);
  });
});
