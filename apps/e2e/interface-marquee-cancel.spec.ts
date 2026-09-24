import type { ClientMessage, SelectionStateEntry } from "@herobyte/shared";
import { expect, test, type Page } from "./fixtures";
import { identity, readState } from "./chat-journey.helpers";
import {
  createAndJoin,
  mapCommands,
  mapContent,
  mouseStroke,
  observeWire,
  uncoveredRow,
  type Ledger,
} from "./u2-cancel.helpers";
import {
  armTool,
  closeChat,
  commitStroke,
  drawingCommands,
  expectDrawings,
  settledBarrier,
} from "./u2-window-annotation.helpers";
import type { Pt } from "./mobile/touch.helpers";

type SelectionCommand = Extract<
  ClientMessage,
  { t: "select-object" | "select-multiple" | "deselect-object" }
>;
const selectionCommands = (ledger: Ledger) =>
  (ledger.sent as ClientMessage[]).filter(
    (message): message is SelectionCommand =>
      message.t === "select-object" ||
      message.t === "select-multiple" ||
      message.t === "deselect-object",
  );
const selectedIds = (selection: SelectionStateEntry | null | undefined) =>
  !selection ? [] : selection.mode === "single" ? [selection.objectId] : selection.objectIds;
const selectionFor = async (page: Page, uid: string) =>
  (await readState(page)).snapshot.selectionState?.[uid] ?? null;
const interactionState = async (page: Page) => {
  const { snapshot } = await readState(page);
  return {
    content: await mapContent(page),
    selection: snapshot.selectionState ?? {},
    tokens: snapshot.tokens,
    props: snapshot.props,
    sceneObjects: snapshot.sceneObjects,
  };
};

test("U2 desktop: held marquee Escape preserves Select, ignores release, then selects normally", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const playerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
  });
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();
  const playerWire = observeWire(player);
  const dmWire = observeWire(dm);
  try {
    await createAndJoin(dm, player, false, "U2 held marquee cancellation");
    await closeChat(player, false);
    const uid = (await identity(player)).uid;

    // A real authored object proves the sender ledger and peer snapshot are live.
    await armTool(player, "Draw", false);
    const row = await uncoveredRow(player, 0.45);
    const mark = await commitStroke(player, dm, playerWire, false, 0.45);
    const drawingId = `drawing:${mark.id}`;
    const select = player.getByRole("button", { name: "🖱️ Select", exact: true });
    const move = player.getByRole("button", { name: "✥ Move", exact: true });
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    expect(selectedIds(await selectionFor(player, uid))).not.toContain(drawingId);
    // Changing tools must not move the canvas or the target under the pointer.
    expect(await uncoveredRow(player, 0.45)).toEqual(row);
    const corners: [Pt, Pt] = [
      { x: row[0].x - 32, y: row[0].y - 32 },
      { x: row[1].x + 32, y: row[1].y + 32 },
    ];
    expect(
      await player.evaluate(
        (points) =>
          points.every(({ x, y }) => document.elementFromPoint(x, y) instanceof HTMLCanvasElement),
        corners,
      ),
      "marquee corners must be unobstructed canvas",
    ).toBe(true);
    const canvases = player.getByTestId("map-board").locator("canvas");
    const idleLayerCount = await canvases.count();
    const pages = [player, dm];
    const before = await Promise.all(pages.map(interactionState));
    const selectionsBefore = selectionCommands(playerWire).length;
    const drawingsBefore = drawingCommands(playerWire).length;
    const mapsBefore = mapCommands(playerWire).length;
    const peerSelectionsBefore = selectionCommands(dmWire).length;

    await mouseStroke(player, corners, false);
    // MarqueeOverlay mounts its own canvas layer only while a live rectangle exists.
    await expect(canvases).toHaveCount(idleLayerCount + 1);
    expect(selectionCommands(playerWire)).toHaveLength(selectionsBefore);
    await info.attach("held-marquee-before-Escape.png", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
    await player.keyboard.press("Escape");
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(move).toHaveAttribute("aria-pressed", "false");
    await expect(canvases).toHaveCount(idleLayerCount);
    await player.mouse.move(corners[1].x - 12, corners[1].y - 12, { steps: 6 });
    await player.mouse.up();
    await player.mouse.move(corners[0].x, corners[0].y, { steps: 6 });
    await expect(canvases).toHaveCount(idleLayerCount);
    await settledBarrier(player, dm, false, "held-marquee-Escape-residual-release");

    expect(selectionCommands(playerWire)).toHaveLength(selectionsBefore);
    expect(drawingCommands(playerWire)).toHaveLength(drawingsBefore);
    expect(mapCommands(playerWire)).toHaveLength(mapsBefore);
    expect(selectionCommands(dmWire)).toHaveLength(peerSelectionsBefore);
    for (const [index, page] of pages.entries()) {
      expect(await interactionState(page)).toEqual(before[index]);
    }
    await expect(select).toHaveAttribute("aria-pressed", "true");

    // No tool reactivation: the very same rectangle must now select the real drawing.
    await mouseStroke(player, corners);
    await expect(canvases).toHaveCount(idleLayerCount);
    await expect.poll(() => selectionCommands(playerWire).length).toBe(selectionsBefore + 1);
    const selected = selectionCommands(playerWire).at(-1)!;
    expect(selected.uid).toBe(uid);
    expect(
      selected.t === "select-object"
        ? [selected.objectId]
        : selected.t === "select-multiple"
          ? selected.objectIds
          : [],
    ).toContain(drawingId);
    for (const page of pages) {
      await expect
        .poll(async () => selectedIds(await selectionFor(page, uid)))
        .toContain(drawingId);
    }
    const committedSelection = await selectionFor(player, uid);
    expect(await selectionFor(dm, uid)).toEqual(committedSelection);
    await expectDrawings(pages, [mark]);
    expect(drawingCommands(playerWire)).toHaveLength(drawingsBefore);

    // The second Escape has no pending gesture and leaves Select for Move only.
    await player.keyboard.press("Escape");
    await expect(move).toHaveAttribute("aria-pressed", "true");
    await expect(select).toHaveAttribute("aria-pressed", "false");
    await settledBarrier(player, dm, false, "marquee-second-Escape-Move");
    expect(selectionCommands(playerWire)).toHaveLength(selectionsBefore + 1);
    for (const page of pages) expect(await selectionFor(page, uid)).toEqual(committedSelection);
    await expectDrawings(pages, [mark]);
    expect(mapCommands(playerWire)).toHaveLength(mapsBefore);
    await info.attach("fresh-marquee-selection-after-cancel.png", {
      body: await player.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
