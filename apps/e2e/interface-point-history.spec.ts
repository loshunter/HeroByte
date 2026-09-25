// Committed point actions use map history; cancellation only discards unsent work.
import type { ClientMessage, MapElement, ServerMessage } from "@herobyte/shared";
import { expect, test, type Page } from "./fixtures";
import { chooseBuildTool } from "./build-palette.helpers";
import {
  armGrass,
  createAndJoin,
  mapCommands,
  mapContent,
  mapLauncher,
  observeWire,
  publicBarrier,
  uncoveredRow,
  type Ledger,
} from "./u2-cancel.helpers";

type MapCommand = Extract<ClientMessage, { t: "map-studio-command" }>["command"];
const drawingHistory = (ledger: Ledger) =>
  ledger.sent.filter(({ t }) => t === "undo-drawing" || t === "redo-drawing");
const visibleElements = async (page: Page) =>
  (await mapContent(page)).elements?.layers.flatMap((layer) => layer.elements) ?? [];

async function expectPublished(pages: Page[], elements: MapElement[]) {
  const scenery = elements
    .filter((element) => element.type !== "light")
    .map(({ id, type, transform, data }) => ({ id, type, transform, data }));
  const lights = elements
    .filter((element) => element.type === "light")
    .map(({ id, transform, data }) => ({
      id,
      x: transform.x,
      y: transform.y,
      radius: data.radius,
      color: data.color,
      intensity: data.intensity,
    }));
  for (const page of pages) {
    await expect.poll(() => visibleElements(page)).toEqual(scenery);
    await expect
      .poll(async () => (await mapContent(page)).elements?.lighting?.lights ?? [])
      .toEqual(lights);
  }
}

async function acknowledged(ledger: Ledger, command: MapCommand) {
  expect(command.commandId).toBeTruthy();
  await expect
    .poll(() =>
      ledger.received.filter(
        (message) =>
          message.t === "map-studio-document" && message.appliedCommandId === command.commandId,
      ),
    )
    .toHaveLength(1);
  const reply = ledger.received.find(
    (message) =>
      message.t === "map-studio-document" && message.appliedCommandId === command.commandId,
  ) as Extract<ServerMessage, { t: "map-studio-document" }>;
  expect(reply.document.id).toBe(command.documentId);
  return reply.document;
}

for (const tool of ["Place", "Scatter", "Light"] as const) {
  test(`U2 desktop ${tool} commits on press; Escape cannot retract it; map Undo removes it`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(150_000);
    const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const peerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage();
    const peer = await peerContext.newPage();
    const dmWire = observeWire(dm);
    const peerWire = observeWire(peer);
    const pages = [dm, peer];
    try {
      // Private table creation, peer password join, and DM elevation are real UI journeys.
      await createAndJoin(dm, peer, false, `U2 desktop ${tool} history`);
      await armGrass(dm, false, true);
      const initial = await mapContent(dm);
      expect(initial.live).toBeTruthy();
      // The room model omits DM-only live-document chrome from player snapshots.
      expect((await mapContent(peer)).live).toBeUndefined();
      // These two fields are already player-safe at derive/publish and shared by
      // every role; raw authored layers and per-role compiledScene are not compared.
      await expect
        .poll(async () => {
          const { terrain, elements } = await mapContent(peer);
          return { terrain, elements };
        })
        .toEqual({ terrain: initial.terrain, elements: initial.elements });
      const before = await Promise.all(pages.map(mapContent));
      expect(await visibleElements(dm)).toEqual([]);
      expect(await visibleElements(peer)).toEqual([]);

      // Explicitly choose the point tool and its asset through the desktop palette.
      const tools = { Place: "place", Scatter: "scatter", Light: "light" } as const;
      await chooseBuildTool(dm, tools[tool]);
      if (tool !== "Light") {
        await dm.getByRole("button", { name: "▸ Crate", exact: true }).click();
        const crate = dm.getByRole("listbox", { name: "Assets", exact: true }).getByTitle("Crate", {
          exact: true,
        });
        await crate.click();
        await expect(crate).toHaveAttribute("aria-selected", "true");
        await dm.getByRole("button", { name: "▾ Crate", exact: true }).click();
      }
      if (tool === "Place")
        await expect(dm.getByRole("button", { name: "▦ Grid tile", exact: true })).toBeVisible();
      const cancel = dm.getByRole("button", { name: "Cancel placement", exact: true });
      await expect(cancel).toBeDisabled();
      const sent = mapCommands(dmWire).length;
      expect(drawingHistory(dmWire)).toEqual([]);
      expect(drawingHistory(peerWire)).toEqual([]);

      const [point] = await uncoveredRow(dm, 0.55);
      await dm.mouse.move(point.x, point.y);
      await dm.mouse.down();
      // Deliberately no mouseup: a desktop point action has already been submitted.
      await expect(cancel).toBeDisabled();
      await expect.poll(() => mapCommands(dmWire).length).toBe(sent + 1);
      const placement = mapCommands(dmWire)[sent]!.command as MapCommand;
      expect(placement.type).toBe(tool === "Scatter" ? "add-elements" : "add-element");
      if (placement.type !== "add-element" && placement.type !== "add-elements")
        throw new Error("Missing point command");
      expect(placement.documentId).toBe(initial.live);
      const placed = placement.type === "add-element" ? [placement.element] : placement.elements;
      expect(placed).toHaveLength(tool === "Scatter" ? 7 : 1);
      for (const element of placed) {
        expect(element.type).toBe(
          tool === "Light" ? "light" : tool === "Scatter" ? "stamp" : "tile",
        );
        expect(element.data).toMatchObject(
          tool === "Light" ? { color: "#ffc06a", intensity: 1 } : { assetId: "objects:crate" },
        );
      }
      expect((await acknowledged(dmWire, placement)).elements).toEqual(placed);
      await expectPublished(pages, placed);
      await expect(dm.getByText(/^[Ss]aving…$/)).toHaveCount(0);
      await expect(cancel).toBeDisabled();
      await info.attach("point-applied-while-mouse-held.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      // With nothing unsent, Escape is allowed to leave Map Edit for Move.
      // It cannot cancel the command that has already been acknowledged.
      await dm.keyboard.press("Escape");
      await expect(dm.getByRole("button", { name: "✥ Move", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await publicBarrier(peer, pages, "point-Escape-before-release");
      expect(mapCommands(dmWire)).toHaveLength(sent + 1);
      await expectPublished(pages, placed);

      await dm.mouse.up();
      // Bounded post-release observation; the peer chat is not a cross-socket ordering proof.
      await publicBarrier(peer, pages, "point-residual-mouseup");
      expect(mapCommands(dmWire)).toHaveLength(sent + 1);
      await expectPublished(pages, placed);
      // Public pools above contain only published fields; authored document and
      // compiled-light metadata must remain absent from the player connection.
      expect(peerWire.received.filter(({ t }) => t === "map-studio-document")).toEqual([]);
      expect((await mapContent(peer)).scene?.lights ?? []).toEqual([]);
      await info.attach("peer-point-survives-Escape-and-release.png", {
        body: await peer.screenshot(),
        contentType: "image/png",
      });

      await mapLauncher(dm).click();
      await expect(mapLauncher(dm)).toHaveAttribute("aria-pressed", "true");
      const undo = dm.getByTitle("Undo map edit", { exact: true });
      await expect(undo).toBeEnabled();
      await undo.click();
      await expect.poll(() => mapCommands(dmWire).length).toBe(sent + 2);
      const undoCommand = mapCommands(dmWire)[sent + 1]!.command as MapCommand;
      expect(undoCommand.type).toBe("undo");
      expect(undoCommand.documentId).toBe(initial.live);
      expect(undoCommand.commandId).not.toBe(placement.commandId);
      expect((await acknowledged(dmWire, undoCommand)).elements).toEqual([]);
      await expectPublished(pages, []);
      await expect(dm.getByText(/^[Ss]aving…$/)).toHaveCount(0);
      await publicBarrier(peer, pages, "point-map-undo-applied");

      expect(
        mapCommands(dmWire)
          .slice(sent)
          .map((message) => message.command?.type),
      ).toEqual([tool === "Scatter" ? "add-elements" : "add-element", "undo"]);
      expect(mapCommands(peerWire)).toEqual([]);
      expect(drawingHistory(dmWire)).toEqual([]);
      expect(drawingHistory(peerWire)).toEqual([]);
      expect((await mapContent(peer)).live).toBeUndefined();
      for (const [index, page] of pages.entries()) {
        const after = await mapContent(page);
        expect(after.live).toBe(before[index]!.live);
        expect(after.drawings).toEqual(before[index]!.drawings);
        expect(after.terrain).toEqual(before[index]!.terrain);
        expect(after.elements).toEqual(before[index]!.elements);
      }
      await info.attach("peer-point-removed-by-map-undo.png", {
        body: await peer.screenshot(),
        contentType: "image/png",
      });
    } finally {
      await dmContext.close();
      await peerContext.close();
    }
  });
}
