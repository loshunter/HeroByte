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
      liveMapDocumentId: undefined as string | undefined,
      roomGridSize: 64,
      hasRasterBackground: false,
    };

    const { result, rerender } = renderHook((props) => useMapEditState(props), {
      initialProps: { ...base, controller: makeController(methods, null) },
    });

    act(() => result.current.toolbarProps.onStartLiveMap());
    expect(methods.createDocument).toHaveBeenCalledWith("Live Map", 8192, 8192);
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
      liveMapDocumentId: "gone-id" as string | undefined,
      roomGridSize: 50,
      hasRasterBackground: false,
    };
    const { result, rerender } = renderHook((props) => useMapEditState(props), {
      initialProps: { ...base, controller: makeController(methods, null, false, null, "gone-id") },
    });

    act(() => result.current.toolbarProps.onStartLiveMap());
    expect(methods.openDocument).not.toHaveBeenCalled(); // never re-fetch the dangling id
    expect(methods.createDocument).toHaveBeenCalledWith("Live Map", 8192, 8192);

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
        liveMapDocumentId: "live-id",
        roomGridSize: 50,
        hasRasterBackground: false,
      }),
    );

    act(() => result.current.toolbarProps.onClose());
    expect(setActiveTool).toHaveBeenCalledWith(null);
  });

  it("toasts a server error once when it appears during map-edit", () => {
    const methods = makeMethods();
    const notifyError = vi.fn();
    const base = {
      sendMessage: vi.fn(),
      mapEditMode: true,
      setActiveTool: vi.fn(),
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
        liveMapDocumentId: "live-id",
        roomGridSize: 50,
        hasRasterBackground: false,
        notifyError,
      }),
    );
    expect(notifyError).not.toHaveBeenCalled();
  });
});
