import { chooseBuildTool } from "./build-palette.helpers";
import { expect, test, type Page } from "./fixtures";
import {
  armGrass,
  createAndJoin,
  expectUnchanged,
  mapCommands,
  mapContent,
  mapLauncher,
  observeWire,
  publicBarrier,
  uncoveredRow,
} from "./u2-cancel.helpers";

async function camera(page: Page) {
  return page.evaluate(() => {
    const cam = window.__HERO_BYTE_E2E__?.cam;
    if (!cam) throw new Error("Joined camera missing");
    return { x: cam.x, y: cam.y, scale: cam.scale };
  });
}

test("U2 secondary mouse opens Place/Grass wheel and pans without editing either client", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const peerContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const dm = await dmContext.newPage();
  const peer = await peerContext.newPage();
  const dmWire = observeWire(dm);
  const peerWire = observeWire(peer);
  const pages = [dm, peer];
  try {
    await createAndJoin(dm, peer, false, "U2 secondary mouse authoring guard");
    await armGrass(dm, false, true);
    const initial = await mapContent(dm);
    expect(initial.live).toBeTruthy();
    expect((await mapContent(peer)).live).toBeUndefined();
    await expect
      .poll(async () => {
        const { terrain, elements } = await mapContent(peer);
        return { terrain, elements };
      })
      .toEqual({ terrain: initial.terrain, elements: initial.elements });
    const before = await Promise.all(pages.map(mapContent));
    const sentCount = mapCommands(dmWire).length;

    await chooseBuildTool(dm, "place");
    await dm.getByRole("button", { name: "▸ Crate", exact: true }).click();
    const crate = dm
      .getByRole("group", { name: "Objects", exact: true })
      .getByRole("button", { name: "Crate", exact: true });
    await crate.click();
    await expect(crate).toHaveAttribute("aria-pressed", "true");
    await dm.getByRole("button", { name: "▾ Crate", exact: true }).click();

    for (const subTool of ["Place", "Grass"] as const) {
      if (subTool === "Grass") {
        await chooseBuildTool(dm, "terrain");
        await dm.getByTitle("Grass", { exact: true }).first().click();
        await expect(dm.getByText("Brush: Grass", { exact: true })).toBeVisible();
      }
      await expect(mapLauncher(dm)).toHaveAttribute("aria-pressed", "true");
      const [point] = await uncoveredRow(dm, 0.55);
      // Native Playwright mouse input reaches Konva and the context-menu handler.
      await dm.mouse.click(point.x, point.y, { button: "right" });
      const wheel = dm.getByRole("menu", { name: "Quick wheel", exact: true });
      // The radial anchor is deliberately 0×0; its eight positioned buttons
      // are the rendered surface. Measure those, and require the owner to exist.
      await expect(wheel).toHaveCount(1);
      const items = wheel.getByRole("menuitem");
      await expect(items).toHaveCount(8);
      for (const item of await items.all()) {
        await expect(item).toBeVisible();
        expect(
          await item.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
            );
          }),
        ).toBe(true);
      }
      await publicBarrier(peer, pages, `${subTool}-right-wheel`);
      await expectUnchanged(pages, before, dmWire, sentCount);
      await info.attach(`${subTool.toLowerCase()}-right-wheel-no-edit.png`, {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      await dm.keyboard.press("Escape");
      await expect(wheel).toHaveCount(0);
      await expect(mapLauncher(dm)).toHaveAttribute("aria-pressed", "true");
      if (subTool === "Grass") {
        await expect(dm.getByText("Brush: Grass", { exact: true })).toBeVisible();
      } else {
        await expect(dm.getByRole("button", { name: "Place object", exact: true })).toHaveClass(
          /jrpg-button-primary/,
        );
      }

      const [from, to] = await uncoveredRow(dm, 0.62);
      const previousCamera = await camera(dm);
      await dm.mouse.move(from.x, from.y);
      await dm.mouse.down({ button: "middle" });
      await dm.mouse.move(to.x, to.y, { steps: 12 });
      await dm.mouse.up({ button: "middle" });
      await expect.poll(() => camera(dm)).not.toEqual(previousCamera);
      expect((await camera(dm)).scale).toBe(previousCamera.scale);
      // The peer barrier gives a bounded post-release observation window; it
      // does not claim cross-socket ordering. Wire and both snapshots must agree.
      await publicBarrier(peer, pages, `${subTool}-middle-pan`);
      await expectUnchanged(pages, before, dmWire, sentCount);
      expect(mapCommands(peerWire)).toEqual([]);
      await info.attach(`${subTool.toLowerCase()}-middle-pan-no-edit.png`, {
        body: await dm.screenshot(),
        contentType: "image/png",
      });
    }

    await publicBarrier(peer, pages, "all-secondary-input-complete");
    await expectUnchanged(pages, before, dmWire, sentCount);
    expect(mapCommands(peerWire)).toEqual([]);
    expect((await mapContent(peer)).live).toBeUndefined();
    await info.attach("peer-content-unchanged-after-secondary-input.png", {
      body: await peer.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await dmContext.close();
    await peerContext.close();
  }
});
