import type { CDPSession } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";
import { observeWire, type Ledger } from "./u2-cancel.helpers";
import { canvasHit } from "./u4b-terrain.helpers";
import { joinMobileTable } from "./mobile/mobile.helpers";
import { openTouch, touchTap, type Pt } from "./mobile/touch.helpers";

// Konva fires click/tap whenever press and release land on the same shape —
// any mouse button, no movement slop — and a pan carries the door along under
// the pointer, so a pan that STARTED on a door also ended on it and swung it
// for the whole table. The Atlas touch-ownership spec hit this only when its
// generated door happened to sit where a bounded pan began; this spec starts
// each pan dead on a door and, like a hand, lets go only once the map has
// caught up: Konva's own hit test must put the door under the release, or a
// synthetic release outruns the redraw and misses the door (the left-button
// pan did exactly that). The pan must move the camera and send nothing, and a
// still click/tap on that same door must then swing it for every client. The
// setup pans press only where Konva hits no shape: the entry camera centres on
// the player's own token, and a press there starts a Konva node drag instead —
// the token moves, stage moves are suppressed, and the camera barely does.

const REGION = { x: 3, y: 3, cols: 24, rows: 20 };
const PAN = 80;

/** Press at `from`, move to `to`, run `beforeRelease` while still held, let go. */
type Drag = (from: Pt, to: Pt, beforeRelease?: () => Promise<void>) => Promise<void>;
type ScreenDoor = { id: string; state: string; a: Pt; b: Pt; mid: Pt };

const toggles = (wire: Ledger) => wire.sent.filter((m) => m.t === "toggle-door").length;
const moves = (wire: Ledger) => wire.sent.filter((m) => m.t === "transform-object").length;
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** Every door's screen segment: authoritative geometry through map transform and camera. */
const project = (page: Page) =>
  page.evaluate((): ScreenDoor[] => {
    const data = window.__HERO_BYTE_E2E__;
    const cam = data?.cam;
    const canvas = document.querySelector('[data-testid="map-board"] canvas');
    if (!cam || !canvas) throw new Error("Missing camera or canvas");
    const t = data?.snapshot?.sceneObjects?.find((o) => o.type === "map")?.transform;
    const angle = ((t?.rotation ?? 0) * Math.PI) / 180;
    const box = canvas.getBoundingClientRect();
    const screen = (px: number, py: number) => {
      const x = px * (t?.scaleX ?? 1),
        y = py * (t?.scaleY ?? 1);
      return {
        x: box.x + cam.x + ((t?.x ?? 0) + x * Math.cos(angle) - y * Math.sin(angle)) * cam.scale,
        y: box.y + cam.y + ((t?.y ?? 0) + x * Math.sin(angle) + y * Math.cos(angle)) * cam.scale,
      };
    };
    return (data?.snapshot?.compiledScene?.doors ?? []).map((d) => ({
      id: d.id,
      state: d.state,
      a: screen(d.x1, d.y1),
      b: screen(d.x2, d.y2),
      mid: screen((d.x1 + d.x2) / 2, (d.y1 + d.y2) / 2),
    }));
  });

const doorNamed = async (page: Page, id: string) => {
  const door = (await project(page)).find((d) => d.id === id);
  if (!door) throw new Error(`Door ${id} missing`);
  return door;
};

/** `window.Konva`, injected by the e2e dev build: read-only hit tests. */
type KonvaWindow = {
  Konva?: {
    stages: {
      container(): HTMLElement;
      getIntersection(pos: Pt): { name(): string } | null;
    }[];
  };
};

/** The listening Konva shape under a screen point: what a release there would hit. */
const konvaHit = (page: Page, at: Pt) =>
  page.evaluate((at) => {
    const stage = (window as unknown as KonvaWindow).Konva?.stages[0];
    if (!stage) throw new Error("Missing Konva stage");
    const box = stage.container().getBoundingClientRect();
    return stage.getIntersection({ x: at.x - box.left, y: at.y - box.top })?.name() ?? null;
  }, at);

/**
 * The point nearest the board's centre from which a straight drag by `by`
 * crosses only bare canvas, 40 px clear of its edges, and where Konva's hit
 * test — the one its pointerdown runs — finds no listening shape within 8 px:
 * bare floor (scenery never listens) but never a token, whose press would
 * start a node drag rather than a pan. With `avoid`, the point is also 40 px
 * from every door, so a press there can never land on one.
 */
const findSpot = (page: Page, by: Pt, avoid: ScreenDoor[] | null) =>
  page.evaluate(
    async ({ by, avoid }) => {
      const canvas = document.querySelector('[data-testid="map-board"] canvas');
      const stage = (window as unknown as KonvaWindow).Konva?.stages[0];
      if (!canvas || !stage) throw new Error("Missing canvas or Konva stage");
      // The hit canvas redraws a frame after the camera moves; test the one the press will hit.
      await new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled)));
      const box = canvas.getBoundingClientRect();
      const origin = stage.container().getBoundingClientRect();
      const noShape = (p: Pt) =>
        [-8, 0, 8].every((dx) =>
          [-8, 0, 8].every(
            (dy) => !stage.getIntersection({ x: p.x + dx - origin.left, y: p.y + dy - origin.top }),
          ),
        );
      const bare = (x: number, y: number) =>
        x > box.left + 40 &&
        x < box.right - 40 &&
        y > box.top + 40 &&
        y < box.bottom - 40 &&
        document.elementFromPoint(x, y) instanceof HTMLCanvasElement;
      const clearPath = (p: Pt) =>
        Array.from({ length: 9 }, (_, i) => bare(p.x + (by.x * i) / 8, p.y + (by.y * i) / 8)).every(
          Boolean,
        );
      const awayFromDoors = (p: Pt) =>
        (avoid ?? []).every(({ a, b }) => {
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const t = Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
          );
          return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) > 40;
        });
      const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const spots: Pt[] = [];
      for (let y = box.top; y < box.bottom; y += 16)
        for (let x = box.left; x < box.right; x += 16) spots.push({ x, y });
      spots.sort(
        (p, q) =>
          Math.hypot(p.x - centre.x, p.y - centre.y) - Math.hypot(q.x - centre.x, q.y - centre.y),
      );
      return spots.find((p) => awayFromDoors(p) && clearPath(p) && noShape(p)) ?? null;
    },
    { by, avoid },
  );

/** Real camera drags, each pressed on bare board clear of every door, until door `id` sits near `to`. */
async function bringDoorTo(page: Page, id: string, to: Pt, drag: Drag) {
  for (let i = 0; i < 24; i++) {
    const all = await project(page);
    const { mid } = all.find((d) => d.id === id)!;
    if (Math.hypot(to.x - mid.x, to.y - mid.y) < 6) return;
    const by = { x: clamp(to.x - mid.x, 120), y: clamp(to.y - mid.y, 80) };
    const from = await findSpot(page, by, all);
    if (!from) throw new Error("No door-free spot to start a camera pan");
    await drag(from, { x: from.x + by.x, y: from.y + by.y });
    await expect
      .poll(async () => {
        const next = (await doorNamed(page, id)).mid;
        return Math.hypot(next.x - mid.x, next.y - mid.y);
      })
      .toBeGreaterThan(1);
  }
  throw new Error("Door could not be brought into view by bounded camera pans");
}

/**
 * Bring a closed door onto open board, then pan starting dead on it and let go
 * only once the door is back under the pointer. Nothing may be sent and the
 * door must stay shut on every client.
 */
async function panStartingOnDoor(
  page: Page,
  wire: Ledger,
  clients: Page[],
  setup: Drag,
  pan: Drag,
) {
  const target = await findSpot(page, { x: PAN, y: 0 }, null);
  if (!target) throw new Error("No open board to pan across");
  const distance = (d: ScreenDoor) => Math.hypot(d.mid.x - target.x, d.mid.y - target.y);
  const closed = (await project(page)).filter((d) => d.state === "closed");
  const { id } = closed.sort((p, q) => distance(p) - distance(q))[0]!;
  const before = toggles(wire);
  const moved = moves(wire);
  await bringDoorTo(page, id, target, setup);
  expect(toggles(wire), "setup pans never press a door").toBe(before);
  expect(moves(wire), "setup pans never drag a token").toBe(moved);

  const at = (await doorNamed(page, id)).mid;
  const to = { x: at.x + PAN, y: at.y };
  await canvasHit(page, at, to);
  expect(await konvaHit(page, at), "the pan presses the door").toBe(`door-hit:${id}`);
  await pan(at, to, async () => {
    // Held at the end until the camera has carried the door to the pointer
    // and Konva's hit canvas has caught up, so this release lands on the door.
    await expect
      .poll(async () => {
        const { mid } = await doorNamed(page, id);
        return Math.hypot(mid.x - to.x, mid.y - to.y);
      })
      .toBeLessThan(3);
    await expect.poll(() => konvaHit(page, to)).toBe(`door-hit:${id}`);
  });
  await page.evaluate(() => 0); // flush any frame the release sent
  expect.soft(toggles(wire), "a pan starting on a door sends no toggle").toBe(before);
  expect.soft(moves(wire), "a pan starting on a door drags no token").toBe(moved);
  for (const client of clients) expect.soft((await doorNamed(client, id)).state).toBe("closed");
  return { id, at: to };
}

/** Positive control: a still press on the same spot swings it for every client. */
async function stillPressSwings(
  wire: Ledger,
  clients: Page[],
  id: string,
  press: () => Promise<void>,
) {
  const before = toggles(wire);
  await press();
  await expect.poll(() => toggles(wire)).toBe(before + 1);
  for (const client of clients)
    await expect.poll(async () => (await doorNamed(client, id)).state).toBe("open");
}

const mouseDrag =
  (page: Page, button: "left" | "middle"): Drag =>
  async (from, to, beforeRelease) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down({ button });
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await beforeRelease?.();
    await page.mouse.up({ button });
  };

/** One trusted finger over the same CDP channel the touch helpers use. */
const fingerDrag =
  (cdp: CDPSession): Drag =>
  async (from, to, beforeRelease) => {
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", at?: Pt) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: at ? [{ x: Math.round(at.x), y: Math.round(at.y), id: 0 }] : [],
      });
    await touch("touchStart", from);
    for (let i = 1; i <= 6; i++)
      await touch("touchMove", {
        x: from.x + ((to.x - from.x) * i) / 6,
        y: from.y + ((to.y - from.y) * i) / 6,
      });
    await beforeRelease?.();
    await touch("touchEnd");
  };

test("a pan that starts on a door moves the camera and never swings the door", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext();
  const deskContext = await browser.newContext();
  const phoneContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const dm = await dmContext.newPage();
  const desk = await deskContext.newPage();
  const phone = await phoneContext.newPage();
  const deskWire = observeWire(desk);
  const phoneWire = observeWire(phone);
  const clients = [dm, desk, phone];
  let cdp: CDPSession | undefined;
  try {
    await joinDefaultRoomAsDM(dm);
    await dm.getByTitle("Author the live map on the table").click();
    await dm.getByRole("button", { name: /START LIVE MAP/i }).click();
    await expect
      .poll(() => dm.evaluate(() => window.__HERO_BYTE_E2E__?.snapshot?.liveMapDocumentId))
      .toBeTruthy();
    await dm.evaluate((region) => {
      const data = window.__HERO_BYTE_E2E__!;
      data.sendMessage!({
        t: "map-studio-generate",
        documentId: data.snapshot!.liveMapDocumentId!,
        commandId: "door-pan-generate",
        recipe: "dungeon",
        seed: 20260715,
        bounds: region,
        params: { theme: "stone", density: "medium" },
      });
    }, REGION);
    await joinDefaultRoom(desk);
    await joinMobileTable(phone);
    for (const client of clients)
      await expect
        .poll(async () => (await project(client)).length, { timeout: 20_000 })
        .toBeGreaterThan(0);

    const deskSetup = mouseDrag(desk, "middle");
    await test.step("desktop left-drag pan starting on a door", async () => {
      const left = mouseDrag(desk, "left");
      const door = await panStartingOnDoor(desk, deskWire, clients, deskSetup, left);
      await stillPressSwings(deskWire, clients, door.id, () =>
        desk.mouse.click(door.at.x, door.at.y),
      );
    });

    await test.step("desktop middle-drag pan starting on a door", async () => {
      await panStartingOnDoor(desk, deskWire, clients, deskSetup, deskSetup);
    });

    await test.step("phone one-finger pan starting on a door", async () => {
      const touch = (cdp = await openTouch(phone));
      const drag = fingerDrag(touch);
      const door = await panStartingOnDoor(phone, phoneWire, clients, drag, drag);
      await stillPressSwings(phoneWire, clients, door.id, () => touchTap(touch, door.at));
    });
  } finally {
    await cdp?.detach().catch(() => undefined);
    await dmContext.close();
    await deskContext.close();
    await phoneContext.close();
  }
});
