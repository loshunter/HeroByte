import type { Locator } from "@playwright/test";
import { openCharacterDetails, ownRosterRow, partyInspector } from "./party.helpers";
import type { ClientMessage } from "@herobyte/shared";
import { expect, type Page } from "./fixtures";
import { identity, openChat, readState } from "./chat-journey.helpers";
import {
  activate,
  mouseStroke,
  publicBarrier,
  uncoveredRow,
  type Ledger,
} from "./u2-cancel.helpers";
import { openTouch, touchDrag } from "./mobile/touch.helpers";

export type Panel = "Character" | "Chat" | "World" | "DM";
export type Tool = "Measure" | "Draw";
export const actions = (page: Page) => page.getByRole("navigation", { name: "Mobile actions" });
export const tools = (page: Page) => page.getByRole("dialog", { name: "Map tools", exact: true });
export const drawings = async (page: Page) => {
  const value = (await readState(page)).snapshot.drawings;
  if (!Array.isArray(value)) throw new Error("Drawing snapshot is unavailable");
  return value.sort((a, b) => a.id.localeCompare(b.id));
};
export const drawingCommands = (ledger: Ledger) =>
  ledger.sent.filter(({ t }) =>
    [
      "draw",
      "undo-drawing",
      "redo-drawing",
      "clear-drawings",
      "select-drawing",
      "deselect-drawing",
      "move-drawing",
      "delete-drawing",
      "erase-partial",
      "sync-player-drawings",
    ].includes(t),
  );
export const nameCommands = (ledger: Ledger) =>
  ledger.sent.filter(({ t }) => t === "rename" || t === "update-character-name");
export const savedNames = async (page: Page) => {
  const { snapshot } = await readState(page);
  return {
    players: snapshot.players.map(({ uid, name }) => ({ uid, name })),
    characters: snapshot.characters.map(({ id, name }) => ({ id, name })),
  };
};

export async function closeChat(page: Page, touch: boolean) {
  const close = page.getByRole("button", { name: "Close Chat & Rolls", exact: true });
  await activate(close, touch);
  await expect(close).toHaveCount(0);
}

// The peer performs the barrier, so the subject's focus remains untouched.
// This is a bounded observation, not a cross-socket total-order guarantee.
export async function settledBarrier(subject: Page, peer: Page, touch: boolean, label: string) {
  await openChat(peer, touch);
  await publicBarrier(peer, [subject, peer], label);
  await closeChat(peer, touch);
}

export async function armTool(page: Page, tool: Tool, touch: boolean) {
  if (touch) {
    await actions(page).getByRole("button", { name: "Tools", exact: true }).tap();
    await tools(page).getByRole("button", { name: tool, exact: true }).tap();
    await expect(tools(page)).toHaveCount(0);
  } else {
    await page
      .getByRole("button", { name: tool === "Draw" ? "✏️ Draw" : "📏 Measure", exact: true })
      .click();
  }
  if (tool === "Draw") {
    await activate(
      page.getByRole("button", { name: touch ? "Freehand" : "✏️ Freehand", exact: true }),
      touch,
    );
  }
}

export async function openPanel(page: Page, panel: Panel, touch: boolean) {
  let launcher: Locator;
  let close: Locator;
  if (panel === "Character") {
    if (touch) await actions(page).getByRole("button", { name: "Party", exact: true }).tap();
    // Desktop (U7): the character's card — and its gear — is in the Party
    // inspector, opened from the viewer's own roster row.
    if (!touch) await openCharacterDetails(page, ownRosterRow(page));
    launcher = touch
      ? page.getByRole("button", { name: "⚙️ EDIT", exact: true })
      : partyInspector(page).getByTitle("Open player settings", { exact: true });
    await expect(launcher).toHaveCount(1); // Player context, not the DM's multi-card editor.
    await activate(launcher, touch);
    close = page
      .locator('[data-mobile-surface="settings"]')
      .getByRole("button", { name: /^Close / });
  } else if (panel === "World" && touch) {
    await actions(page).getByRole("button", { name: "Tools", exact: true }).tap();
    launcher = tools(page).getByRole("button", { name: "World", exact: true });
    const originalTile = await launcher.elementHandle();
    expect(originalTile).not.toBeNull();
    await launcher.tap();
    await expect(tools(page)).toHaveCount(0);
    expect(await originalTile!.evaluate((element) => element.isConnected)).toBe(false);
    await originalTile!.dispose();
    close = page.getByRole("button", { name: "Close World Map", exact: true });
  } else {
    const name =
      panel === "Chat"
        ? touch
          ? "Chat"
          : "📜 Chat & Rolls"
        : panel === "DM"
          ? touch
            ? "DM"
            : "🛠️ DM MENU"
          : "🗺 WORLD";
    launcher = touch
      ? actions(page).getByRole("button", { name, exact: true })
      : page.getByRole("button", { name, exact: true });
    await activate(launcher, touch);
    const title =
      panel === "Chat"
        ? "Chat & Rolls"
        : panel === "DM"
          ? touch
            ? "DM Menu"
            : "Dungeon Master Tools"
          : "World Map";
    close = page.getByRole("button", { name: `Close ${title}`, exact: true });
  }
  await expect(close).toBeVisible();
  return { launcher, close };
}

export async function finishPanel(page: Page, panel: Panel, touch: boolean) {
  // Check launcher focus BEFORE closing its parent Party/Tools surface.
  if (touch && panel === "Character") {
    await page.getByRole("button", { name: "Close Party Members", exact: true }).tap();
  } else if (panel === "Character") {
    // The desktop inspector is the gear's parent surface: close it too.
    await partyInspector(page)
      .getByRole("button", { name: /^Close .* details$/ })
      .click();
    await expect(partyInspector(page)).toHaveCount(0);
  } else if (touch && panel === "World") {
    await expect(tools(page)).toBeVisible();
    await tools(page).getByRole("button", { name: "Close tools", exact: true }).tap();
  }
}

export async function expectDrawings(
  pages: Page[],
  expected: Awaited<ReturnType<typeof drawings>>,
) {
  const sorted = [...expected].sort((a, b) => a.id.localeCompare(b.id));
  for (const page of pages) await expect.poll(() => drawings(page)).toEqual(sorted);
}

export async function commitStroke(
  page: Page,
  peer: Page,
  ledger: Ledger,
  touch: boolean,
  row = touch ? 0.22 : 0.45,
) {
  const before = await drawings(page);
  const commandsBefore = drawingCommands(ledger).length;
  const [from, to] = await uncoveredRow(page, row);
  if (touch) {
    const cdp = await openTouch(page);
    try {
      await touchDrag(cdp, from, [to], { steps: 12 });
    } finally {
      await cdp.detach();
    }
  } else await mouseStroke(page, [from, to]);
  await expect.poll(() => drawingCommands(ledger).length).toBe(commandsBefore + 1);
  expect(drawingCommands(ledger).at(-1)!.t).toBe("draw");
  await expect.poll(() => drawings(page)).toHaveLength(before.length + 1);
  const after = await drawings(page);
  const added = after.filter((drawing) => !before.some((old) => old.id === drawing.id));
  expect(added).toHaveLength(1);
  expect(added[0]!.owner).toBe((await identity(page)).uid);
  expect(added[0]!.type).toBe("freehand");
  expect(added[0]!.points.length).toBeGreaterThan(1);
  // A fresh horizontal stroke cannot include a previously cancelled row.
  expect(new Set(added[0]!.points.map(({ y }) => y)).size).toBe(1);
  await expectDrawings([page, peer], [...before, added[0]!]);
  return added[0]!;
}

export async function proveToolRetained(
  page: Page,
  peer: Page,
  ledger: Ledger,
  tool: Tool,
  touch: boolean,
) {
  if (tool === "Draw") {
    await commitStroke(page, peer, ledger, touch);
    return;
  }
  const before = ledger.sent.length;
  const [from, to] = await uncoveredRow(page, 0.4);
  if (touch) {
    await page.touchscreen.tap(from.x, from.y);
    await page.touchscreen.tap(to.x, to.y);
  } else {
    await page.mouse.click(from.x, from.y);
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.click(to.x, to.y);
  }
  type MeasureCommand = Extract<ClientMessage, { t: "measure" }>;
  const published = () =>
    (ledger.sent.slice(before) as ClientMessage[]).filter(
      (message): message is MeasureCommand => message.t === "measure" && message.measure !== null,
    );
  await expect.poll(() => published().length).toBeGreaterThan(0);
  expect(published().at(-1)!.measure!.start).not.toEqual(published().at(-1)!.measure!.end);
  const uid = (await identity(page)).uid;
  await expect
    .poll(async () => {
      const received = await peer.evaluate((author) => {
        const line = window.__HERO_BYTE_E2E__?.remoteMeasurements?.find(
          (entry) => entry.uid === author,
        );
        return line?.start && line.end ? { start: line.start, end: line.end } : null;
      }, uid);
      // Re-read the latest sent endpoint while polling: mouse rubber-band frames
      // may precede the final click, and asserting a captured interim frame races it.
      return JSON.stringify(received) === JSON.stringify(published().at(-1)!.measure);
    })
    .toBe(true);
}
