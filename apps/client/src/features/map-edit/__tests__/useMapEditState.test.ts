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
    refresh: vi.fn(),
    listQuietly: vi.fn(),
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
    documents: [],
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

  it("FOLLOWS a moved live pointer when the palette was ON the old live doc (travel), but never force-reverts an explicit open", () => {
    const methods = makeMethods();
    const base = {
      sendMessage: vi.fn(),
      mapEditMode: true,
      setActiveTool: vi.fn(),
      isDM: true,
      snapshotLoaded: true,
      liveMapDocumentId: "doc-a" as string | undefined,
      sceneSourceDocumentId: undefined,
      roomGridSize: 64,
      hasRasterBackground: false,
    };
    // Palette is on the live doc A…
    const { rerender } = renderHook((props) => useMapEditState(props), {
      initialProps: { ...base, controller: makeController(methods, doc("doc-a")) },
    });
    methods.openDocument.mockClear();
    // …and travel moves the table to B: the palette follows.
    rerender({
      ...base,
      liveMapDocumentId: "doc-b",
      controller: makeController(methods, doc("doc-a")),
    });
    expect(methods.openDocument).toHaveBeenCalledWith("doc-b");

    // But an explicitly opened DRAFT stays put when the pointer moves.
    methods.openDocument.mockClear();
    rerender({
      ...base,
      liveMapDocumentId: "doc-b",
      controller: makeController(methods, doc("my-draft")),
    });
    rerender({
      ...base,
      liveMapDocumentId: "doc-c",
      controller: makeController(methods, doc("my-draft")),
    });
    expect(methods.openDocument).not.toHaveBeenCalled();
  });

  it("FOLLOWS the live pointer with the palette CLOSED too — the DM menu's Studio panel reads the same active document", () => {
    // A DM closes the palette, kicks in a door, opens Map Setup: the Studio
    // must show the map they are standing on, not the one they left. With the
    // follow gated on the palette being open, PUBLISH TO LIVE MAP acted on the
    // stale document and blanked the table (2026-09-08).
    const methods = makeMethods();
    const base = {
      sendMessage: vi.fn(),
      mapEditMode: false,
      setActiveTool: vi.fn(),
      isDM: true,
      snapshotLoaded: true,
      liveMapDocumentId: "doc-a" as string | undefined,
      sceneSourceDocumentId: undefined,
      roomGridSize: 64,
      hasRasterBackground: false,
    };
    const { rerender } = renderHook((props) => useMapEditState(props), {
      initialProps: { ...base, controller: makeController(methods, doc("doc-a")) },
    });
    methods.openDocument.mockClear();
    rerender({
      ...base,
      liveMapDocumentId: "doc-b",
      controller: makeController(methods, doc("doc-a")),
    });
    expect(methods.openDocument).toHaveBeenCalledWith("doc-b");
  });

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
      sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
      sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
      sceneSourceDocumentId: undefined,
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
      sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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
        sceneSourceDocumentId: undefined,
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

  describe("U6 round 1: Build with a library map open", () => {
    const base = (controller: MapStudioController) => ({
      controller,
      sendMessage: vi.fn(),
      mapEditMode: true,
      setActiveTool: vi.fn(),
      isDM: true,
      snapshotLoaded: true,
      liveMapDocumentId: "live-id" as string | undefined,
      sceneSourceDocumentId: undefined,
      roomGridSize: 50,
      hasRasterBackground: false,
    });

    it("Resume opens the TABLE's map — it never creates or binds one", () => {
      const methods = makeMethods();
      const options = base(makeController(methods, doc("library-b")));
      const { result } = renderHook(() => useMapEditState(options));
      expect(result.current.toolbarProps.buildEntry).toMatchObject({ kind: "resume" });

      act(() => result.current.toolbarProps.onStartLiveMap());
      expect(methods.openDocument).toHaveBeenCalledWith("live-id");
      expect(methods.createDocument).not.toHaveBeenCalled();
      expect(options.sendMessage).not.toHaveBeenCalled();
    });

    it("a binding the server reported gone offers Start, not Resume", () => {
      const methods = makeMethods();
      const { result } = renderHook(() =>
        useMapEditState(base(makeController(methods, doc("library-b"), false, null, "live-id"))),
      );
      expect(result.current.toolbarProps.buildEntry.kind).toBe("start");
    });

    it("Ctrl+Z does nothing to the library map being viewed — only the table's map has history here", () => {
      const methods = makeMethods();
      const viewing = { ...makeController(methods, doc("library-b")), canUndo: true };
      const { rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: base(viewing),
      });
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true }),
        );
      });
      expect(methods.undo).not.toHaveBeenCalled();

      rerender(base({ ...makeController(methods, doc("live-id")), canUndo: true }));
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true }),
        );
      });
      expect(methods.undo).toHaveBeenCalledTimes(1);
    });

    it("a Resume that cannot land releases the button instead of sitting on Opening… for good", () => {
      const methods = makeMethods();
      const { result, rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: base(makeController(methods, doc("library-b"))),
      });
      act(() => result.current.toolbarProps.onStartLiveMap());
      // The open is in flight…
      rerender(base(makeController(methods, doc("library-b"), true)));
      expect(result.current.toolbarProps.busy).toBe(true);
      // …and times out: the watchdog releases loading and reports an error.
      rerender(base(makeController(methods, doc("library-b"), false, "server did not respond")));
      expect(result.current.toolbarProps.busy).toBe(false);
    });

    it("entering Build loads the library list it names maps from — quietly", () => {
      // A loud refresh released the shared loading flag under an open still in
      // flight, so the auto-open fired a second full-document GET.
      const methods = makeMethods();
      renderHook(() => useMapEditState(base(makeController(methods, doc("live-id")))));
      expect(methods.listQuietly).toHaveBeenCalledTimes(1);
      expect(methods.refresh).not.toHaveBeenCalled();
    });

    it("outside Build nothing asks for the list (every client mounts this hook)", () => {
      const methods = makeMethods();
      renderHook(() =>
        useMapEditState({
          ...base(makeController(methods, doc("live-id"))),
          mapEditMode: false,
        }),
      );
      expect(methods.listQuietly).not.toHaveBeenCalled();
      expect(methods.refresh).not.toHaveBeenCalled();
    });

    it("a start that would erase a scene with no saved map is flagged through the hook", () => {
      // The table's map was deleted: no binding, but the scene still plays and
      // names a map that is gone. The scene id must reach describeBuildEntry.
      const methods = makeMethods();
      const { result } = renderHook(() =>
        useMapEditState({
          ...base(makeController(methods, null)),
          liveMapDocumentId: undefined,
          sceneSourceDocumentId: "deleted-map",
        }),
      );
      expect(result.current.toolbarProps.buildEntry).toMatchObject({
        kind: "start",
        replacesUnsavedScene: true,
        sceneFateUnknown: false,
      });
    });
  });

  describe("U6 round 3: the entry latch, the list, and names", () => {
    const unbound = (controller: MapStudioController, extra: object = {}) => ({
      controller,
      sendMessage: vi.fn(),
      mapEditMode: true,
      setActiveTool: vi.fn(),
      isDM: true,
      snapshotLoaded: true,
      liveMapDocumentId: undefined as string | undefined,
      sceneSourceDocumentId: undefined as string | undefined,
      roomGridSize: 50,
      hasRasterBackground: false,
      ...extra,
    });

    it("before the library answers, a start is flagged as a POSSIBLE loss (the controller's listed)", () => {
      const methods = makeMethods();
      const controller = { ...makeController(methods, null), listed: false };
      const { result } = renderHook(() =>
        useMapEditState(unbound(controller, { sceneSourceDocumentId: "crypt" })),
      );
      expect(result.current.toolbarProps.buildEntry).toMatchObject({
        kind: "start",
        replacesUnsavedScene: true,
        sceneFateUnknown: true,
      });
    });

    it("a refused create releases the button, and a second press creates again", () => {
      const methods = makeMethods();
      const { result, rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: unbound(makeController(methods, null)),
      });
      act(() => result.current.toolbarProps.onStartLiveMap());
      rerender(unbound(makeController(methods, null, true)));
      expect(result.current.toolbarProps.busy).toBe(true);
      // The server refused the create: loading ends with a reason, and no id lands.
      rerender(unbound(makeController(methods, null, false, "The library is full")));
      expect(result.current.toolbarProps.busy).toBe(false);
      act(() => result.current.toolbarProps.onStartLiveMap());
      expect(methods.createDocument).toHaveBeenCalledTimes(2);
    });

    it("a dangling binding stays latched after set-live, and only THIS attempt's refusal releases it", () => {
      const methods = makeMethods();
      methods.createDocument.mockReturnValueOnce("x1").mockReturnValueOnce("x2");
      const dangling = (activeId: string | null, extra: object = {}) =>
        unbound(
          {
            ...makeController(methods, activeId ? doc(activeId) : null, false, null, "gone"),
            ...extra,
          },
          { liveMapDocumentId: "gone" },
        );
      const { result, rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: dangling(null),
      });
      act(() => result.current.toolbarProps.onStartLiveMap());
      rerender(dangling("x1")); // x1 activates: set-live goes out
      expect(result.current.toolbarProps.busy).toBe(true);
      act(() => result.current.toolbarProps.onStartLiveMap());
      expect(methods.createDocument).toHaveBeenCalledTimes(1); // no orphan second map

      const refusedX1 = { bindRefusal: { documentId: "x1", reason: "gone", seq: 1 } };
      rerender(dangling("x1", refusedX1));
      expect(result.current.toolbarProps.busy).toBe(false);

      // A second attempt: x1's refusal is still in the controller and must NOT
      // release it (that reopened the double-click window).
      act(() => result.current.toolbarProps.onStartLiveMap());
      rerender(dangling("x2", refusedX1)); // x2 activates: set-live goes out
      expect(result.current.toolbarProps.busy).toBe(true);
      act(() => result.current.toolbarProps.onStartLiveMap());
      expect(methods.createDocument).toHaveBeenCalledTimes(2);
    });

    it("follows a table move that lands while a load is in flight", () => {
      const methods = makeMethods();
      const bound = (live: string, loading: boolean) =>
        unbound(makeController(methods, doc("doc-a"), loading), { liveMapDocumentId: live });
      const { rerender } = renderHook((props) => useMapEditState(props), {
        initialProps: bound("doc-a", false),
      });
      methods.openDocument.mockClear();
      rerender(bound("doc-b", true));
      expect(methods.openDocument).not.toHaveBeenCalledWith("doc-b");
      rerender(bound("doc-b", false));
      expect(methods.openDocument).toHaveBeenCalledWith("doc-b");
    });

    it("names same-named copies apart in the header and on a start", () => {
      const methods = makeMethods();
      const copies = [
        { id: "doc-1a2b", name: "Live Map" },
        { id: "doc-9f8e", name: "Live Map" },
      ] as MapStudioController["documents"];
      const open = { id: "doc-9f8e", name: "Live Map" } as MapDocument;
      const { result } = renderHook(() =>
        useMapEditState(unbound({ ...makeController(methods, open), documents: copies })),
      );
      expect(result.current.toolbarProps.mapName).toBe("Live Map #9f8e");
      expect(result.current.toolbarProps.buildEntry).toMatchObject({
        kind: "start",
        viewingName: "Live Map #9f8e",
      });
    });
  });
});
