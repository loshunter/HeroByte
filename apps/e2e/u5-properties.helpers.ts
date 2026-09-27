import type { ClientMessage, MapDocument, ServerMessage } from "@herobyte/shared";
import type { Locator, TestInfo } from "@playwright/test";
import { expect, type Page } from "./fixtures";
import { chooseBuildTool } from "./build-palette.helpers";
import { activate, mapContent, mouseStroke } from "./u2-cancel.helpers";
import { openBuildTools, closeBuildTools } from "./u3b-palette.helpers";
import { canvasHit } from "./u4b-terrain.helpers";
import { openTouch, touchDrag } from "./mobile/touch.helpers";

type CommandMessage = Extract<ClientMessage, { t: "map-studio-command" }>;
export async function propertyWire(page: Page) {
  const sent: CommandMessage[] = [],
    incoming: ServerMessage[] = [];
  const held: (() => void)[] = [];
  let holdDoor = false;
  await page.routeWebSocket(
    (url) => url.protocol === "ws:" && url.port === (process.env.E2E_WS_PORT ?? "8788"),
    (route) => {
      const server = route.connectToServer();
      route.onMessage((raw) => {
        const frame = JSON.parse(raw.toString()) as ClientMessage;
        if (frame.t === "map-studio-command") sent.push(frame);
        server.send(raw);
      });
      server.onMessage((raw) => {
        const frame = JSON.parse(raw.toString()) as ServerMessage;
        incoming.push(frame);
        if (
          holdDoor &&
          "t" in frame &&
          frame.t === "map-studio-document" &&
          sent.some(
            ({ command }) =>
              command.type === "update-door" &&
              command.commandId === frame.appliedCommandId &&
              command.documentId === frame.document.id,
          )
        ) {
          held.push(() => route.send(raw));
        } else route.send(raw);
      });
    },
  );
  const receipt = (command: CommandMessage["command"]) =>
    incoming.find(
      (frame) =>
        "t" in frame &&
        frame.t === "map-studio-document" &&
        frame.document.id === command.documentId &&
        frame.appliedCommandId === command.commandId,
    );
  return {
    sent,
    incoming,
    hold: () => {
      holdDoor = true;
    },
    held: () => held.length,
    release: () => {
      holdDoor = false;
      for (const deliver of held.splice(0)) deliver();
    },
    document: (): MapDocument => {
      const frame = [...incoming]
        .reverse()
        .find((entry) => "t" in entry && entry.t === "map-studio-document");
      if (!frame || frame.t !== "map-studio-document") throw new Error("No authoritative document");
      return frame.document;
    },
    applied: async (command: CommandMessage["command"]) => {
      await expect.poll(() => receipt(command)).toBeDefined();
      const frame = receipt(command);
      if (!frame || !("t" in frame) || frame.t !== "map-studio-document")
        throw new Error("Missing matching property receipt");
      return frame.document;
    },
  };
}
export type PropertyWire = Awaited<ReturnType<typeof propertyWire>>;
export async function paintPropertyFloor(page: Page, phone: boolean, wire: PropertyWire) {
  const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
  const from = { x: box.x + box.width * 0.55, y: box.y + box.height * 0.3 };
  const to = { x: box.x + box.width * 0.72, y: from.y };
  await canvasHit(page, from, to);
  const before = wire.sent.length;
  if (phone) {
    const touch = await openTouch(page);
    await touchDrag(touch, from, [to]);
    await touch.detach();
  } else await mouseStroke(page, [from, to]);
  await expect.poll(() => wire.sent.length).toBeGreaterThan(before);
  const painted = await wire.applied(wire.sent[before]!.command);
  expect(painted.terrain).toBeTruthy();
  return painted;
}
export async function publicRevision(pages: Page[], doc: MapDocument) {
  await expect(async () => {
    for (const page of pages)
      expect((await mapContent(page)).scene).toMatchObject({
        sourceDocumentId: doc.id,
        sourceRevision: doc.revision,
      });
  }).toPass({ timeout: 10_000 });
}

export async function placePropertyDoor(page: Page, phone: boolean, wire: PropertyWire) {
  await openBuildTools(page, phone);
  await chooseBuildTool(page, "door", phone);
  const box = (await page.getByTestId("map-board").locator("canvas").first().boundingBox())!;
  const from = { x: box.x + box.width * (phone ? 0.35 : 0.6), y: box.y + box.height * 0.4 };
  const to = { x: from.x + box.width * 0.12, y: from.y };
  await canvasHit(page, from, to);
  const count = wire.sent.length;
  if (phone) {
    const touch = await openTouch(page);
    await touchDrag(touch, from, [to]);
    await touch.detach();
  } else await mouseStroke(page, [from, to]);
  await expect.poll(() => wire.sent.length).toBeGreaterThan(count);
  const document = await wire.applied(wire.sent[count]!.command);
  const door = document.elements.find((element) => element.type === "door");
  if (!door || door.type !== "door") throw new Error("Door gesture did not author a door");
  await openBuildTools(page, phone);
  await chooseBuildTool(page, "select", phone);
  await closeBuildTools(page, phone);
  const point = await page.evaluate(({ x, y }) => {
    const cam = window.__HERO_BYTE_E2E__?.cam;
    const box = window.document
      .querySelector('[data-testid="map-board"] canvas')!
      .getBoundingClientRect();
    if (!cam) throw new Error("Camera unavailable");
    return { x: box.x + cam.x + x * cam.scale, y: box.y + cam.y + y * cam.scale };
  }, door.transform);
  await canvasHit(page, point);
  if (phone) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await openBuildTools(page, phone);
  if (phone) {
    await expect(page.getByTestId("mobile-inspector")).toBeHidden();
    await page.getByTestId("mobile-inspector-toggle").tap();
  } else await page.getByRole("button", { name: "🔍 Inspect", exact: true }).click();
  await expect(page.getByRole("group", { name: "Selected properties", exact: true })).toBeVisible();
  return { door, document };
}

/** Native fields have no text nodes; measure labels separately from clipped hit areas. */
export async function propertyFieldReach(controls: Locator[], info: TestInfo, label: string) {
  const report = [];
  for (const control of controls) {
    const label = control.locator("xpath=ancestor-or-self::label[1]");
    if ((await label.count()) && (await control.getAttribute("type")) !== "range")
      await label.scrollIntoViewIfNeeded();
    else await control.scrollIntoViewIfNeeded();
    const row = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      let left = Math.max(0, rect.left),
        top = Math.max(0, rect.top),
        right = Math.min(innerWidth, rect.right),
        bottom = Math.min(innerHeight, rect.bottom);
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent),
          clip = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
        }
      }
      return {
        name: element.getAttribute("aria-label") ?? element.textContent?.trim(),
        rawHeight: rect.height,
        width: right - left,
        height: bottom - top,
        hit: element.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2)),
      };
    });
    expect(row.width, JSON.stringify(row)).toBeGreaterThanOrEqual(44);
    expect(row.height, JSON.stringify(row)).toBeGreaterThanOrEqual(44);
    expect(row.hit, JSON.stringify(row)).toBe(true);
    report.push(row);
  }
  await info.attach(label, { body: JSON.stringify(report), contentType: "application/json" });
}

export async function toggleProperties(page: Page, phone: boolean) {
  await activate(
    phone
      ? page.getByTestId("mobile-inspector-toggle")
      : page.getByRole("button", { name: "🔍 Inspect", exact: true }),
    phone,
  );
}

/** Real pointer movement must not submit intermediate layer edits. */
export async function dragAmbientLight(page: Page, phone: boolean, commandCount: () => number) {
  const slider = page.getByRole("slider", { name: "Ambient light", exact: true });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  // The house range has a 20px thumb and a 2px border on each side.
  const at = (value: number) => ({
    x: box.x + 12 + (box.width - 24) * value,
    y: box.y + box.height / 2,
  });
  const start = at(1),
    before = commandCount();
  const cdp = phone ? await openTouch(page) : null;
  let touchActive = false;
  try {
    if (cdp) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...start, id: 0 }],
      });
      touchActive = true;
    } else {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
    }
    for (const value of [0.75, 0.5, 0.2]) {
      const point = at(value);
      if (cdp)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...point, id: 0 }],
        });
      else await page.mouse.move(point.x, point.y, { steps: 4 });
      await expect(slider).toHaveValue(String(value));
      await expect(slider).toBeEnabled();
      expect(commandCount()).toBe(before);
    }
    if (cdp) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      touchActive = false;
    } else await page.mouse.up();
  } finally {
    if (cdp) {
      try {
        if (touchActive)
          await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      } finally {
        await cdp.detach();
      }
    } else await page.mouse.up();
  }
}
