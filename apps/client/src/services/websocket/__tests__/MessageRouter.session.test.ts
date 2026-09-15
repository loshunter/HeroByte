// ============================================================================
// MESSAGE ROUTER — Save Game State's reply is a control message this build knows
// ============================================================================
// `session-file` was never on the router's runtime control list. It rode the
// old fallthrough, and the forward-compat guard that stopped unknown types
// blanking the table (a6890e19) silently dropped it instead — every save
// ended in "the server did not return a session file", with the server's
// reply on the wire and nothing on any gate: no unit test routed the frame,
// and no e2e clicked Save. Found live on 2026-09-14, the day the arc taught
// the save toast to say its weight.
//
// Two pins. The first routes the frame. The second reads the SOURCE and
// demands that the three hand-lists — the router's `ControlMessage` union,
// its runtime `isControlMessage` guard, and the config's own copy of the
// union in websocket.ts — name the same types. The comment beside the guard
// says "both lists change together", and prose did not make it so.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTER_SOURCE = path.join(HERE, "..", "MessageRouter.ts");
const CONFIG_SOURCE = path.join(HERE, "..", "..", "websocket.ts");
// Every subscriber of registerServerEventHandler (three today, in three files):
// each type they switch on must be a type the router admits, or the handler is
// dead code and the feature behind it is silently broken — session-file for
// two months, the fork replies since the day they shipped.
const CLIENT_SRC = path.join(HERE, "..", "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function subscriberSources(): string[] {
  return walk(CLIENT_SRC).filter((file) =>
    readFileSync(file, "utf8").includes("registerServerEventHandler("),
  );
}

/** Line comments blanked (one names a type in prose, another holds a semicolon). */
function withoutComments(text: string): string {
  return text.replace(/\/\/[^\n]*/g, (comment) => " ".repeat(comment.length));
}

/** Every `t: "x"` / `t === "x"` literal in a block, sorted. */
function literals(block: string): string[] {
  return [...withoutComments(block).matchAll(/t: "([a-z-]+)"|t === "([a-z-]+)"/g)]
    .map((match) => match[1] ?? match[2]!)
    .sort();
}

/** A union ends at the first semicolon that ends a line (comments blanked). */
function unionEndFrom(text: string, start: number): number {
  const terminator = /;[ \t]*\r?\n/g;
  terminator.lastIndex = start;
  const found = terminator.exec(withoutComments(text));
  return found ? found.index : text.length;
}

describe("MessageRouter — session-file", () => {
  it("delivers the Save Game State reply to the control handler", () => {
    const onControlMessage = vi.fn();
    const router = new MessageRouter({ onMessage: vi.fn(), onControlMessage });
    const frame = {
      t: "session-file",
      file: { schemaVersion: 1, savedAt: 1, snapshot: { gridSize: 50 }, mapDocuments: [] },
    };

    router.route(JSON.stringify(frame));

    expect(onControlMessage).toHaveBeenCalledTimes(1);
    expect(onControlMessage.mock.calls[0]?.[0]).toEqual(frame);
  });

  it("lists the same types in the ControlMessage union, the isControlMessage guard and the config's copy", () => {
    const source = readFileSync(ROUTER_SOURCE, "utf8");
    const config = readFileSync(CONFIG_SOURCE, "utf8");

    const unionStart = source.indexOf("type ControlMessage =");
    const guardStart = source.indexOf("private isControlMessage(");
    const guardEnd = source.indexOf("}\n", source.indexOf("return (", guardStart));
    const configStart = config.indexOf("type ControlMessage =");
    expect(unionStart).toBeGreaterThan(-1);
    expect(guardStart).toBeGreaterThan(-1);
    expect(configStart).toBeGreaterThan(-1);

    const union = literals(source.slice(unionStart, unionEndFrom(source, unionStart)));
    const guard = literals(source.slice(guardStart, guardEnd));
    const configUnion = literals(config.slice(configStart, unionEndFrom(config, configStart)));
    expect(union.length).toBeGreaterThan(5);
    expect(guard).toEqual(union);
    expect(configUnion).toEqual(union);
    expect(guard).toContain("session-file");
  });

  it("admits every control type ANY subscriber of registerServerEventHandler switches on — a handled type the router drops is a dead feature", () => {
    const source = readFileSync(ROUTER_SOURCE, "utf8");
    const guardStart = source.indexOf("private isControlMessage(");
    const guardEnd = source.indexOf("}\n", source.indexOf("return (", guardStart));
    const guard = new Set(literals(source.slice(guardStart, guardEnd)));

    const files = subscriberSources()
      .map((file) => path.relative(CLIENT_SRC, file).replace(/\\/g, "/"))
      .sort();
    expect(files).toEqual([
      "features/rooms/useCreateRoom.ts",
      "features/rooms/useForkTable.ts",
      "hooks/useServerEventHandlers.ts",
    ]);
    const handled = subscriberSources()
      .flatMap((file) =>
        [
          ...withoutComments(readFileSync(file, "utf8")).matchAll(/message\.t === "([a-z-]+)"/g),
        ].map((match) => match[1]!),
      )
      .filter((type, index, all) => all.indexOf(type) === index)
      .sort();
    // Exact membership: a dispatch that stops spelling `message.t === "x"` (a
    // switch, a const) must change this list on purpose, not slip past it.
    expect(handled).toEqual([
      "atlas-error",
      "dm-elevation-failed",
      "dm-password-update-failed",
      "dm-password-updated",
      "dm-status",
      "map-studio-deleted",
      "map-studio-document",
      "map-studio-documents",
      "map-studio-error",
      "room-create-failed",
      "room-created",
      "room-password-update-failed",
      "room-password-updated",
      "session-file",
      "table-fork-failed",
      "table-forked",
    ]);
    const dropped = handled.filter((type) => !guard.has(type));
    expect(dropped, `handled by a subscriber but dropped by the router: ${dropped}`).toEqual([]);
  });

  it("delivers the fork replies to the control handler — 'save as a private table' lives on them", () => {
    const onControlMessage = vi.fn();
    const router = new MessageRouter({ onMessage: vi.fn(), onControlMessage });

    router.route(JSON.stringify({ t: "table-forked", roomId: "r-1", name: "Sunday" }));
    router.route(JSON.stringify({ t: "table-fork-failed", reason: "nope" }));

    expect(onControlMessage).toHaveBeenCalledTimes(2);
    expect(onControlMessage.mock.calls.map(([m]) => (m as { t: string }).t)).toEqual([
      "table-forked",
      "table-fork-failed",
    ]);
  });
});
