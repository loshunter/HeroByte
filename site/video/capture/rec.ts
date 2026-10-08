// Screen recording for the lesson videos: sharp frames, a visible cursor, and a log of what
// happened where, so the edit can zoom, point and pop up on exactly the right spot.
//
// Frames come from Chrome's own screencast (CDP Page.startScreencast) at deviceScaleFactor 2,
// because Playwright's recordVideo is a low-bitrate VP8 that smears UI text. Each frame keeps its
// wall-clock timestamp; tools/frames-to-mp4.mjs turns them into a constant-frame-rate video.
import fs from "node:fs";
import path from "node:path";
import type { BrowserContext, CDPSession, Locator, Page } from "@playwright/test";

export const VIEW = { width: 1440, height: 810 };
export const DSF = 2;

export type Box = { x: number; y: number; width: number; height: number };
export type Mark = { t: number; at?: number; kind: string; label: string; box?: Box; key?: string; value?: string };

/** Seconds since the chapter's clock started (shared by every recording in a chapter). */
export class Clock {
  readonly t0 = Date.now() / 1000;
  constructor(readonly name = "") {}
  now() {
    return Date.now() / 1000 - this.t0;
  }
  /** Wait until `t` seconds into the chapter. Already late? Carry on and say so. */
  async at(t: number, page: Page) {
    const wait = (t - this.now()) * 1000;
    if (wait > 0) await page.waitForTimeout(wait);
    else if (wait < -400) console.warn(`[${this.name}] ${(-wait / 1000).toFixed(2)}s late for ${t.toFixed(2)}s`);
  }
}

export class Recording {
  private cdp?: CDPSession;
  private frames: { file: string; t: number }[] = [];
  readonly marks: Mark[] = [];
  private writing = Promise.resolve();

  constructor(
    readonly page: Page,
    readonly dir: string,
    readonly clock: Clock,
  ) {}

  async start() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.dir, "frames"), { recursive: true });
    const cdp = await this.page.context().newCDPSession(this.page);
    this.cdp = cdp;
    cdp.on("Page.screencastFrame", (frame) => {
      const file = `f${String(this.frames.length).padStart(5, "0")}.jpg`;
      this.frames.push({ file, t: frame.metadata.timestamp! - this.clock.t0 });
      const data = Buffer.from(frame.data, "base64");
      this.writing = this.writing.then(() =>
        fs.promises.writeFile(path.join(this.dir, "frames", file), data),
      );
      void cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      maxWidth: (this.page.viewportSize() ?? VIEW).width * DSF,
      maxHeight: (this.page.viewportSize() ?? VIEW).height * DSF,
      everyNthFrame: 1,
    });
  }

  mark(kind: string, label: string, extra: Partial<Mark> = {}) {
    const t = +this.clock.now().toFixed(3);
    this.marks.push({ t, kind, label, ...extra });
    console.log(`[${this.clock.name} ${t.toFixed(2)}] ${kind} ${label}`);
  }

  async stop(endAt: number) {
    await this.cdp?.send("Page.stopScreencast").catch(() => {});
    await this.writing;
    const meta = { view: this.page.viewportSize() ?? VIEW, dsf: DSF, end: endAt, frames: this.frames, marks: this.marks };
    fs.writeFileSync(path.join(this.dir, "recording.json"), JSON.stringify(meta, null, 1));
  }
}

/** A cursor the screencast can see (headless Chrome draws none), with a ripple on every press. */
export async function addCursor(context: BrowserContext, touch = false) {
  await context.addInitScript((touch) => {
    const install = () => {
      if (document.getElementById("__rec_cursor")) return;
      const style = document.createElement("style");
      style.textContent = `
        #__rec_cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;
          pointer-events:none;transform:translate(-100px,-100px);transition:scale .12s ease-out;}
        #__rec_cursor.down{scale:.82}
        .__rec_ripple{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;
          margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #ffd447;
          animation:__rec_r .55s ease-out forwards}
        @keyframes __rec_r{to{transform:scale(4.2);opacity:0}}`;
      document.documentElement.appendChild(style);
      const cursor = document.createElement("div");
      cursor.id = "__rec_cursor";
      cursor.innerHTML =
        '<svg width="30" height="30" viewBox="0 0 30 30"><path d="M4 2 L4 24 L10 18.5 L14 27 L18 25.2 L14 16.8 L22 16.8 Z" fill="#fff" stroke="#0b0d12" stroke-width="2.2" stroke-linejoin="round"/></svg>';
      document.documentElement.appendChild(cursor);
      addEventListener(
        "mousemove",
        (e) => (cursor.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`),
        true,
      );
      addEventListener(
        "mousedown",
        (e) => {
          cursor.classList.add("down");
          const ripple = document.createElement("div");
          ripple.className = "__rec_ripple";
          ripple.style.left = `${e.clientX}px`;
          ripple.style.top = `${e.clientY}px`;
          document.documentElement.appendChild(ripple);
          setTimeout(() => ripple.remove(), 700);
        },
        true,
      );
      addEventListener("mouseup", () => cursor.classList.remove("down"), true);
    };
    const installTouch = () => {
      if (document.getElementById("__rec_touch")) return;
      const style = document.createElement("style");
      style.id = "__rec_touch";
      style.textContent = `
        .__rec_finger{position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;
          margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.55);
          border:3px solid #ffd447;animation:__rec_f .6s ease-out forwards}
        @keyframes __rec_f{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.5);opacity:0}}`;
      document.documentElement.appendChild(style);
      addEventListener(
        "touchstart",
        (e) => {
          for (const t of Array.from(e.touches)) {
            const dot = document.createElement("div");
            dot.className = "__rec_finger";
            dot.style.left = `${t.clientX}px`;
            dot.style.top = `${t.clientY}px`;
            document.documentElement.appendChild(dot);
            setTimeout(() => dot.remove(), 700);
          }
        },
        true,
      );
    };
    const go = touch ? installTouch : install;
    if (document.documentElement) go();
    else addEventListener("DOMContentLoaded", go);
  }, touch);
}

const mouseAt = new WeakMap<Page, { x: number; y: number }>();
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** Move the mouse along an eased path, so viewers can follow it. Paced by the clock, not by a
 *  step count, so it takes `ms` even when the page is slow to answer each move. */
export async function glide(page: Page, to: { x: number; y: number }, ms = 550) {
  const from = mouseAt.get(page) ?? { x: VIEW.width * 0.62, y: VIEW.height * 0.58 };
  const start = Date.now();
  for (;;) {
    const u = Math.min(1, (Date.now() - start) / ms);
    const k = ease(u);
    await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
    if (u >= 1) break;
    await page.waitForTimeout(12);
  }
  mouseAt.set(page, to);
}

export async function boxOf(target: Locator): Promise<Box> {
  await target.waitFor({ state: "visible", timeout: 20_000 });
  await target.scrollIntoViewIfNeeded();
  let box = await target.boundingBox();
  // Low on the page (a scrolled form): bring it to the middle, where a zoom on it stays clear of
  // the captions.
  if (box && box.y + box.height > VIEW.height * 0.72) {
    await target.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await target.page().waitForTimeout(120);
    box = await target.boundingBox();
  }
  if (!box) throw new Error(`no box for ${target}`);
  return box;
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * `at`: when, in the narration, this action belongs (seconds into the chapter). The action is
 * started so it lands then, and the mark keeps `at`, so the edit can retime the footage to put
 * it exactly there even when the browser ran late.
 */
type When = { at?: number; ms?: number };

async function arrive(rec: Recording, to: { x: number; y: number }, when: When, fallbackMs: number) {
  const ms = when.ms ?? fallbackMs;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000, rec.page);
  await glide(rec.page, to, ms);
}

async function press(rec: Recording) {
  await rec.page.mouse.down();
  await rec.page.waitForTimeout(70);
  await rec.page.mouse.up();
}

export async function hover(rec: Recording, target: Locator, label: string, when: When = {}) {
  const box = await boxOf(target);
  await arrive(rec, centre(box), when, 550);
  rec.mark("hover", label, { box, at: when.at });
}

export async function click(rec: Recording, target: Locator, label: string, when: When = {}) {
  const box = await boxOf(target);
  await arrive(rec, centre(box), when, 550);
  rec.mark("click", label, { box, at: when.at });
  await press(rec);
}

/** Press at a point inside `target` (offset from its top-left), e.g. an empty corner of the map. */
export async function clickPoint(rec: Recording, target: Locator, dx: number, dy: number, label: string, when: When = {}) {
  const box = await boxOf(target);
  await arrive(rec, { x: box.x + dx, y: box.y + dy }, when, 450);
  rec.mark("click", label, { box: { x: box.x + dx - 20, y: box.y + dy - 20, width: 40, height: 40 }, at: when.at });
  await press(rec);
}

/** Click the field (landing at `at`), clear it, and type visibly. */
export async function type(rec: Recording, target: Locator, label: string, text: string, when: When & { delay?: number } = {}) {
  await click(rec, target, label, when);
  rec.mark("type", label, { box: (await target.boundingBox()) ?? undefined, value: text });
  await target.fill("");
  await target.pressSequentially(text, { delay: when.delay ?? 60 });
}

export async function select(rec: Recording, target: Locator, label: string, value: string, when: When = {}) {
  const box = await boxOf(target);
  await arrive(rec, centre(box), when, 320);
  rec.mark("select", label, { box, value, at: when.at });
  await target.selectOption(value);
}

export async function key(rec: Recording, keyName: string, label: string, when: When = {}) {
  if (when.at !== undefined) await rec.clock.at(when.at, rec.page);
  rec.mark("key", label, { key: keyName, at: when.at });
  await rec.page.keyboard.press(keyName);
}

/** Region the edit may zoom to while the narration talks about it. */
export async function focus(rec: Recording, target: Locator, label: string, when: When = {}) {
  if (when.at !== undefined) await rec.clock.at(when.at, rec.page);
  rec.mark("focus", label, { box: await boxOf(target), at: when.at });
}

/** Park the mouse off the controls while the narration talks. */
export async function rest(page: Page, at = { x: VIEW.width * 0.62, y: VIEW.height * 0.58 }) {
  await glide(page, at, 450);
}

/** Drag from one point to another (real mouse input, which Konva hears), landing the release at `at`. */
export async function drag(
  rec: Recording,
  from: { x: number; y: number },
  to: { x: number; y: number },
  label: string,
  when: When & { hold?: number } = {},
) {
  const ms = when.ms ?? 700;
  if (when.at !== undefined) await rec.clock.at(when.at - ms / 1000 - 0.45, rec.page);
  await glide(rec.page, from, 400);
  rec.mark("drag", label, { box: { x: from.x - 30, y: from.y - 30, width: 60, height: 60 } });
  await rec.page.mouse.down();
  await rec.page.waitForTimeout(when.hold ?? 120);
  await glide(rec.page, to, ms);
  await rec.page.waitForTimeout(80);
  await rec.page.mouse.up();
  rec.mark("drop", label, { box: { x: to.x - 30, y: to.y - 30, width: 60, height: 60 }, at: when.at });
}

/** A finger tap (touch input), landing at `at`. */
export async function tap(rec: Recording, target: Locator | { x: number; y: number }, label: string, when: When = {}) {
  if (when.at !== undefined) await rec.clock.at(when.at, rec.page);
  const box = "x" in target ? { x: target.x - 22, y: target.y - 22, width: 44, height: 44 } : await boxOf(target);
  rec.mark("tap", label, { box, at: when.at });
  await rec.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/** Centre the map on the viewer's own token and return its on-screen centre (CSS px). */
export async function centreOwnToken(page: Page, scale?: number) {
  return page.evaluate((want) => {
    const data = window.__HERO_BYTE_E2E__!;
    const token = data.snapshot!.tokens.find((t) => t.owner === data.uid)!;
    // The canvas, not the board div: on the phone layout the div is wider than the screen.
    const board = document.querySelector('[data-testid="map-board"] canvas')!.getBoundingClientRect();
    const g = data.gridSize;
    const s = want ?? data.cam?.scale ?? 1;
    const wx = (token.x + 0.5) * g;
    const wy = (token.y + 0.5) * g;
    data.setCam!({ x: board.width / 2 - wx * s, y: board.height * 0.45 - wy * s, scale: s });
    return { x: board.left + board.width / 2, y: board.top + board.height * 0.45, cell: g * s };
  }, scale);
}
