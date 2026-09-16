/**
 * The one `load-session` frame — shape and weight.
 *
 * Three sites build or weigh this frame (the client's loader, the server's
 * mint ceiling, the server's round-trip test). If the shape here drifts from
 * what the client sends, the server's weigh-in measures a frame nobody
 * transmits and the wire limit is hit unseen — so the shape is pinned key by
 * key, and the counter is pinned against the one mistake that reads right in
 * every ASCII fixture (UTF-16 units for UTF-8 bytes).
 */
import { describe, it, expect } from "vitest";
import {
  loadSessionFrame,
  loadSessionFrameBytes,
  utf8ByteLength,
  SESSION_MINT_CEILING_BYTES,
  WS_MAX_MESSAGE_BYTES,
  type SessionFile,
} from "../index.js";

function sessionFile(overrides: Partial<SessionFile> = {}): SessionFile {
  return {
    schemaVersion: 1,
    savedAt: 1_700_000_000_000,
    snapshot: { gridSize: 50, tokens: [], players: [] } as never,
    mapDocuments: [{ id: "doc-A", name: "A" } as never],
    liveMapDocumentId: "doc-A",
    ...overrides,
  };
}

describe("loadSessionFrame", () => {
  it("builds exactly the five keys the loader sends — never assets, never savedAt", () => {
    const file = sessionFile({
      sceneStates: [{ mapDocumentId: "doc-B" } as never],
      assets: [{ hash: "h", mime: "image/png", bytes: "AA==" }],
    });

    const frame = loadSessionFrame(file);

    expect(frame.t).toBe("load-session");
    expect(Object.keys(frame).sort()).toEqual([
      "liveMapDocumentId",
      "mapDocuments",
      "sceneStates",
      "snapshot",
      "t",
    ]);
    // The same objects, not copies: the frame is a view on the file.
    expect(frame.snapshot).toBe(file.snapshot);
    expect(frame.mapDocuments).toBe(file.mapDocuments);
    expect(frame.sceneStates).toBe(file.sceneStates);
    expect(frame.liveMapDocumentId).toBe("doc-A");
  });

  it("carries the envelope's sceneStates — the silent-suspended-scene-loss key", () => {
    const scenes = [{ mapDocumentId: "doc-B" }, { mapDocumentId: "doc-C" }] as never[];
    expect(loadSessionFrame(sessionFile({ sceneStates: scenes })).sceneStates).toBe(scenes);
    // A pre-Atlas file has none, and the key is simply undefined (JSON drops it).
    expect(loadSessionFrame(sessionFile()).sceneStates).toBeUndefined();
  });
});

describe("utf8ByteLength", () => {
  it("counts UTF-8 bytes, not UTF-16 code units", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect("→".length).toBe(1);
    expect(utf8ByteLength("→")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect("😀".length).toBe(2);
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength("")).toBe(0);
  });
});

describe("loadSessionFrameBytes", () => {
  it("weighs the FRAME, not the file — inlined assets never cross in this message", () => {
    const fatAsset = "A".repeat(100_000);
    const file = sessionFile({ assets: [{ hash: "h", mime: "image/png", bytes: fatAsset }] });

    const bytes = loadSessionFrameBytes(file);

    expect(bytes).toBeLessThan(fatAsset.length);
    expect(bytes).toBe(utf8ByteLength(JSON.stringify(loadSessionFrame(file))));
  });

  it("grows with a multi-byte name by its wire bytes", () => {
    const ascii = loadSessionFrameBytes(
      sessionFile({ mapDocuments: [{ id: "d", name: "x" } as never] }),
    );
    const arrow = loadSessionFrameBytes(
      sessionFile({ mapDocuments: [{ id: "d", name: "→" } as never] }),
    );
    expect(arrow - ascii).toBe(2);
  });
});

describe("SESSION_MINT_CEILING_BYTES", () => {
  it("is three quarters of the wire limit — headroom for play, not a wall", () => {
    expect(SESSION_MINT_CEILING_BYTES).toBeLessThan(WS_MAX_MESSAGE_BYTES);
    expect(SESSION_MINT_CEILING_BYTES).toBeGreaterThan(WS_MAX_MESSAGE_BYTES / 2);
    // The product decision, loosely: two `large` warehouses still fit. Only ONE
    // scene is ever live, so two cost 2 × ~270 KB of document plus ~190 KB of
    // scene (measured with the production 36-character command id).
    expect(SESSION_MINT_CEILING_BYTES).toBeGreaterThan(2 * 270 * 1024 + 190 * 1024);
  });
});
