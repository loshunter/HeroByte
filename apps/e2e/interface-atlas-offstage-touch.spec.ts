import type { CDPSession } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";
import { openTouch, touchTap, type Pt } from "./mobile/touch.helpers";
import { createAndJoin, observeWire, publicBarrier, uncoveredRow } from "./u2-cancel.helpers";

const links = (page: Page) =>
  page.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.atlasLinks ?? []);

async function openAtlas(page: Page) {
  const menu = page.getByRole("dialog", { name: "DM Menu" });
  if (!(await menu.isVisible())) {
    await page
      .getByRole("navigation", { name: "Mobile actions" })
      .getByRole("button", { name: "DM", exact: true })
      .tap();
  }
  const atlas = menu.getByRole("button", { name: "World", exact: true });
  await atlas.scrollIntoViewIfNeeded();
  await atlas.tap();
  return menu;
}

async function prepareAim(dm: Page) {
  const menu = await openAtlas(dm);
  await menu.getByLabel("New location name").fill("Waystone");
  await menu.getByRole("button", { name: "+ Create location" }).tap();
  const generate = menu.getByRole("button", { name: "🎲 Generate map for location…" });
  await generate.scrollIntoViewIfNeeded();
  await generate.tap();
  await menu.getByLabel("Size for Waystone").selectOption("small");
  await menu
    .getByTestId("atlas-generate-panel")
    .getByRole("button", { name: /^🎲 Generate map for / })
    .tap();
  await expect
    .poll(() =>
      dm.evaluate(
        () =>
          window.__HERO_BYTE_E2E__?.snapshot?.atlasNodes?.find((node) => node.name === "Waystone")
            ?.mapDocumentId,
      ),
    )
    .toBeTruthy();
  const travel = menu.getByRole("button", { name: "🚩 Travel here" });
  await travel.scrollIntoViewIfNeeded();
  await travel.tap();
  await expect
    .poll(() =>
      dm.evaluate(() => {
        const s = window.__HERO_BYTE_E2E__?.snapshot;
        return s?.atlasNodes?.find((node) => node.id === s.currentAtlasNodeId)?.name;
      }),
    )
    .toBe("Waystone");
  await openAtlas(dm);
  await menu.getByLabel("New location name").fill("Beyond");
  await menu.getByRole("button", { name: "+ Create location" }).tap();
  const target = menu.getByLabel("Link target from Waystone");
  await target.scrollIntoViewIfNeeded();
  await target.selectOption({ label: "Beyond" });
  const aim = menu.getByRole("button", { name: "⚓ AIM ON MAP" });
  await aim.scrollIntoViewIfNeeded();
  await aim.tap();
  await expect(dm.getByText("Link Placement")).toBeVisible();
  await dm.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function touch(
  cdp: CDPSession,
  type: "touchStart" | "touchEnd",
  points: (Pt & { id: number })[],
) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id })),
  });
}

for (const lift of ["canvas", "dock"] as const) {
  test(`U2 Atlas aim ignores stationary offstage second finger (${lift} lifts first)`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(150_000);
    const dmContext = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const peerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage();
    const peer = await peerContext.newPage();
    const wire = observeWire(dm);
    dm.on("dialog", (dialog) => void dialog.accept());
    let cdp: CDPSession | undefined;
    let holding = false;
    try {
      await createAndJoin(dm, peer, true, `Atlas offstage ${lift} ${Date.now()}`);
      await prepareAim(dm);
      await publicBarrier(peer, [dm, peer], "aim-ready");
      const beforePeer = await links(peer);
      expect(await links(dm)).toEqual([]);
      const point = (await uncoveredRow(dm, 0.48))[0];
      const nav = dm.getByRole("navigation", { name: "Mobile actions" });
      const box = await nav.boundingBox();
      if (!box) throw new Error("Mobile dock absent");
      const outside = { x: box.x + 5, y: box.y + 5 };
      expect(
        await nav.evaluate(
          (element, p) => document.elementFromPoint(p.x, p.y) === element,
          outside,
        ),
      ).toBe(true);
      cdp = await openTouch(dm);
      await touch(cdp, "touchStart", [{ ...point, id: 0 }]);
      holding = true;
      await touch(cdp, "touchStart", [
        { ...point, id: 0 },
        { ...outside, id: 1 },
      ]);
      // No move after finger two arrives: only document capture can see it.
      await touch(cdp, "touchEnd", [
        lift === "canvas" ? { ...outside, id: 1 } : { ...point, id: 0 },
      ]);
      await touch(cdp, "touchEnd", []);
      holding = false;
      await publicBarrier(peer, [dm, peer], "both-lifted");
      expect(wire.sent.filter((m) => m.t === "atlas-create-link")).toHaveLength(0);
      expect(await links(dm)).toEqual([]);
      expect(await links(peer)).toEqual(beforePeer);
      await expect(dm.getByText("Link Placement")).toBeVisible();
      await info.attach("aim-retained-after-lifts.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
      await touchTap(cdp, point);
      await expect.poll(() => links(dm)).toHaveLength(1);
      await expect(dm.getByText("Link Placement")).toBeHidden();
      await publicBarrier(peer, [dm, peer], "fresh-tap");
      expect(wire.sent.filter((m) => m.t === "atlas-create-link")).toHaveLength(1);
      const created = (await links(dm))[0]!;
      // Beyond is still hidden: the player sees the exit, never its secret destination.
      expect(created.visibleToPlayers).toBe(true);
      expect(await links(peer)).toEqual([
        {
          id: created.id,
          fromNodeId: created.fromNodeId,
          anchor: created.anchor,
          linkType: created.linkType,
        },
      ]);
      await info.attach("player-after-fresh-tap.png", {
        body: await peer.screenshot(),
        contentType: "image/png",
      });
    } finally {
      if (cdp && holding) await touch(cdp, "touchEnd", []);
      await cdp?.detach();
      await dmContext.close();
      await peerContext.close();
    }
  });
}
