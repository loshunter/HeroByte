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
import {
  WS_MAX_MESSAGE_BYTES,
  type SessionFile,
  loadSessionFrameBytes,
  utf8ByteLength,
} from "@herobyte/shared";
import { useSessionManagement } from "../useSessionManagement";
import { deliverSessionFile } from "../sessionBridge";
import {
  downloadSessionJson,
  loadSession,
  serializeSessionFile,
} from "../../../utils/sessionPersistence";

vi.mock("../../../utils/sessionPersistence", async (importOriginal) => ({
  // The REAL serializer (a hand copy here is the drift this arc exists to end);
  // only the download and the file reader are stubbed. The stub returns what
  // the real download returns: the bytes it would have written.
  ...(await importOriginal<typeof import("../../../utils/sessionPersistence")>()),
  downloadSessionJson: vi.fn((json: string) => new TextEncoder().encode(json).length),
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
    expect(downloadSessionJson).not.toHaveBeenCalled();
  });

  it("downloads under the DM's chosen name once the bundle arrives", async () => {
    // Awaited on purpose: the download now waits on the image-byte fetch, so a
    // synchronous assertion here would race it (and did).
    const { result } = mount();
    const file = sessionFile({ mapDocuments: [{ id: "doc-A" } as never] });

    act(() => result.current.handleSaveSession("my-campaign"));
    await act(async () => {
      deliverSessionFile(file);
    });

    // `assets: []` — this fixture references no uploads, which is the common
    // case (external imgur URLs need no inlining).
    // The download takes the serialized file and the DM's name.
    const [json, name] = vi.mocked(downloadSessionJson).mock.calls[0]!;
    expect(name).toBe("my-campaign");
    expect(JSON.parse(json)).toEqual({ ...file, assets: [] });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 map"), 4000);
  });

  it("inlines referenced image bytes into the downloaded file", async () => {
    // THE POINT OF THE ASSET WORK: without the bytes, a restored session names
    // art the server no longer has and every custom token is a broken image.
    const hash = "a".repeat(64);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([7]).buffer,
      }),
    );
    const { result } = mount();
    const file = sessionFile({
      snapshot: { gridSize: 50, mapBackground: `http://s/assets/${hash}` } as never,
    });

    act(() => result.current.handleSaveSession("with-art"));
    await act(async () => {
      deliverSessionFile(file);
    });

    // The download takes the serialized string: read the file back out of it.
    const written = JSON.parse(vi.mocked(downloadSessionJson).mock.calls[0]![0]) as {
      assets?: unknown;
    };
    expect(written.assets).toEqual([{ hash, mime: "image/png", bytes: btoa("") }]);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 image"), 4000);
  });

  it("warns when an image cannot be saved rather than losing it quietly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { result } = mount();
    const file = sessionFile({
      snapshot: { gridSize: 50, mapBackground: `http://s/assets/${"b".repeat(64)}` } as never,
    });

    act(() => result.current.handleSaveSession("lossy"));
    await act(async () => {
      deliverSessionFile(file);
    });

    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("could not be saved"), 8000);
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
    expect(toast.info).toHaveBeenLastCalledWith("A table backup is already being prepared…");
  });

  it("gives up loudly if the server never replies", () => {
    // Otherwise the DM watches "Preparing your table backup…" forever with no idea
    // whether to click again.
    const { result } = mount();

    act(() => result.current.handleSaveSession("x"));
    act(() => vi.advanceTimersByTime(15_000));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("did not return"), 5000);
    // ...and the in-flight guard resets, so a retry is possible.
    act(() => result.current.handleSaveSession("x"));
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("says the file's wire weight AND its disk size on a save that will load back", async () => {
    const { result } = mount();
    // ~300 KB of name: a weight that cannot be confused with the limit or with zero.
    const file = sessionFile({
      mapDocuments: [{ id: "doc-A", name: "n".repeat(300_000) } as never],
    });
    const wire = loadSessionFrameBytes(file);
    const disk = utf8ByteLength(serializeSessionFile({ ...file, assets: [] }));
    const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    expect(mb(wire)).not.toBe("0.00 MB");
    expect(mb(wire)).not.toBe("1.00 MB");

    act(() => result.current.handleSaveSession("light"));
    await act(async () => {
      deliverSessionFile(file);
    });

    expect(downloadSessionJson).toHaveBeenCalled();
    const said = vi.mocked(toast.success).mock.calls[0]?.[0] ?? "";
    expect(said).toContain(`${mb(wire)} of the 1.00 MB a restore accepts`);
    expect(said).toContain(`(${mb(disk)} on disk with images)`);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("still saves a file that will NOT load back — and warns with both numbers instead of congratulating", async () => {
    // Play grows a table past the wire limit even when every mint stayed
    // under the ceiling (tokens, drawings, suspended scenes). The bytes are
    // the DM's — the file downloads — but "saved!" over a backup that cannot
    // be restored is the failure the whole arc exists to end.
    const { result } = mount();
    // One and a half times the limit: the weight and the limit are different numbers.
    const file = sessionFile({
      mapDocuments: [
        { id: "doc-A", name: "x".repeat(Math.floor(WS_MAX_MESSAGE_BYTES * 1.5)) } as never,
      ],
    });

    act(() => result.current.handleSaveSession("heavy"));
    await act(async () => {
      deliverSessionFile(file);
    });

    expect(downloadSessionJson).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    const said = vi.mocked(toast.warning).mock.calls[0]?.[0] ?? "";
    expect(said).toContain("NOT restore");
    expect(said).toContain("at 1.50 MB on the wire");
    expect(said).toContain("accepts 1.00 MB");
  });

  it("drops a bundle nobody asked for", () => {
    // A late reply after a timeout must not spring a download on the DM.
    mount();

    act(() => deliverSessionFile(sessionFile()));

    expect(downloadSessionJson).not.toHaveBeenCalled();
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
  // Loading replaces the live table for everyone and persists, so it now
  // confirms first. These tests are about what gets SENT, so they take the
  // happy path; the guard itself is covered by its own test below.
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

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

  it("carries the envelope's sceneStates in the frame — exactly the five keys, via the shared builder", async () => {
    // Suspended scenes ride the file's ENVELOPE, never its snapshot, so a
    // frame built from the snapshot alone restores a table with every
    // suspended scene gone — while every server-side round-trip test stays
    // green. The frame is the shared `loadSessionFrame`, the same shape the
    // server's mint ceiling weighs; a key added on either side alone fails here.
    const scenes = [{ mapDocumentId: "doc-B" }] as never;
    const file = sessionFile({
      snapshot: { gridSize: 50, sceneObjects: [{}], characters: [{}] } as never,
      mapDocuments: [{ id: "doc-A" } as never, { id: "doc-B" } as never],
      liveMapDocumentId: "doc-A",
      sceneStates: scenes,
    });
    vi.mocked(loadSession).mockResolvedValue(file);
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "s.json"));
    });

    const sent = sendMessage.mock.calls.find(([message]) => message.t === "load-session")?.[0];
    expect(sent?.sceneStates).toBe(scenes);
    expect(Object.keys(sent ?? {}).sort()).toEqual([
      "liveMapDocumentId",
      "mapDocuments",
      "sceneStates",
      "snapshot",
      "t",
    ]);
  });

  it("refuses a file too large for one wire frame, instead of toasting success over a dead socket", async () => {
    // A load-session frame past the wire limit is dropped by ws at the SOCKET
    // level: the close arrives with 1009 before any handler runs, so the server
    // never says no. This hook used to toast "loaded successfully!" over a
    // table that had not changed at all. A DM with a handful of generated maps
    // can reach that size — the plan's section 7 has the measurements.
    const fat = "x".repeat(WS_MAX_MESSAGE_BYTES);
    const file = sessionFile({
      snapshot: { gridSize: 50 } as never,
      mapDocuments: [{ id: "doc-A", name: fat } as never],
      liveMapDocumentId: "doc-A",
      assets: [{ hash: "h", dataUrl: "data:image/png;base64,AA==" } as never],
    });
    vi.mocked(loadSession).mockResolvedValue(file);
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "huge.json"));
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    // The file carries an asset and `sessionAssets` is NOT mocked here, so a
    // load that reached the restore would have failed on the real upload and
    // said something else entirely. Getting the size message back is what
    // shows the weigh-in happens first, before a doomed load costs uploads.
    expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
    const said = vi.mocked(toast.error).mock.calls[0]?.[0] ?? "";
    expect(said).toContain("too large to restore");
    expect(said).toContain("has NOT been changed");
  });

  it("sends a file that fits, so the guard above is a ceiling and not a wall", async () => {
    // Guard the guard: a check that refused everything would pass the test
    // above while making the feature useless.
    const file = sessionFile({
      // Populated, so the load takes the clean path and reports success rather
      // than the "no characters / no scene objects" warning branch.
      snapshot: { gridSize: 50, sceneObjects: [{}], characters: [{}] } as never,
      mapDocuments: [{ id: "doc-A", name: "x".repeat(1024) } as never],
      liveMapDocumentId: "doc-A",
    });
    vi.mocked(loadSession).mockResolvedValue(file);
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "fine.json"));
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
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

  it("sends nothing when the DM dismisses the replace-the-table confirm", async () => {
    // The whole point of the guard: picking the wrong file must be recoverable
    // by saying no, not by discovering the table is gone for everyone.
    vi.mocked(window.confirm).mockReturnValue(false);
    vi.mocked(loadSession).mockResolvedValue(
      sessionFile({
        snapshot: { gridSize: 50, sceneObjects: [{}], characters: [{}] } as never,
        mapDocuments: [{ id: "doc-A" } as never],
        liveMapDocumentId: "doc-A",
      }),
    );
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "s.json"));
    });

    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ t: "load-session" }));
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

describe("useSessionManagement — the words name the scope (U9)", () => {
  const file = () =>
    sessionFile({
      snapshot: { gridSize: 50, sceneObjects: [{}], characters: [{}] } as never,
      mapDocuments: [{ id: "doc-A" } as never],
      liveMapDocumentId: "doc-A",
    });

  it("asks before a restore, naming the file, what is in it, what it replaces, what it keeps, and that it cannot be undone", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(loadSession).mockResolvedValue(file());
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "friday.json"));
    });

    const asked = String(confirm.mock.calls[0]?.[0]);
    expect(asked).toContain('Restore table backup "friday.json"');
    expect(asked).toContain("1 character(s), 1 map document(s)");
    // The server MERGES a restore (SnapshotLoader.mergeSnapshot): the map, NPCs, props and
    // drawings come from the file, while every roster seat's characters and tokens stay.
    expect(asked).toContain("REPLACES the map, NPCs, props and drawings for everyone connected");
    expect(asked).toContain("Everyone with a seat here keeps their own characters and tokens");
    // A file carries every seat's DM flag too, and a restore leaves them all where they are.
    expect(asked).toContain("nobody's DM status changes");
    expect(asked).not.toMatch(/whole table/i);
    expect(asked).toContain("cannot be undone");
  });

  it("declining sends nothing and says the table has not changed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(loadSession).mockResolvedValue(file());
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "friday.json"));
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenLastCalledWith("Restore cancelled. The table has not changed.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says the backup was restored, by the file's name", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(loadSession).mockResolvedValue(file());
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "friday.json"));
    });

    expect(toast.success).toHaveBeenCalledWith('Table backup "friday.json" restored.', 4000);
  });

  it("passes the loader's wrong-kind message through, by name, and changes nothing", async () => {
    // The loader refuses a character file or a map with a sentence naming what it is
    // and where its own picker lives; the hook must show THAT, not a generic failure.
    const confirm = vi.spyOn(window, "confirm");
    vi.mocked(loadSession).mockRejectedValue(
      new Error("That is a character file, not a table backup. Load it with Load character."),
    );
    const { result } = mount();

    await act(async () => {
      await result.current.handleLoadSession(new File([], "aria.json"));
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Restore failed: That is a character file, not a table backup. Load it with Load character.",
      5000,
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("names the backup it downloaded as a table backup, not a session", async () => {
    const { result } = mount();
    act(() => result.current.handleSaveSession("friday"));
    await act(async () => {
      deliverSessionFile(sessionFile({ mapDocuments: [{ id: "doc-A" } as never] }));
    });
    const said = vi.mocked(toast.success).mock.calls[0]?.[0] ?? "";
    expect(said).toContain('Table backup "friday" downloaded');
    expect(said).not.toMatch(/session/i);
  });
});
