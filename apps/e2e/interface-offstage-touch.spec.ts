import { chooseBuildTool } from "./build-palette.helpers";
// A second finger on inert chrome must cancel without needing a stage move.
import type { CDPSession } from "@playwright/test";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";
import { expect, test, type Page } from "./fixtures";
import { openTouch, touchDrag, type Pt } from "./mobile/touch.helpers";
import {
  armGrass,
  createAndJoin,
  dock,
  expectPaintCommitted,
  expectUnchanged,
  mapCommands,
  mapContent,
  observeWire,
  publicBarrier,
  uncoveredRow,
  type Ledger,
} from "./u2-cancel.helpers";
import { beginHeldStroke } from "./u2-cancel-touch.helpers";

type Tool = "Grass" | "Place";
type Command = Extract<ClientMessage, { t: "map-studio-command" }>["command"];
type Finger = Pt & { id: number };

async function touch(cdp: CDPSession, type: "touchStart" | "touchEnd", fingers: Finger[]) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: fingers.map(({ x, y, id }) => ({ x: Math.round(x), y: Math.round(y), id })),
  });
}

async function inertDockPoint(page: Page): Promise<Pt> {
  const box = await dock(page).boundingBox();
  if (!box) throw new Error("Dock missing");
  // Inside its border/padding, away from all five controls. Do not manufacture
  // an overlay or invoke a cancel control: the real inert page target matters.
  const point = { x: Math.round(box.x + 5), y: Math.round(box.y + 5) };
  expect(
    await dock(page).evaluate((nav, p) => {
      const hit = document.elementFromPoint(p.x, p.y);
      return hit === nav && !hit.closest(".konvajs-content, button, input");
    }, point),
    "second finger must hit inert nav padding outside the canvas DOM",
  ).toBe(true);
  return point;
}

async function expectPlacement(
  dm: Page,
  peer: Page,
  ledger: Ledger,
  sent: number,
  previous: Awaited<ReturnType<typeof mapContent>>,
) {
  await expect.poll(() => mapCommands(ledger).length).toBe(sent + 1);
  const command = mapCommands(ledger)[sent]!.command as Command;
  expect(command.type).toBe("add-element");
  expect(command.documentId).toBe(previous.live);
  if (command.type !== "add-element") throw new Error("Expected one placement");
  expect(command.element).toMatchObject({ type: "tile", data: { assetId: "objects:crate" } });
  await expect
    .poll(() =>
      ledger.received.filter(
        (m) => m.t === "map-studio-document" && m.appliedCommandId === command.commandId,
      ),
    )
    .toHaveLength(1);
  const reply = ledger.received.find(
    (m) => m.t === "map-studio-document" && m.appliedCommandId === command.commandId,
  ) as Extract<ServerMessage, { t: "map-studio-document" }>;
  expect(reply.document.id).toBe(command.documentId);
  expect(reply.document.elements).toContainEqual(command.element);
  const { id, type, transform, data } = command.element;
  const previousElements = previous.elements?.layers.flatMap((layer) => layer.elements) ?? [];
  for (const page of [dm, peer]) {
    await expect
      .poll(
        async () =>
          (await mapContent(page)).elements?.layers.flatMap((layer) => layer.elements) ?? [],
      )
      .toEqual([...previousElements, { id, type, transform, data }]);
  }
  await expect(dm.getByText(/^[Ss]aving…$/)).toHaveCount(0);
}

async function expectCommitted(
  tool: Tool,
  dm: Page,
  peer: Page,
  ledger: Ledger,
  sent: number,
  previous: Awaited<ReturnType<typeof mapContent>>,
) {
  if (tool === "Grass") await expectPaintCommitted(dm, peer, ledger, sent, previous);
  else await expectPlacement(dm, peer, ledger, sent, previous);
}

for (const tool of ["Grass", "Place"] as const) {
  test(`U2 phone ${tool}: still second finger on inert dock cancels before either lift`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(150_000);
    const dmContext = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const peerContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const dm = await dmContext.newPage();
    const peer = await peerContext.newPage();
    const pages = [dm, peer];
    const ledger = observeWire(dm);
    let cdp: CDPSession | undefined;
    let holding = false;
    try {
      await createAndJoin(dm, peer, true, `U2 offstage ${tool} ${Date.now()}`);
      await armGrass(dm, true, true);
      if (tool === "Place") {
        await dock(dm).getByRole("button", { name: "Tool", exact: true }).tap();
        const tools = dm.getByRole("dialog", { name: "Map tools", exact: true });
        await chooseBuildTool(tools, "place", true);
        await tools.getByRole("button", { name: "Objects", exact: true }).tap();
        await tools.getByRole("button", { name: "Crate", exact: true }).tap();
        await expect(tools.getByRole("button", { name: "Crate", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await tools.getByRole("button", { name: /To the map/i }).tap();
        await expect(tools).toBeHidden();
      }
      const cancel = dock(dm).getByRole("button", {
        name: tool === "Grass" ? "Cancel stroke" : "Cancel placement",
        exact: true,
      });
      await expect(cancel).toBeDisabled();
      cdp = await openTouch(dm);
      const initial = await mapContent(dm);
      expect(initial.live).toBeTruthy();
      expect((await mapContent(peer)).live).toBeUndefined();
      const startCount = mapCommands(ledger).length;
      const positive = await uncoveredRow(dm, 0.28);
      await touchDrag(cdp, positive[0], [positive[1]]);
      await expectCommitted(tool, dm, peer, ledger, startCount, initial);
      await publicBarrier(peer, pages, `${tool}-positive-before`);

      const before = await Promise.all(pages.map(mapContent));
      const sent = mapCommands(ledger).length;
      const row = await uncoveredRow(dm, 0.47);
      const outside = await inertDockPoint(dm);
      await beginHeldStroke(cdp, row);
      holding = true;
      await expect(cancel).toBeEnabled();
      expect(mapCommands(ledger)).toHaveLength(sent);
      await info.attach("held-before-external-touch.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      // Explicit IDs preserve finger 1 when finger 0 lifts. There is NO move
      // after the offstage start, so stage touchmove cannot rescue the behavior.
      await touch(cdp, "touchStart", [
        { ...row[1], id: 0 },
        { ...outside, id: 1 },
      ]);
      await expect
        .soft(cancel, "cancel on external touchstart before either lift")
        .toBeDisabled({ timeout: 1_000 });
      expect(mapCommands(ledger)).toHaveLength(sent);
      await touch(cdp, "touchEnd", [{ ...outside, id: 1 }]);
      await touch(cdp, "touchEnd", []);
      holding = false;
      await publicBarrier(peer, pages, `${tool}-cancelled-no-move`);
      await expectUnchanged(pages, before, ledger, sent);
      await expect(cancel).toBeDisabled();
      await info.attach("after-both-lifts.png", {
        body: await dm.screenshot(),
        contentType: "image/png",
      });

      const fresh = await uncoveredRow(dm, 0.66);
      await touchDrag(cdp, fresh[0], [fresh[1]]);
      await expectCommitted(tool, dm, peer, ledger, sent, before[0]!);
      await publicBarrier(peer, pages, `${tool}-positive-after`);
      expect(mapCommands(ledger)).toHaveLength(sent + 1);
      await expect(cancel).toBeDisabled();
      await info.attach("peer-after-fresh-gesture.png", {
        body: await peer.screenshot(),
        contentType: "image/png",
      });
    } finally {
      if (holding && cdp) await touch(cdp, "touchEnd", []);
      await cdp?.detach();
      await dmContext.close();
      await peerContext.close();
    }
  });
}
