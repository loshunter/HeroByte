import { chooseBuildTool } from "./build-palette.helpers";
import { enterDMMode } from "./table-role.helpers";
import type { CDPSession, Locator } from "@playwright/test";
import type { ClientMessage, MapDocument, ServerMessage } from "@herobyte/shared";
import { expect, type Page } from "./fixtures";
import { openTouch, touchDrag, touchPinch, type Pt } from "./mobile/touch.helpers";
import { dock, activate } from "./u2-cancel.helpers";

export function observeGeneration(page: Page) {
  const sent: ClientMessage[] = [],
    received: ServerMessage[] = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => sent.push(JSON.parse(payload.toString())));
    socket.on("framereceived", ({ payload }) => received.push(JSON.parse(payload.toString())));
  });
  return {
    sent,
    received,
    requests: () =>
      sent.filter(
        (m): m is Extract<ClientMessage, { t: "map-studio-generate" }> =>
          m.t === "map-studio-generate",
      ),
    document: () => {
      const frame = [...received].reverse().find((m) => "t" in m && m.t === "map-studio-document");
      if (frame?.t !== "map-studio-document") throw new Error("No document frame");
      return frame.document;
    },
  };
}

export async function joinSecondDM(page: Page, roomUrl: string) {
  await page.goto(roomUrl);
  await page.getByPlaceholder("Table password").fill("U2-local-table-password");
  await page.getByRole("button", { name: /Enter Table/i }).click();
  await expect(page.getByTestId("map-board")).toBeVisible();
  await enterDMMode(page, "U2-local-dm-password");
  await page.getByTitle("Author the live map on the table").click();
  await chooseBuildTool(page, "wall");
  await page.getByRole("button", { name: "🗂 Layers", exact: true }).click();
  return page.getByRole("region", { name: "Layers", exact: true });
}

export function generatePanel(page: Page, mobile: boolean) {
  const panel = page.getByTestId(mobile ? "mobile-generate-panel" : "generate-panel");
  return {
    panel,
    hint: page.getByTestId(mobile ? "mobile-generate-hint" : "generate-hint"),
    seed: page.getByTestId(mobile ? "mobile-generate-seed" : "generate-seed"),
    fire: mobile
      ? page.getByTestId("mobile-generate-fire")
      : panel.getByRole("button", { name: "🎲 Generate in this area", exact: true }),
  };
}

export async function selectGenerate(page: Page, mobile: boolean) {
  if (mobile) {
    await dock(page).getByRole("button", { name: "Tool", exact: true }).tap();
    await chooseBuildTool(page, "generate", true);
  } else await chooseBuildTool(page, "generate");
  const ui = generatePanel(page, mobile);
  await activate(ui.panel.getByRole("button", { name: "🪵 Wood", exact: true }), mobile);
  await activate(ui.panel.getByRole("button", { name: "Low", exact: true }), mobile);
  return ui;
}

const camera = (page: Page) =>
  page.evaluate(() => {
    const cam = window.__HERO_BYTE_E2E__?.cam;
    if (!cam) throw new Error("Camera unavailable");
    return { ...cam };
  });
const painted = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

/** Trusted camera input only. Read state for coordinates; never set camera or send commands. */
export async function aimRegion(
  page: Page,
  mobile: boolean,
  document: MapDocument,
  xCell = 12,
  placeTarget = true,
) {
  let cdp: CDPSession | undefined;
  if (mobile) {
    const sheet = page.getByRole("dialog", { name: "Map tools", exact: true });
    if (await sheet.isVisible()) await sheet.getByRole("button", { name: /To the map/i }).tap();
    cdp = await openTouch(page);
  }
  try {
    const canvas = page.getByTestId("map-board").locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas missing");
    const center = { x: box.x + box.width * (mobile ? 0.5 : 0.61), y: box.y + box.height * 0.47 };
    const targetScale = mobile ? 0.16 : 0.3;
    for (let i = 0; (await camera(page)).scale > targetScale && i < 45; i++) {
      if (cdp)
        await touchPinch(
          cdp,
          [
            { x: center.x - 90, y: center.y },
            { x: center.x + 90, y: center.y },
          ],
          [
            { x: center.x - 60, y: center.y },
            { x: center.x + 60, y: center.y },
          ],
        );
      else {
        await page.mouse.move(center.x, center.y);
        await page.mouse.wheel(0, 120);
      }
      await painted(page);
    }
    const toScreen = async (x: number, y: number) => {
      const cam = await camera(page);
      return { x: box.x + cam.x + x * cam.scale, y: box.y + cam.y + y * cam.scale };
    };
    const { size, offsetX, offsetY } = document.grid;
    const regionCenter = { x: offsetX + (xCell + 12) * size, y: offsetY + 24 * size };
    for (let i = 0; i < 40; i++) {
      const current = await toScreen(regionCenter.x, regionCenter.y);
      const dx = Math.max(-80, Math.min(80, center.x - current.x));
      const dy = Math.max(-80, Math.min(80, center.y - current.y));
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
      if (cdp)
        await touchPinch(
          cdp,
          [
            { x: center.x - 30, y: center.y },
            { x: center.x + 30, y: center.y },
          ],
          [
            { x: center.x - 30 + dx, y: center.y + dy },
            { x: center.x + 30 + dx, y: center.y + dy },
          ],
        );
      else {
        await page.mouse.move(center.x, center.y);
        await page.mouse.down({ button: "middle" });
        await page.mouse.move(center.x + dx, center.y + dy, { steps: 5 });
        await page.mouse.up({ button: "middle" });
      }
      await painted(page);
    }
    // Nearest-intersection snapping changes at half cells. Stay below that boundary
    // with margin for the touch helper's integer CSS-pixel rounding at low zoom.
    const points: [Pt, Pt] = [
      await toScreen(offsetX + (xCell + 0.2) * size, offsetY + 12.2 * size),
      await toScreen(offsetX + (xCell + 23.2) * size, offsetY + 35.2 * size),
    ];
    expect(
      await page.evaluate(
        ([a, b]) =>
          Array.from({ length: 13 }, (_, i) => {
            const t = i / 12;
            return (
              window.document.elementFromPoint(
                a.x + (b.x - a.x) * t,
                a.y + (b.y - a.y) * t,
              ) instanceof HTMLCanvasElement
            );
          }).every(Boolean),
        points,
      ),
      `Aim path must be uncovered canvas: ${JSON.stringify(points)}`,
    ).toBe(true);
    if (placeTarget && cdp) await touchDrag(cdp, points[0], [points[1]], { steps: 12 });
    else if (placeTarget) {
      await page.mouse.move(points[0].x, points[0].y);
      await page.mouse.down();
      await page.mouse.move(points[1].x, points[1].y, { steps: 12 });
      await page.mouse.up();
    }
    await painted(page);
    return { points, camera: await camera(page) };
  } finally {
    await cdp?.detach();
  }
}

export async function showGenerate(page: Page, mobile: boolean): Promise<Locator> {
  if (mobile) await dock(page).getByRole("button", { name: "Tool", exact: true }).tap();
  return generatePanel(page, mobile).panel;
}

/** View the delivered dungeon through the player's actual camera and renderer. */
export async function viewPlayerDungeon(page: Page, document: MapDocument) {
  await page.bringToFront();
  const closeChat = page.getByRole("button", { name: "Close Chat & Rolls", exact: true });
  if (await closeChat.isVisible()) await closeChat.click();
  await aimRegion(page, false, document, 12, false);
  // The asynchronous field worker uses the same 30s completion budget as
  // docs-shots.helpers.waitBake; receipt of terrain is earlier than its bake.
  await expect(page.getByRole("status").filter({ hasText: "Painting terrain" })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("generate-panel")).toHaveCount(0);
  await painted(page);
}
