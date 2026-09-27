import { expect, test, type Page } from "./fixtures";
import { createAndJoin, observeWire, publicBarrier } from "./u2-cancel.helpers";
import { canvasHit } from "./u4b-terrain.helpers";
import { boardBox } from "./mobile/mobile.helpers";
import { openTouch, touchDrag, touchTap } from "./mobile/touch.helpers";

const state = (page: Page) =>
  page.evaluate(() => {
    const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
    if (!snapshot) throw new Error("Joined snapshot missing");
    return {
      node: snapshot.currentAtlasNodeId,
      links: snapshot.atlasLinks ?? [],
      doors: snapshot.compiledScene?.doors ?? [],
    };
  });

async function atlas(page: Page) {
  const dialog = page.getByRole("dialog", { name: "DM Menu", exact: true });
  const launcher = page
    .getByRole("navigation", { name: "Mobile actions" })
    .getByRole("button", { name: "DM", exact: true });
  await test.step("Open the mobile DM menu", async () => {
    if (!(await dialog.isVisible())) {
      await expect(launcher).toHaveAttribute("aria-pressed", "false");
      await launcher.tap();
      await expect(launcher).toHaveAttribute("aria-pressed", "true");
    }
    await expect(dialog).toBeVisible();
  });
  await test.step("Select Atlas", async () => {
    await dialog.getByRole("button", { name: "Atlas", exact: true }).tap();
  });
  await expect(dialog.getByLabel("New node name")).toBeVisible();
  return dialog;
}

/** Project authoritative door geometry through the map transform and camera. */
async function doorPoint(page: Page, id: string) {
  return page.evaluate((id) => {
    const data = window.__HERO_BYTE_E2E__;
    const door = data?.snapshot?.compiledScene?.doors.find((d) => d.id === id);
    const cam = data?.cam;
    const canvas = document.querySelector('[data-testid="map-board"] canvas');
    if (!door || !cam || !canvas) throw new Error("Missing door, camera or canvas");
    const t = data.snapshot?.sceneObjects?.find((o) => o.type === "map")?.transform;
    const angle = ((t?.rotation ?? 0) * Math.PI) / 180;
    const x = ((door.x1 + door.x2) / 2) * (t?.scaleX ?? 1);
    const y = ((door.y1 + door.y2) / 2) * (t?.scaleY ?? 1);
    const box = canvas.getBoundingClientRect();
    return {
      x: box.x + cam.x + ((t?.x ?? 0) + x * Math.cos(angle) - y * Math.sin(angle)) * cam.scale,
      y: box.y + cam.y + ((t?.y ?? 0) + x * Math.sin(angle) + y * Math.cos(angle)) * cam.scale,
    };
  }, id);
}

/** Bring the door into view with real input; the E2E seam is read-only. */
async function panToDoor(
  page: Page,
  cdp: Awaited<ReturnType<typeof openTouch>> | null,
  id: string,
) {
  const box = await boardBox(page);
  const centre = { x: box.x + box.width / 2, y: box.y + box.height * 0.55 };
  for (let i = 0; i < 24; i++) {
    const point = await doorPoint(page, id);
    if (Math.hypot(point.x - centre.x, point.y - centre.y) < 12) {
      await canvasHit(page, point);
      return point;
    }
    const to = {
      x: centre.x + Math.max(-130, Math.min(130, centre.x - point.x)),
      y: centre.y + Math.max(-200, Math.min(200, centre.y - point.y)),
    };
    await canvasHit(page, centre, to);
    if (cdp) await touchDrag(cdp, centre, [to]);
    else {
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await page.mouse.up({ button: "middle" });
    }
    await expect
      .poll(async () => {
        const next = await doorPoint(page, id);
        return Math.hypot(next.x - point.x, next.y - point.y);
      })
      .toBeGreaterThan(2);
  }
  throw new Error("Door could not be reached by bounded camera gestures");
}

test("Atlas aimed touch owns its mouse stream and leaves the shared door closed", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const observer = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const dm = await context.newPage(),
    player = await observer.newPage();
  dm.setDefaultTimeout(12_000);
  player.setDefaultTimeout(12_000);
  const wire = observeWire(dm);
  dm.on("dialog", (dialog) => void dialog.accept());
  try {
    await createAndJoin(dm, player, true, "Atlas touch ownership");
    const dialog = await atlas(dm);
    await dialog.getByLabel("New node name").fill("Waystone");
    await dialog.getByRole("button", { name: "+ CREATE NODE", exact: true }).tap();
    await dialog.getByRole("button", { name: "🎲 Generate…", exact: true }).tap();
    await dialog.getByLabel("Size for Waystone").selectOption("small");
    await dialog
      .getByTestId("atlas-generate-panel")
      .getByRole("button", { name: "🎲 GENERATE", exact: true })
      .tap();
    const travel = dialog.getByRole("button", { name: "🚩 TRAVEL", exact: true });
    await expect(travel).toBeEnabled({ timeout: 30_000 });
    await travel.tap();
    await expect.poll(async () => (await state(dm)).doors.length).toBeGreaterThan(0);
    await expect.poll(async () => (await state(player)).node).toBe((await state(dm)).node);
    await dialog.getByLabel("New node name").fill("Beyond");
    await dialog.getByRole("button", { name: "+ CREATE NODE", exact: true }).tap();
    await expect(dialog.getByLabel("promise: Beyond")).toBeVisible();
    await dialog.getByRole("button", { name: "Close DM Menu", exact: true }).tap();
    await expect(dialog).toHaveCount(0);
    await expect(
      dm
        .getByRole("navigation", { name: "Mobile actions" })
        .getByRole("button", { name: "DM", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    const door = (await state(dm)).doors.find((d) => d.state === "closed");
    expect(door, "generated scene supplies a normal closed door").toBeDefined();
    const id = door!.id,
      cdp = await openTouch(dm);
    await panToDoor(dm, cdp, id);
    const doorState = async (page: Page) =>
      (await state(page)).doors.find((d) => d.id === id)?.state;
    await expect.poll(() => doorState(dm)).toBe("closed");
    await expect.poll(() => doorState(player)).toBe("closed");

    // Positive control: the same real target accepts ordinary touch for both clients.
    await touchTap(cdp, await doorPoint(dm, id));
    for (const page of [dm, player]) await expect.poll(() => doorState(page)).toBe("open");
    await touchTap(cdp, await doorPoint(dm, id));
    for (const page of [dm, player]) await expect.poll(() => doorState(page)).toBe("closed");
    expect(wire.sent.filter((m) => m.t === "toggle-door")).toHaveLength(2);

    await test.step("Reopen Atlas after the ordinary door touch controls", () => atlas(dm));
    await dialog.getByLabel("Link target from Waystone").selectOption({ label: "Beyond" });
    await dialog.getByRole("button", { name: "⚓ AIM ON MAP", exact: true }).tap();
    await expect(dm.getByText("Link Placement", { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    const trace = await dm.evaluateHandle(() => {
      const events: { type: string; prevented: boolean; trusted: boolean }[] = [];
      for (const type of ["touchstart", "touchend", "mousedown", "mouseup", "click"]) {
        document.addEventListener(
          type,
          (event) => {
            if (event.target instanceof HTMLCanvasElement)
              events.push({ type, prevented: event.defaultPrevented, trusted: event.isTrusted });
          },
          { passive: true },
        );
      }
      return events;
    });
    const before = wire.sent.length;
    const point = await doorPoint(dm, id);
    await canvasHit(dm, point);
    await touchTap(cdp, point);
    for (const page of [dm, player])
      await expect.poll(async () => (await state(page)).links).toHaveLength(1);
    await expect(dm.getByText("Link Placement", { exact: true })).toBeHidden();
    await publicBarrier(player, [dm, player], "Atlas aimed touch completed");
    const events = await trace.jsonValue();
    await info.attach("atlas-native-events.json", {
      body: JSON.stringify(events),
      contentType: "application/json",
    });
    await info.attach("atlas-gesture-messages.json", {
      body: JSON.stringify(wire.sent.slice(before)),
      contentType: "application/json",
    });
    expect(events.some((e) => e.type === "touchstart" && e.prevented && e.trusted)).toBe(true);
    expect(events.filter((e) => ["mousedown", "mouseup", "click"].includes(e.type))).toHaveLength(
      0,
    );
    expect(wire.sent.slice(before).filter((m) => m.t === "atlas-create-link")).toHaveLength(1);
    expect(wire.sent.slice(before).filter((m) => m.t === "toggle-door")).toHaveLength(0);
    for (const page of [dm, player]) expect(await doorState(page)).toBe("closed");
    const dmLink = (await state(dm)).links[0]!;
    expect(dmLink.toNodeId).toBeTruthy();
    expect(dmLink).toHaveProperty("visibleToPlayers", true);
    // The undiscovered Beyond destination is intentionally redacted for players.
    expect((await state(player)).links).toEqual([
      { id: dmLink.id, fromNodeId: dmLink.fromNodeId, linkType: "door", anchor: dmLink.anchor },
    ]);
    await info.attach("atlas-aim-dm.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });
    await panToDoor(player, null, id);
    expect(await doorState(player)).toBe("closed");
    await info.attach("atlas-aim-player.png", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
  } catch (error) {
    // Keep the primary failure if browser teardown also times out.
    await info.attach("atlas-primary-error.txt", {
      body: error instanceof Error ? (error.stack ?? error.message) : String(error),
      contentType: "text/plain",
    });
    throw error;
  } finally {
    await context.close();
    await observer.close();
  }
});
