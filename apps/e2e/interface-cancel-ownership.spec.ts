// Two variants of one two-client journey; custom contexts keep the phone truly touch-enabled.
import type { CDPSession } from "@playwright/test";
import { expect, test } from "./fixtures";
import { composer, openChat } from "./chat-journey.helpers";
import { openTouch, touchDrag } from "./mobile/touch.helpers";
import {
  armGrass,
  cancelStroke,
  createAndJoin,
  dock,
  expectPaintCommitted,
  expectUnchanged,
  mapCommands,
  mapContent,
  mapLauncher,
  mouseStroke,
  observeWire,
  publicBarrier,
  retainedGrass,
  uncoveredRow,
} from "./u2-cancel.helpers";
import {
  beginHeldStroke,
  moveHeldFinger,
  releaseHeldFinger,
  tapSecondFingerOffStage,
} from "./u2-cancel-touch.helpers";

for (const touch of [false, true]) {
  test(`${touch ? "375px touch Cancel" : "desktop Escape"} discards held grass; next stroke works`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(150_000);
    const dmContext = await browser.newContext({
      baseURL,
      viewport: touch ? { width: 375, height: 812 } : { width: 1440, height: 900 },
      hasTouch: touch,
      isMobile: touch,
    });
    const observerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage();
    const observer = await observerContext.newPage();
    const ledger = observeWire(dm);
    const observerLedger = observeWire(observer);
    const pages = [dm, observer];
    let cdp: CDPSession | undefined;
    try {
      await createAndJoin(
        dm,
        observer,
        touch,
        `U2 grass ${touch ? "phone" : "desktop"} ${Date.now()}`,
      );
      await armGrass(dm, touch, true);
      if (touch) cdp = await openTouch(dm);

      // A real successful commit proves geometry, authority, observer delivery and wire instrumentation.
      const initial = await mapContent(dm);
      const initialCount = mapCommands(ledger).length;
      const positiveBefore = await uncoveredRow(dm, 0.28);
      if (cdp) await touchDrag(cdp, positiveBefore[0], [positiveBefore[1]]);
      else await mouseStroke(dm, positiveBefore);
      await expectPaintCommitted(dm, observer, ledger, initialCount, initial);
      await publicBarrier(observer, pages, "positive-before");
      expect(observerLedger.sent.some((m) => m.t === "chat")).toBe(true);

      if (!touch) {
        // Bounded foreground/history companion: native text undo changes no map history;
        // one Escape closes Chat, restores launcher focus, and leaves Paint armed.
        const before = await Promise.all(pages.map(mapContent));
        const sent = mapCommands(ledger).length;
        const launcher = dm.getByRole("button", { name: "📜 Chat & Rolls", exact: true });
        await openChat(dm);
        await composer(dm).click();
        const typed = "native text undo";
        await composer(dm).pressSequentially(typed);
        await expect(composer(dm)).toHaveValue(typed);
        await composer(dm).press("Control+z");
        // Native typing groups vary; require a real suffix undo, never a no-op.
        await expect
          .poll(async () => {
            const remaining = await composer(dm).inputValue();
            return remaining.length < typed.length && typed.startsWith(remaining);
          })
          .toBe(true);
        await composer(dm).press("Escape");
        await expect(composer(dm)).toHaveCount(0);
        await expect(launcher).toBeFocused();
        await expect(mapLauncher(dm)).toHaveAttribute("aria-pressed", "true");
        await publicBarrier(observer, pages, "native-text-and-chat-close");
        await expectUnchanged(pages, before, ledger, sent);
      }

      // Phone runs both discriminatory releases: completely still after Cancel, then
      // a new first-finger move AFTER the second finger lifts, which must not re-arm.
      for (const [index, fraction] of (touch ? [0.43, 0.59] : [0.49]).entries()) {
        const before = await Promise.all(pages.map(mapContent));
        const sent = mapCommands(ledger).length;
        const row = await uncoveredRow(dm, fraction);
        if (cdp) await beginHeldStroke(cdp, row);
        else await mouseStroke(dm, row, false);
        expect(mapCommands(ledger)).toHaveLength(sent);
        // This is a planned U2 control. Its absence is setup failure, not a behavioral red.
        await expect(cancelStroke(dm)).toBeEnabled();
        if (!touch) {
          const reach = await cancelStroke(dm).evaluate((button) => {
            const box = button.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              onScreen: box.top >= 0 && box.bottom <= innerHeight,
              hit: button.contains(
                document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
              ),
            };
          });
          expect(reach.width).toBeGreaterThanOrEqual(44);
          expect(reach.height).toBeGreaterThanOrEqual(44);
          expect(reach.onScreen, "Cancel must be reachable while the pointer is held").toBe(true);
          expect(reach.hit).toBe(true);
        }
        await testInfo.attach(`held-${index}.png`, {
          body: await dm.screenshot(),
          contentType: "image/png",
        });

        if (cdp) {
          await expect(dock(dm).getByRole("button")).toHaveCount(5);
          const button = cancelStroke(dm);
          const box = await button.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(375);
          expect(box!.y + box!.height).toBeLessThanOrEqual(812);
          const at = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
          expect(
            await button.evaluate(
              (element, point) => element.contains(document.elementFromPoint(point.x, point.y)),
              at,
            ),
          ).toBe(true);
          // First touch remains motionless until the off-stage second touch lifts.
          await tapSecondFingerOffStage(cdp, row[1], at);
        } else {
          await dm.keyboard.press("Escape");
        }
        // Do not require a new idle label/presentation; hidden or disabled is acceptable.
        await expect
          .configure({ soft: true })
          .poll(
            async () =>
              (await cancelStroke(dm).isVisible()) && (await cancelStroke(dm).isEnabled()),
          )
          .toBe(false);
        await testInfo.attach(`cancelled-held-${index}.png`, {
          body: await dm.screenshot(),
          contentType: "image/png",
        });
        if (cdp) {
          if (index === 1) await moveHeldFinger(cdp, row[0]);
          await releaseHeldFinger(cdp);
        } else {
          await dm.mouse.move(row[0].x, row[0].y, { steps: 6 });
          await dm.mouse.up();
        }
        await publicBarrier(observer, pages, `cancel-and-release-${index}`);
        await expectUnchanged(pages, before, ledger, sent);
        await retainedGrass(dm, touch);
      }

      // No foreground content panel remains; idle Escape now leaves the tool for Move.
      const beforeExit = await Promise.all(pages.map(mapContent));
      const beforeExitCount = mapCommands(ledger).length;
      await dm.keyboard.press("Escape");
      if (touch) {
        await expect(dock(dm)).toHaveCount(0);
        await expect(dm.getByRole("navigation", { name: "Mobile actions" })).toBeVisible();
      } else {
        await expect(dm.getByRole("button", { name: "✥ Move", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await publicBarrier(observer, pages, "idle-escape-move");
      await expectUnchanged(pages, beforeExit, ledger, beforeExitCount);

      // Cancellation cannot poison the next new gesture. Re-enter through the UI.
      await armGrass(dm, touch, false);
      const previous = await mapContent(dm);
      const sent = mapCommands(ledger).length;
      const positiveAfter = await uncoveredRow(dm, 0.75);
      if (cdp) await touchDrag(cdp, positiveAfter[0], [positiveAfter[1]]);
      else await mouseStroke(dm, positiveAfter);
      await expectPaintCommitted(dm, observer, ledger, sent, previous);
      await publicBarrier(observer, pages, "positive-after");
      expect(mapCommands(ledger)).toHaveLength(initialCount + 2);
      expect(mapCommands(observerLedger)).toHaveLength(0);
      await testInfo.attach("final.png", { body: await dm.screenshot(), contentType: "image/png" });
    } finally {
      if (cdp) await cdp.detach();
      await dmContext.close();
      await observerContext.close();
    }
  });
}
