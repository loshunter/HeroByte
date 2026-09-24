import { expect, test } from "./fixtures";
import { activate, armGrass, createAndJoin, mapContent, publicBarrier } from "./u2-cancel.helpers";
import {
  aimRegion,
  joinSecondDM,
  observeGeneration,
  selectGenerate,
  showGenerate,
  viewPlayerDungeon,
} from "./u3a-generate.helpers";

for (const mobile of [false, true]) {
  test(`U3a ${mobile ? "phone" : "desktop"} Generate retains refused inputs and acknowledges one successful retry`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(240_000);
    const aContext = await browser.newContext({
      baseURL,
      viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const bContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const pContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const a = await aContext.newPage(),
      b = await bContext.newPage(),
      player = await pContext.newPage();
    for (const page of [a, b, player]) page.setDefaultTimeout(15_000);
    const wa = observeGeneration(a),
      wb = observeGeneration(b),
      wp = observeGeneration(player);
    try {
      await createAndJoin(a, player, mobile, `U3a ${mobile ? "phone" : "desktop"} ${Date.now()}`);
      await armGrass(a, mobile, true);
      const layers = await joinSecondDM(b, a.url());
      await expect
        .poll(() => wa.received.some((m) => "t" in m && m.t === "map-studio-document"))
        .toBe(true);
      const document = wa.document();
      expect(document.layers.filter((layer) => layer.kind === "walls")).toHaveLength(1);
      expect(wb.document().id).toBe(document.id);
      const ui = await selectGenerate(a, mobile);
      const seed = await ui.seed.innerText();
      await aimRegion(a, mobile, document, -5);
      await info.attach("invalid-region-on-map.png", {
        body: await a.screenshot(),
        contentType: "image/png",
      });
      await showGenerate(a, mobile);
      await expect(ui.hint).toContainText("inside the map document");
      await expect(ui.fire).toBeDisabled();
      expect(wa.requests()).toHaveLength(0);
      const geometry = await aimRegion(a, mobile, document);
      await info.attach("persistent-valid-region.png", {
        body: await a.screenshot(),
        contentType: "image/png",
      });
      await showGenerate(a, mobile);
      await expect(ui.panel.getByText("Region: 24 × 24 cells", { exact: true })).toBeVisible();
      await expect(ui.fire).toBeEnabled();
      expect(wa.requests()).toHaveLength(0);

      await layers.getByRole("button", { name: "Lock Walls & Doors", exact: true }).click();
      await expect
        .poll(() => wa.document().layers.find((layer) => layer.kind === "walls")?.locked)
        .toBe(true);
      await expect(ui.fire).toBeEnabled();
      const before = wa.document();
      // The DM document frame precedes the public snapshot of the layer lock.
      // Establish the player's locked revision before testing refusal isolation.
      await expect
        .poll(async () => (await mapContent(player)).scene?.sourceRevision)
        .toBe(before.revision);
      const beforePlayer = await mapContent(player);
      await activate(ui.fire, mobile);
      await expect.poll(() => wa.requests().length).toBe(1);
      const first = wa.requests()[0]!;
      expect(first).toMatchObject({
        documentId: document.id,
        recipe: "dungeon",
        seed: Number(seed),
        bounds: { x: 12, y: 12, cols: 24, rows: 24 },
        params: { theme: "wood", density: "low" },
      });
      await expect
        .poll(() =>
          wa.received.filter(
            (m) =>
              "t" in m &&
              m.t === "map-studio-error" &&
              m.commandId === first.commandId &&
              m.documentId === document.id,
          ),
        )
        .toEqual([
          expect.objectContaining({
            code: "command-not-applied",
            reason: 'Generate needs an unlocked "walls" layer, but every walls layer is locked',
          }),
        ]);
      await expect(ui.hint).toContainText("Failed.");
      await expect(ui.hint).not.toContainText("Built here already");
      await expect(ui.fire).toBeEnabled();
      await expect(ui.seed).toHaveText(seed);
      await expect(ui.panel.getByText("Region: 24 × 24 cells", { exact: true })).toBeVisible();
      expect(wa.document()).toEqual(before);
      expect(await mapContent(player)).toEqual(beforePlayer);
      await info.attach("refused-inputs-retained.png", {
        body: await a.screenshot(),
        contentType: "image/png",
      });

      await layers.getByRole("button", { name: "Unlock Walls & Doors", exact: true }).click();
      await expect
        .poll(() => wa.document().layers.find((layer) => layer.kind === "walls")?.locked)
        .toBe(false);
      const unlocked = wa.document();
      await expect(ui.fire).toBeEnabled();
      expect(wa.requests()).toHaveLength(1);
      await activate(ui.fire, mobile);
      await expect.poll(() => wa.requests().length).toBe(2);
      const second = wa.requests()[1]!;
      expect(second.commandId).not.toBe(first.commandId);
      expect({ ...second, commandId: first.commandId }).toEqual(first);
      for (const wire of [wa, wb]) {
        await expect
          .poll(() =>
            wire.received.filter(
              (m) =>
                "t" in m &&
                m.t === "map-studio-document" &&
                m.appliedCommandId === second.commandId,
            ),
          )
          .toHaveLength(1);
      }
      const built = wa.document();
      expect(built.revision).toBe(unlocked.revision + 1);
      expect(built.elements.length).toBeGreaterThan(0);
      expect(built.elements.every((element) => element.id.startsWith(second.commandId))).toBe(true);
      expect(new Set(built.elements.map((element) => element.id)).size).toBe(built.elements.length);
      await expect(ui.hint).toContainText("Built here already");
      await expect(ui.fire).toBeDisabled();
      // Instantaneous check: waiting out the old toast's timer would hide this defect.
      expect(
        await a
          .getByText('Generate needs an unlocked "walls" layer, but every walls layer is locked', {
            exact: true,
          })
          .count(),
      ).toBe(0);
      await expect(ui.hint).toBeInViewport({ ratio: 1 });
      await expect(ui.seed).toHaveText(seed);
      await expect
        .poll(async () => (await mapContent(player)).scene?.walls.length)
        .toBeGreaterThan(4);
      await expect
        .poll(async () => (await mapContent(player)).scene?.doors.length)
        .toBeGreaterThan(0);
      expect((await mapContent(player)).scene?.sourceRevision).toBe(built.revision);
      await expect
        .poll(async () => (await mapContent(player)).terrain)
        .toEqual((await mapContent(a)).terrain);
      await expect
        .poll(async () => (await mapContent(player)).elements)
        .toEqual((await mapContent(a)).elements);
      await publicBarrier(player, [a, b, player], "u3a-success");
      expect(wa.requests()).toHaveLength(2);
      expect(wb.requests()).toHaveLength(0);
      expect(wp.requests()).toHaveLength(0);
      expect(wp.received.some((m) => "t" in m && m.t === "map-studio-document")).toBe(false);
      await info.attach("successful-retry.png", {
        body: await a.screenshot(),
        contentType: "image/png",
      });
      await viewPlayerDungeon(player, built);
      await info.attach("player-result.png", {
        body: await player.screenshot(),
        contentType: "image/png",
      });
      await info.attach("generate-evidence.json", {
        body: Buffer.from(
          JSON.stringify({
            first,
            second,
            geometry,
            previousRevision: unlocked.revision,
            resultRevision: built.revision,
            generatedElements: built.elements.length,
            playerDocumentFrames: 0,
          }),
        ),
        contentType: "application/json",
      });
    } finally {
      await aContext.close();
      await bContext.close();
      await pContext.close();
    }
  });
}
