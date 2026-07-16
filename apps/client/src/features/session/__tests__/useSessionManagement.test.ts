/**
 * Tests for the useSessionManagement hook.
 *
 * HISTORY WORTH KNOWING: this file used to hold "characterization tests" written
 * against App.tsx BEFORE the hook was extracted — they defined local copies of
 * the callbacks and asserted on those. After the extraction nobody repointed
 * them, so 59 tests sat here exercising a duplicate of code that no longer ran,
 * and would have passed if the hook were deleted. They are replaced with tests
 * that actually render it.
 *
 * SAVE IS A ROUND TRIP, not a local serialize: the client's snapshot carries the
 * map only as derived output plus a `liveMapDocumentId` pointer, so only the
 * server can bundle a complete session. That request/reply pairing — and the
 * pending filename it hangs on — is what most of these tests are for.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { SessionFile } from "@herobyte/shared";
import { useSessionManagement } from "../useSessionManagement";
import { deliverSessionFile } from "../sessionFileBridge";
import { saveSessionFile, loadSession } from "../../../utils/sessionPersistence";

vi.mock("../../../utils/sessionPersistence", () => ({
  saveSessionFile: vi.fn(),
  loadSession: vi.fn(),
}));

const toast = {
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
};
const sendMessage = vi.fn();

function mount(hasSnapshot = true) {
  return renderHook(() => useSessionManagement({ hasSnapshot, sendMessage, toast }));
}

function sessionFile(overrides: Partial<SessionFile> = {}): SessionFile {
  return {
    schemaVersion: 1,
    savedAt: 1,
    snapshot: { gridSize: 50 } as SessionFile["snapshot"],
    mapDocuments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSessionManagement — save", () => {
  it("asks the server to bundle rather than serializing locally", () => {
    const { result } = mount();

    act(() => result.current.handleSaveSession("my-campaign"));

    expect(sendMessage).toHaveBeenCalledWith({ t: "session-export" });
    // Nothing downloads yet: the client does not hold the maps to write.
    expect(saveSessionFile).not.toHaveBeenCalled();
  });

  it("downloads under the DM's chosen name once the bundle arrives", () => {
    const { result } = mount();
    const file = sessionFile({ mapDocuments: [{ id: "doc-A" } as never] });

    act(() => result.current.handleSaveSession("my-campaign"));
    act(() => deliverSessionFile(file));

    expect(saveSessionFile).toHaveBeenCalledWith(file, "my-campaign");
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 map"), 4000);
  });

  it("refuses to save before a snapshot exists", () => {
    const { result } = mount(false);

    act(() => result.current.handleSaveSession("x"));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it("ignores a second save while one is in flight", () => {
    const { result } = mount();

    act(() => result.current.handleSaveSession("first"));
    act(() => result.current.handleSaveSession("second"));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenLastCalledWith("A session export is already in progress...");
  });

  it("gives up loudly if the server never replies", () => {
    // Otherwise the DM watches "Preparing session file..." forever with no idea
    // whether to click again.
    const { result } = mount();

    act(() => result.current.handleSaveSession("x"));
    act(() => vi.advanceTimersByTime(15_000));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("did not return"), 5000);
    // ...and the in-flight guard resets, so a retry is possible.
    act(() => result.current.handleSaveSession("x"));
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("drops a bundle nobody asked for", () => {
    // A late reply after a timeout must not spring a download on the DM.
    mount();

    act(() => deliverSessionFile(sessionFile()));

    expect(saveSessionFile).not.toHaveBeenCalled();
  });

  it("does not fire its timeout into an unmounted tree", () => {
    const { result, unmount } = mount();

    act(() => result.current.handleSaveSession("x"));
    unmount();
    act(() => vi.advanceTimersByTime(15_000));

    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useSessionManagement — load", () => {
  it("sends the map documents, not just the snapshot", async () => {
    const file = sessionFile({
      snapshot: { gridSize: 50, sceneObjects: [{}], characters: [{}] } as never,
      mapDocuments: [{ id: "doc-A" } as never],
      liveMapDocumentId: "doc-A",
    });
    vi.mocked(loadSession).mockResolvedValue(file);
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "s.json"));
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "load-session",
      snapshot: file.snapshot,
      mapDocuments: file.mapDocuments,
      liveMapDocumentId: "doc-A",
    });
  });

  it("warns when a session names a map it does not carry", async () => {
    // A legacy file loads, but the map comes back read-only. Saying so beats the
    // DM discovering it when the editor opens onto nothing.
    vi.mocked(loadSession).mockResolvedValue(
      sessionFile({
        snapshot: { gridSize: 50, sceneObjects: [{}], characters: [{}] } as never,
        mapDocuments: [],
        liveMapDocumentId: "doc-A",
      }),
    );
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "s.json"));
    });

    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("read-only"), 5000);
  });

  it("surfaces a corrupt file as an error, not a silent no-op", async () => {
    vi.mocked(loadSession).mockRejectedValue(new Error("Invalid session file"));
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "s.json"));
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Invalid session file"), 5000);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
