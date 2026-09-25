import { chooseBuildTool } from "./build-palette.helpers";
import type { Locator } from "@playwright/test";
import { expect, type Page } from "./fixtures";
import { composer, identity, openChat, readState, sendDraft } from "./chat-journey.helpers";
import type { Pt } from "./mobile/touch.helpers";

type Wire = {
  t: string;
  command?: {
    type: string;
    commandId: string;
    documentId: string;
    cells?: { x: number; y: number; assetId: string | null }[];
  };
  appliedCommandId?: string;
};
export type Ledger = { sent: Wire[]; received: Wire[] };
export const dock = (page: Page) => page.getByRole("navigation", { name: "Map edit actions" });
export const mapLauncher = (page: Page) => page.getByTitle("Author the live map on the table");
// INTENDED U2 selector, absent at the inventoried baseline. Do not fall back to Abort.
export const cancelStroke = (page: Page) =>
  page.getByRole("button", { name: "Cancel stroke", exact: true });
export const mapCommands = (ledger: Ledger) =>
  ledger.sent.filter((m) => m.t === "map-studio-command");

export function observeWire(page: Page): Ledger {
  const ledger: Ledger = { sent: [], received: [] };
  // Attach before navigation. Node listeners only; never replace WebSocket.send.
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => ledger.sent.push(JSON.parse(payload.toString())));
    socket.on("framereceived", ({ payload }) =>
      ledger.received.push(JSON.parse(payload.toString())),
    );
  });
  return ledger;
}

export async function activate(control: Locator, touch: boolean) {
  if (touch) await control.tap();
  else await control.click();
}

async function joined(page: Page) {
  await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible();
  await page.waitForFunction(
    () => Boolean(window.__HERO_BYTE_E2E__?.uid && window.__HERO_BYTE_E2E__?.snapshot),
    undefined,
    { timeout: 20_000 },
  );
  await expect.poll(async () => (await identity(page)).uid).toBeTruthy();
}

export async function createAndJoin(dm: Page, observer: Page, touch: boolean, label: string) {
  const password = "U2-local-table-password";
  const dmPassword = "U2-local-dm-password";
  await dm.goto("/");
  await activate(dm.getByRole("button", { name: /New Table/i }), touch);
  await dm.getByLabel("New table name", { exact: true }).fill(label);
  await dm.getByLabel("New table password", { exact: true }).fill(password);
  await dm.getByLabel("New DM password", { exact: true }).fill(dmPassword);
  await activate(dm.getByRole("button", { name: "Create private table", exact: true }), touch);
  await joined(dm);
  const roomUrl = dm.url();
  expect(new URL(roomUrl).searchParams.get("room")).toBeTruthy();
  if (touch) {
    const actions = dm.getByRole("navigation", { name: "Mobile actions" });
    await actions.getByRole("button", { name: "Party", exact: true }).tap();
    await dm.getByRole("button", { name: "⚙️ EDIT", exact: true }).tap();
  } else {
    await dm.getByTitle("Open player settings").click();
  }
  const settings = dm.locator('[data-mobile-surface="settings"]');
  await activate(settings.getByRole("button", { name: "DM Mode: OFF", exact: true }), touch);
  await dm.getByLabel("Enter DM Password:", { exact: true }).fill(dmPassword);
  await activate(dm.getByRole("button", { name: "Elevate to DM", exact: true }), touch);
  await expect.poll(async () => (await identity(dm)).isDM).toBe(true);
  const closeSettings = settings.getByRole("button", { name: /^Close / });
  if (await closeSettings.isVisible()) await activate(closeSettings, touch);
  await expect(settings).toHaveCount(0);
  if (touch) await dm.getByRole("button", { name: "Close Party Members", exact: true }).tap();

  // The observer stays a player in a separate browser context.
  await observer.goto(roomUrl);
  await observer.getByPlaceholder("Table password").fill(password);
  await observer.getByRole("button", { name: /Enter Table/i }).click();
  await joined(observer);
  expect((await identity(observer)).isDM).toBe(false);
  expect((await identity(observer)).uid).not.toBe((await identity(dm)).uid);
  for (const page of [dm, observer]) {
    await expect.poll(async () => (await readState(page)).snapshot.players.length).toBe(2);
  }
  await openChat(observer);
}

export async function armGrass(page: Page, touch: boolean, create: boolean) {
  if (touch) {
    await page
      .getByRole("navigation", { name: "Mobile actions" })
      .getByRole("button", { name: "DM", exact: true })
      .tap();
    await page.getByRole("button", { name: /Edit the live map/i }).tap();
    await dock(page).getByRole("button", { name: "Tool", exact: true }).tap();
  } else {
    await mapLauncher(page).click();
  }
  if (create) {
    await activate(page.getByRole("button", { name: /START LIVE MAP/i }), touch);
    await expect.poll(async () => (await readState(page)).snapshot.liveMapDocumentId).toBeTruthy();
  }
  if (touch) {
    const tools = page.getByRole("dialog", { name: "Map tools", exact: true });
    await chooseBuildTool(tools, "terrain", true);
    await tools.getByRole("button", { name: "Ground", exact: true }).tap();
    await tools.getByRole("button", { name: "Grass", exact: true }).tap();
    await expect(tools.getByRole("button", { name: "Paint terrain", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(tools.getByRole("button", { name: "Grass", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await tools.getByRole("button", { name: /To the map/i }).tap();
    await expect(tools).toBeHidden();
  } else {
    await chooseBuildTool(page, "terrain");
    // The deck has no recents on first entry; later it can show Grass twice.
    await page.getByTitle("Grass", { exact: true }).first().click();
    await expect(mapLauncher(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Brush: Grass", { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/^[Ss]aving…$/)).toHaveCount(0);
}

export const mapContent = (page: Page) =>
  page.evaluate(() => {
    const s = window.__HERO_BYTE_E2E__?.snapshot;
    if (!s) throw new Error("Joined snapshot missing");
    // Chat/roster/version fields intentionally excluded: the public barrier changes them.
    return {
      live: s.liveMapDocumentId,
      terrain: s.mapTerrain,
      elements: s.mapElements,
      scene: s.compiledScene,
      drawings: s.drawings,
    };
  });

export async function publicBarrier(observer: Page, pages: Page[], label: string) {
  const text = `U2 cancellation barrier: ${label}`;
  await composer(observer).fill(text);
  await sendDraft(observer);
  const uid = (await identity(observer)).uid;
  for (const page of pages) {
    await expect
      .poll(async () =>
        (await readState(page)).snapshot.chatLog.filter(
          (m) => m.text === text && m.authorUid === uid && m.to === undefined,
        ),
      )
      .toHaveLength(1);
  }
}

export async function expectUnchanged(
  pages: Page[],
  before: Awaited<ReturnType<typeof mapContent>>[],
  ledger: Ledger,
  sentCount: number,
) {
  expect(mapCommands(ledger)).toHaveLength(sentCount);
  for (let i = 0; i < pages.length; i += 1) expect(await mapContent(pages[i]!)).toEqual(before[i]);
}

export async function expectPaintCommitted(
  dm: Page,
  observer: Page,
  ledger: Ledger,
  sentCount: number,
  previous: Awaited<ReturnType<typeof mapContent>>,
) {
  await expect.poll(() => mapCommands(ledger).length).toBe(sentCount + 1);
  const command = mapCommands(ledger)[sentCount]!.command!;
  expect(command.type).toBe("paint-terrain");
  expect(command.documentId).toBe(previous.live);
  expect(command.cells?.length).toBeGreaterThan(0);
  expect(command.cells?.every((cell) => cell.assetId === "terrain:grass")).toBe(true);
  // Fresh default size is one cell; each trusted path is horizontal. Old cancelled
  // rows leaking into a later successful stroke must not hide inside that one command.
  expect(new Set(command.cells?.map((cell) => cell.y)).size).toBe(1);
  await expect
    .poll(() =>
      ledger.received.filter(
        (m) => m.t === "map-studio-document" && m.appliedCommandId === command.commandId,
      ),
    )
    .toHaveLength(1);
  await expect.poll(async () => (await mapContent(dm)).terrain).not.toEqual(previous.terrain);
  await expect
    .poll(async () => (await mapContent(observer)).terrain)
    .toEqual((await mapContent(dm)).terrain);
  await expect(dm.getByText(/^[Ss]aving…$/)).toHaveCount(0);
}

export async function uncoveredRow(page: Page, fraction: number): Promise<[Pt, Pt]> {
  const canvas = page.getByTestId("map-board").locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const points: [Pt, Pt] = [0.42, 0.75].map((x) => ({
    x: box!.x + box!.width * x,
    y: box!.y + box!.height * fraction,
  })) as [Pt, Pt];
  const sample = await page.evaluate(
    ([from, to]) =>
      Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        return (
          document.elementFromPoint(from.x + (to.x - from.x) * t, from.y) instanceof
          HTMLCanvasElement
        );
      }),
    points,
  );
  expect(sample.every(Boolean), "stroke path must be uncovered canvas, not palette or roster").toBe(
    true,
  );
  return points;
}

export async function mouseStroke(page: Page, [from, to]: [Pt, Pt], release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  if (release) await page.mouse.up();
}

export async function retainedGrass(page: Page, touch: boolean) {
  if (touch) {
    await expect(dock(page)).toBeVisible();
    await dock(page).getByRole("button", { name: "Tool", exact: true }).tap();
    const tools = page.getByRole("dialog", { name: "Map tools", exact: true });
    await expect(tools.getByRole("button", { name: "Paint terrain", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(tools.getByRole("button", { name: "Grass", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await tools.getByRole("button", { name: "Close tools", exact: true }).tap();
  } else {
    await expect(mapLauncher(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Brush: Grass", { exact: true })).toBeVisible();
  }
}
