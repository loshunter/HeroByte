import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { placeRoom } from "@herobyte/shared";
import { buildRoomCommand } from "../roomBuilder";
import { MapEditToolbar } from "../MapEditToolbar";
import { boundPalette } from "./characterization/palette.fixtures";

afterEach(cleanup);

function armedRoom() {
  const h = boundPalette();
  const bounds = { x: 0, y: 0, width: 500, height: 500 };
  const { command } = buildRoomCommand(
    bounds,
    "grass",
    h.document.grid,
    new Map(h.document.layers.map((layer) => [layer.id, layer])),
  );
  if (!command) throw new Error("Room fixture must build");
  const document = placeRoom(h.document, command.cells, command.elements, 2);
  act(() =>
    h.result.current.controller.handleServerMessage({ t: "map-studio-document", document }),
  );
  act(() => {
    h.result.current.state.toolbarProps.onSelectSubTool("room");
    h.result.current.state.onRegionPlaced(bounds, "room", command.elements);
  });
  return { ...h, document, perimeters: command.elements };
}

describe("the last-room decoration target", () => {
  it("names the actual target instead of an unqualified Populate command", () => {
    const h = armedRoom();
    expect(h.props().canPopulate).toBe(true);
    render(<MapEditToolbar {...h.props()} />);
    expect(screen.getByRole("button", { name: /Decorate last room/ })).toBeEnabled();
  });

  it("never offers a ready action when all placement layers become locked", () => {
    const h = armedRoom();
    expect(h.props().canPopulate).toBe(true);
    const locked = {
      ...h.document,
      revision: h.document.revision + 1,
      layers: h.document.layers.map((layer) => ({ ...layer, locked: true })),
    };
    act(() =>
      h.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document: locked,
      }),
    );
    expect(h.props().canPopulate).toBe(false);
    expect(h.props().populateHint).toMatch(/unlock a placement layer/);
    h.send.mockClear();
    act(() => h.props().onPopulate());
    expect(h.send).not.toHaveBeenCalled();
  });

  it("distinguishes no target, a valid hallway and a pending placement", () => {
    const h = armedRoom();
    const ready = h.props().populateHint;
    act(() => {
      h.props().onSelectSubTool("hallway");
      h.result.current.state.onRegionPlaced(
        { x: 0, y: 0, width: 500, height: 500 },
        "hallway",
        h.perimeters,
      );
    });
    expect(h.props().populateTarget?.kind).toBe("hallway");
    expect(h.result.current.state.persistentPreview.populateTarget?.kind).toBe("hallway");
    render(<MapEditToolbar {...h.props()} />);
    expect(screen.getByRole("button", { name: /Decorate last hallway/ })).toBeEnabled();
    act(() => h.props().onPopulate());
    expect(h.props().populateTarget).toBeNull();
    expect(h.props().canPopulate).toBe(false);
    expect(h.props().populateHint).toMatch(/Working/);
    expect(h.props().populateHint).not.toBe(ready);
  });

  it("a retained decoration action cannot target a different active document", () => {
    const h = armedRoom();
    const oldAction = h.props().onPopulate;
    const other = { ...h.document, id: "other-map", revision: 0 };
    act(() => h.result.current.controller.openDocument(other.id));
    act(() =>
      h.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document: other,
      }),
    );
    expect(h.props().populateTarget).toBeNull();
    h.send.mockClear();
    act(() => oldAction());
    expect(h.send).not.toHaveBeenCalled();
  });

  it("consumes a target once even when the same callback fires twice before rendering", () => {
    const h = armedRoom();
    const decorate = h.props().onPopulate;
    h.send.mockClear();
    act(() => {
      decorate();
      decorate();
    });
    const commands = h.send.mock.calls
      .map(([message]) => message)
      .filter((message) => message.t === "map-studio-command");
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      command: { type: "add-elements", documentId: h.document.id },
    });
    expect(h.props().populateTarget).toBeNull();
  });

  it("removes the private target and draft footprints on DM demotion", () => {
    const h = armedRoom();
    expect(h.result.current.state.persistentPreview.populateTarget).not.toBeNull();
    expect(h.result.current.state.persistentPreview.populateGhosts?.length).toBeGreaterThan(0);
    h.rerender({ isDM: false });
    expect(h.result.current.state.persistentPreview.populateTarget).toBeNull();
    expect(h.result.current.state.persistentPreview.populateGhosts).toBeNull();
    expect(h.setActiveTool).toHaveBeenCalledWith(null);
  });
});
