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

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTER_SOURCE = path.join(HERE, "..", "MessageRouter.ts");
const CONFIG_SOURCE = path.join(HERE, "..", "..", "websocket.ts");

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
});
