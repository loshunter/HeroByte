// ============================================================================
// SESSION FRAME — the one shape a session file takes across the wire
// ============================================================================
// A DM's export must load back in ONE `load-session` message: ws checks the
// declared frame length against WS_MAX_MESSAGE_BYTES before a byte is
// buffered, so a frame past it is dropped with a 1009 close that no handler
// ever sees. Three places used to hand-build that frame — the client's loader,
// the server's round-trip test, and now the server's mint ceiling, which must
// weigh the export a mint WOULD write. Three copies of one shape drift, and a
// server weigher that drifts from the client's frame is exactly the kind of
// check that stays green while the real frame is dropped. So: ONE builder and
// ONE counter, imported by all three.
//
// Runtime values live in a real sub-module and are re-exported from the barrel
// (see wsLimits.ts for why a direct `export const` there is erased).

import type { ClientMessage, SessionFile } from "./index.js";

export type LoadSessionFrame = Extract<ClientMessage, { t: "load-session" }>;

/**
 * What the frame is built from: a SessionFile minus the parts a frame never
 * carries (`assets` are restored over HTTP first; `savedAt` and the schema
 * version describe the file, not the table).
 */
export type LoadSessionSource = Pick<
  SessionFile,
  "snapshot" | "mapDocuments" | "liveMapDocumentId" | "sceneStates"
>;

/** The `load-session` message a client sends for this file — the five keys, nothing else. */
export function loadSessionFrame(file: LoadSessionSource): LoadSessionFrame {
  return {
    t: "load-session",
    snapshot: file.snapshot,
    mapDocuments: file.mapDocuments,
    liveMapDocumentId: file.liveMapDocumentId,
    // Envelope-only cargo: the snapshot half never carries scenes, so omitting
    // this line is the silent-suspended-scene-loss bug.
    sceneStates: file.sceneStates,
  };
}

/**
 * Bytes as ws counts them — UTF-8, not UTF-16 code units. `"→".length` is 1;
 * on the wire it is 3, and a table full of names like that drifts a
 * `.length`-based weigh-in short of the real frame.
 */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** What this file's `load-session` frame weighs on the wire. */
export function loadSessionFrameBytes(file: LoadSessionSource): number {
  return utf8ByteLength(JSON.stringify(loadSessionFrame(file)));
}
