/**
 * U6: opening Build while a library map is open names BOTH maps and offers to
 * resume the table's map. It must not offer to "start" a map the table already
 * has, and it must not swap documents by itself (useMapEditState pins that).
 * Both layouts render the same entry, so both are checked here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOST_SCENE_WARNING, UNKNOWN_SCENE_WARNING } from "../../map-studio/tableMapIdentity";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapEditToolbar } from "../MapEditToolbar";
import { MobileMapEditSheet } from "../mobile/MobileMapEditSheet";
import type { BuildEntry } from "../buildEntry";
import type { MapEditToolbarProps } from "../mapEditTypes";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const bag = (buildEntry: BuildEntry, busy = false) =>
  ({
    isLive: false,
    busy,
    saving: false,
    activeSubTool: "wall",
    layersOpen: false,
    error: null,
    buildEntry,
    onStartLiveMap: vi.fn(),
    onClose: vi.fn(),
  }) as unknown as MapEditToolbarProps;

const resume: BuildEntry = { kind: "resume", onTableName: "Crypt", viewingName: "Tavern" };

const layouts = {
  desktop: (toolbar: MapEditToolbarProps) => render(<MapEditToolbar {...toolbar} />),
  phone: (toolbar: MapEditToolbarProps) =>
    render(
      <MobileMapEditSheet toolbar={toolbar} onToggleTools={vi.fn()} onResetCamera={vi.fn()} />,
    ),
};

describe.each(Object.entries(layouts))("%s Build entry", (_layout, show) => {
  it("names the map on the table and the one being viewed, and offers to resume", () => {
    const toolbar = bag(resume);
    show(toolbar);

    expect(screen.getByText(/On table:/)).toHaveTextContent("On table: Crypt");
    expect(screen.getByText(/Viewing in library:/)).toHaveTextContent("Viewing in library: Tavern");
    expect(screen.queryByRole("button", { name: /Start live map/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "▶ Resume editing Crypt" }));
    expect(toolbar.onStartLiveMap).toHaveBeenCalledTimes(1);
  });

  it("says Opening while the resume is in flight", () => {
    show(bag(resume, true));
    expect(screen.getByRole("button", { name: /Opening/ })).toBeDisabled();
  });

  it("starts a table map only when the table has none, and says what that creates", () => {
    const toolbar = bag({ kind: "start" });
    show(toolbar);

    expect(screen.getByText(/No editable map is on the table/)).toBeVisible();
    expect(screen.queryByText(/On table:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Start live map/i }));
    expect(toolbar.onStartLiveMap).toHaveBeenCalledTimes(1);
  });

  it("warns and asks before a start that would erase a scene with no saved map", () => {
    const toolbar = bag({ kind: "start", replacesUnsavedScene: true });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    show(toolbar);

    expect(screen.getByText(LOST_SCENE_WARNING)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Start live map/i }));
    expect(confirm.mock.calls[0]?.[0]).toContain(LOST_SCENE_WARNING);
    expect(toolbar.onStartLiveMap).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Start live map/i }));
    expect(toolbar.onStartLiveMap).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(2); // once per press, never doubled
  });

  it("starts without asking when nothing would be erased", () => {
    const toolbar = bag({ kind: "start", replacesUnsavedScene: false });
    const confirm = vi.spyOn(window, "confirm");
    show(toolbar);
    expect(screen.queryByText(LOST_SCENE_WARNING)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Start live map/i }));
    expect(confirm).not.toHaveBeenCalled();
    expect(toolbar.onStartLiveMap).toHaveBeenCalledTimes(1);
  });

  it("names the table and the viewed map on a start too (the table's map was deleted)", () => {
    show(
      bag({
        kind: "start",
        onTableName: "a scene with no editable map",
        viewingName: "Tavern",
        replacesUnsavedScene: true,
      }),
    );
    expect(screen.getByText("On table:")).toHaveTextContent("a scene with no editable map");
    expect(screen.getByText("Viewing in library:")).toHaveTextContent("Viewing in library: Tavern");
  });

  it("before the library answers, the warning says the loss is possible, not certain", () => {
    const toolbar = bag({ kind: "start", replacesUnsavedScene: true, sceneFateUnknown: true });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    show(toolbar);
    expect(screen.getByText(UNKNOWN_SCENE_WARNING)).toBeVisible();
    expect(screen.queryByText(LOST_SCENE_WARNING)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Start live map/i }));
    expect(confirm.mock.calls[0]?.[0]).toContain(UNKNOWN_SCENE_WARNING);
    expect(toolbar.onStartLiveMap).not.toHaveBeenCalled();
  });

  it("an unbound scene whose map is saved is named, and sent to Use at table", () => {
    show(bag({ kind: "start", onTableName: "Crypt", viewingName: null, sceneMapSaved: true }));
    expect(screen.getByText("On table:")).toHaveTextContent("On table: Crypt");
    expect(screen.getByText(/Use at table \(DM Menu → Maps\) puts it back/)).toBeVisible();
    expect(screen.queryByText(/No editable map is on the table/)).toBeNull();
  });
});
