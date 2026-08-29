import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MapDocument } from "@herobyte/shared";
import { useMapEditState } from "../useMapEditState";
import type { MapStudioController } from "../../map-studio/types";

// Stable method mocks reused across rerenders so effect deps stay honest.
function makeMethods() {
  return {
    createDocument: vi.fn(() => "new-id"),
    openDocument: vi.fn(),
    updateGrid: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  };
}

function makeController(
  methods: ReturnType<typeof makeMethods>,
  activeDocument: MapDocument | null,
  loading = false,
  error: string | null = null,
  missingDocumentId: string | null = null,
): MapStudioController {
  return {
    activeDocument,
    loading,
    canUndo: false,
    canRedo: false,
    error,
    missingDocumentId,
    ...methods,
  } as unknown as MapStudioController;
}

const doc = (id: string) => ({ id }) as MapDocument;

describe("useMapEditState", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a live document, then binds + syncs its grid once it activates", () => {
    const methods = makeMethods();
    const sendMessage = vi.fn();
    const base = {
      sendMessage,
      mapEditMode: true,
      setActiveTool: vi.fn(),
      isDM: true,
      snapshotLoaded: true,
      liveMapDocumentId: undefined as string | undefined,
      roomGridSize: 64,
      hasRasterBackground: false,
    };

    const { result, rerender } = renderHook((props) => useMapEditState(props), {
      initialProps: { ...base, controller: makeController(methods, null) },
    });

    act(() => result.current.toolbarProps.onStartLiveMap());
    // Date-stamped so duplicate live documents stay distinguishable.
    expect(methods.createDocument).toHaveBeenCalledWith(
      expect.stringMatching(/^Live Map /),
      8192,
      8192,
    );
    expect(sendMessage).not.toHaveBeenCalled(); // not bound until the doc activates

    // The server's create reply activates the document.
    rerender({ ...base, controller: makeController(methods, doc("new-id")) });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ t: "map-studio-set-live", documentId: "new-id" });
    expect(methods.updateGrid).toHaveBeenCalledWith({ size: 64 });
  });

  it("ignores a second START LIVE MAP while a bind is in flight (no duplicate doc)", () => {
    const methods = makeMethods();
    const { result } = renderHook(() =>
      useMapEditState({
        controller: makeController(methods, null),
        sendMessage: vi.fn(),
        mapEditMode: true,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: undefined,
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    act(() => result.current.toolbarProps.onStartLiveMap());
    expect(methods.createDocument).toHaveBeenCalledTimes(1);
    expect(result.current.toolbarProps.busy).toBe(true);

    // Second click during the in-flight bind must NOT create a second document.
    act(() => result.current.toolbarProps.onStartLiveMap());
    expect(methods.createDocument).toHaveBeenCalledTimes(1);
  });

  it("auto-opens the existing bound document on entering map-edit (no create)", () => {
    const methods = makeMethods();
    renderHook(() =>
      useMapEditState({
        controller: makeController(methods, null),
        sendMessage: vi.fn(),
        mapEditMode: true,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "existing-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    expect(methods.openDocument).toHaveBeenCalledWith("existing-id");
    expect(methods.createDocument).not.toHaveBeenCalled();
  });

  it("never auto-reopens a DANGLING binding (the stuck-STARTING loop regression)", () => {
    // The server reported the bound document gone (missingDocumentId): the
    // rebind effect must not fire again, or it loops open → not-found → open
    // forever, pinning the palette on STARTING… after a maps-store reset.
    const methods = makeMethods();
    renderHook(() =>
      useMapEditState({
        controller: makeController(methods, null, false, null, "existing-id"),
        sendMessage: vi.fn(),
        mapEditMode: true,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "existing-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    expect(methods.openDocument).not.toHaveBeenCalled();
    expect(methods.createDocument).not.toHaveBeenCalled();
  });

  it("START LIVE MAP on a dangling binding creates a FRESH document whose bind repairs the room", () => {
    const methods = makeMethods();
    const sendMessage = vi.fn();
    const base = {
      sendMessage,
      mapEditMode: true,
      setActiveTool: vi.fn(),
      isDM: true,
      snapshotLoaded: true,
      liveMapDocumentId: "gone-id" as string | undefined,
      roomGridSize: 50,
      hasRasterBackground: false,
    };
    const { result, rerender } = renderHook((props) => useMapEditState(props), {
      initialProps: { ...base, controller: makeController(methods, null, false, null, "gone-id") },
    });

    act(() => result.current.toolbarProps.onStartLiveMap());
    expect(methods.openDocument).not.toHaveBeenCalled(); // never re-fetch the dangling id
    // Date-stamped so duplicate live documents stay distinguishable.
    expect(methods.createDocument).toHaveBeenCalledWith(
      expect.stringMatching(/^Live Map /),
      8192,
      8192,
    );

    // The create reply activates the fresh document → set-live rebinds the room.
    rerender({
      ...base,
      controller: makeController(methods, doc("new-id"), false, null, "gone-id"),
    });
    expect(sendMessage).toHaveBeenCalledWith({ t: "map-studio-set-live", documentId: "new-id" });
  });

  it("does not revert a different document the DM explicitly opened for export/backup", () => {
    const methods = makeMethods();
    renderHook(() =>
      useMapEditState({
        controller: makeController(methods, doc("other-id")),
        sendMessage: vi.fn(),
        mapEditMode: true,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "live-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    // The old guard (bail only when the ACTIVE doc IS the live one) re-opened the
    // live doc whenever a different one was active, silently reverting an explicit
    // OPEN and mis-targeting BACKUP JSON at the live map.
    expect(methods.openDocument).not.toHaveBeenCalled();
  });

  it("reports isLive and no-ops startLiveMap when the bound doc is already active", () => {
    const methods = makeMethods();
    const { result } = renderHook(() =>
      useMapEditState({
        controller: makeController(methods, doc("live-id")),
        sendMessage: vi.fn(),
        mapEditMode: true,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "live-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    expect(result.current.toolbarProps.isLive).toBe(true);
    act(() => result.current.toolbarProps.onStartLiveMap());
    expect(methods.createDocument).not.toHaveBeenCalled();
    expect(methods.openDocument).not.toHaveBeenCalled();
  });

  it("does not auto-open when not in map-edit mode", () => {
    const methods = makeMethods();
    renderHook(() =>
      useMapEditState({
        controller: makeController(methods, null),
        sendMessage: vi.fn(),
        mapEditMode: false,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "existing-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    expect(methods.openDocument).not.toHaveBeenCalled();
  });

  it("closes the tool via setActiveTool(null)", () => {
    const methods = makeMethods();
    const setActiveTool = vi.fn();
    const { result } = renderHook(() =>
      useMapEditState({
        controller: makeController(methods, doc("live-id")),
        sendMessage: vi.fn(),
        mapEditMode: true,
        setActiveTool,
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "live-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    act(() => result.current.toolbarProps.onClose());
    expect(setActiveTool).toHaveBeenCalledWith(null);
  });

  describe("losing DM leaves the mode", () => {
    // Every way OUT of map-edit is DM-gated (the header entry, and the palette
    // itself via TopPanelLayout's `mapEditMode && isDM`) while the mode's
    // EFFECTS are not: shouldPan excludes map-edit, so one-finger and mouse
    // panning stop, and tokenInteractionsEnabled is false. A revoked DM was
    // therefore left on a table they could neither author nor move.
    const base = (isDM: boolean, setActiveTool: () => void, snapshotLoaded = true) => ({
      sendMessage: vi.fn(),
      mapEditMode: true,
      setActiveTool,
      isDM,
      snapshotLoaded,
      liveMapDocumentId: "live-id",
      roomGridSize: 50,
      hasRasterBackground: false,
    });

    it("drops the tool the moment DM is revoked mid-edit", () => {
      const methods = makeMethods();
      const setActiveTool = vi.fn();
      const controller = makeController(methods, doc("live-id"));

      const { rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: { ...base(true, setActiveTool), controller },
      });
      expect(setActiveTool).not.toHaveBeenCalled();

      rerender({ ...base(false, setActiveTool), controller });

      expect(setActiveTool).toHaveBeenCalledWith(null);
    });

    it("leaves a DM in the mode alone", () => {
      const methods = makeMethods();
      const setActiveTool = vi.fn();
      const controller = makeController(methods, doc("live-id"));

      const { rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: { ...base(true, setActiveTool), controller },
      });
      rerender({ ...base(true, setActiveTool), controller });

      expect(setActiveTool).not.toHaveBeenCalled();
    });

    it("does not fire for a player who was never in the mode", () => {
      const methods = makeMethods();
      const setActiveTool = vi.fn();
      renderHook(() =>
        useMapEditState({
          ...base(false, setActiveTool),
          mapEditMode: false,
          controller: makeController(methods, null),
        }),
      );

      expect(setActiveTool).not.toHaveBeenCalled();
    });

    it("SURVIVES a reconnect — a null snapshot is not a revocation", () => {
      // The defect this guard shipped with. isDM is DERIVED from the snapshot,
      // and ANY socket close nulls it (handleClose -> authManager.reset -> the
      // "reset" auth event -> setSnapshot(null)) while AuthenticationGate keeps
      // the app MOUNTED behind a Reconnecting banner. So a phone locking its
      // screen looked exactly like "the server revoked your DM", and the DM
      // came back from the blip no longer in map-edit.
      const methods = makeMethods();
      const setActiveTool = vi.fn();
      const controller = makeController(methods, doc("live-id"));

      const { rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: { ...base(true, setActiveTool), controller },
      });

      // The socket drops: no snapshot, so isDM reads false.
      rerender({ ...base(false, setActiveTool, false), controller });
      expect(setActiveTool).not.toHaveBeenCalled();

      // ...and comes back with the DM still a DM. The mode was never dropped.
      rerender({ ...base(true, setActiveTool), controller });
      expect(setActiveTool).not.toHaveBeenCalled();
    });

    it("still fires once the server HAS spoken and says you are not a DM", () => {
      // The other half: the guard must not become a no-op. Same shape as the
      // reconnect above, but the snapshot arrives and the roster no longer
      // lists this client as a DM.
      const methods = makeMethods();
      const setActiveTool = vi.fn();
      const controller = makeController(methods, doc("live-id"));

      const { rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: { ...base(true, setActiveTool), controller },
      });
      rerender({ ...base(false, setActiveTool, false), controller });
      rerender({ ...base(false, setActiveTool, true), controller });

      expect(setActiveTool).toHaveBeenCalledWith(null);
    });
  });

  it("toasts a server error once when it appears during map-edit", () => {
    const methods = makeMethods();
    const notifyError = vi.fn();
    const base = {
      sendMessage: vi.fn(),
      mapEditMode: true,
      setActiveTool: vi.fn(),
      isDM: true,
      snapshotLoaded: true,
      liveMapDocumentId: "live-id",
      roomGridSize: 50,
      hasRasterBackground: false,
      notifyError,
    };
    const { rerender } = renderHook((props) => useMapEditState(props), {
      initialProps: { ...base, controller: makeController(methods, doc("live-id")) },
    });
    expect(notifyError).not.toHaveBeenCalled();

    // Server rejects a command → controller.error becomes non-null.
    rerender({ ...base, controller: makeController(methods, doc("live-id"), false, "boom") });
    expect(notifyError).toHaveBeenCalledExactlyOnceWith("boom");

    // Same error persists across an unrelated rerender → no duplicate toast.
    rerender({ ...base, controller: makeController(methods, doc("live-id"), false, "boom") });
    expect(notifyError).toHaveBeenCalledTimes(1);
  });

  it("does not toast a server error when not in map-edit mode", () => {
    const methods = makeMethods();
    const notifyError = vi.fn();
    renderHook(() =>
      useMapEditState({
        controller: makeController(methods, doc("live-id"), false, "boom"),
        sendMessage: vi.fn(),
        mapEditMode: false,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "live-id",
        roomGridSize: 50,
        hasRasterBackground: false,
        notifyError,
      }),
    );
    expect(notifyError).not.toHaveBeenCalled();
  });

  // The two ways INTO a sample, and the split that matters: the eyedropper
  // TOOL hands over to Place (a phone samples in order to drop), the desktop
  // Ctrl shortcut keeps the tool in hand — "it samples without giving up the
  // tool you are holding, which is the whole point at a mouse"
  // (useMapEditSelection's header). The dial callback used to re-arm Place
  // for BOTH, so Ctrl-sampling mid-paint stole the terrain brush.
  it("a sample re-arms Place for the tool, and keeps the tool for the shortcut", () => {
    const methods = makeMethods();
    const { result } = renderHook(() =>
      useMapEditState({
        controller: makeController(methods, doc("live-id")),
        sendMessage: vi.fn(),
        mapEditMode: true,
        setActiveTool: vi.fn(),
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "live-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    act(() => result.current.toolbarProps.onSelectSubTool("terrain"));
    act(() => result.current.onSampleAsset("objects:crate", "shortcut"));
    expect(result.current.toolbarProps.selectedAssetId).toBe("objects:crate");
    expect(result.current.toolbarProps.activeSubTool).toBe("terrain");

    act(() => result.current.toolbarProps.onSelectSubTool("eyedropper"));
    act(() => result.current.onSampleAsset("objects:barrel", "tool"));
    expect(result.current.toolbarProps.selectedAssetId).toBe("objects:barrel");
    expect(result.current.toolbarProps.activeSubTool).toBe("place");
  });
});
