// Dead-socket step 1 (the owner's decision, 2026-10-10): record each socket's pong
// replies in production and act on none, so step 2's "drop after 2 missed pongs"
// is decided on what Render's proxy actually does.

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { PongRecorder, STEP_2_MISS_LIMIT } from "../pongRecorder.js";

function setup() {
  let now = 1_000_000;
  const lines: string[] = [];
  const recorder = new PongRecorder(
    () => now,
    (line) => lines.push(line),
  );
  const ws = new EventEmitter() as unknown as WebSocket;
  const tick = (ms: number) => {
    now += ms;
  };
  const pong = () => (ws as unknown as EventEmitter).emit("pong");
  return { recorder, ws, lines, tick, pong };
}

describe("PongRecorder", () => {
  it("counts a socket that answers every ping, and logs it once at its close", () => {
    const { recorder, ws, lines, tick, pong } = setup();
    recorder.watch(ws);
    for (let n = 0; n < 3; n += 1) {
      tick(25_000);
      recorder.pinged(ws);
      tick(40);
      pong();
    }
    tick(10_000);
    const record = recorder.closed(ws, { uid: "hero", code: 1001 });

    expect(record).toMatchObject({ pings: 3, pongs: 3, longestMissRun: 0, revivals: 0 });
    expect(lines).toEqual([
      "[pong] hero closed (code 1001) after 85s: 3 ping(s), 3 pong(s), last pong 10s before close, longest run of missed pongs 0",
    ]);
    // Forgotten: a second close logs nothing.
    expect(recorder.closed(ws)).toBeUndefined();
    expect(lines).toHaveLength(1);
  });

  it("counts a run of missed pongs, and a live socket step 2 would have dropped", () => {
    const { recorder, ws, lines, pong } = setup();
    recorder.watch(ws);
    recorder.pinged(ws); // unanswered
    recorder.pinged(ws); // the first is a miss; unanswered
    recorder.pinged(ws); // a second miss in a row: step 2's limit
    pong(); // ...and the socket was alive
    recorder.pinged(ws);

    const record = recorder.closed(ws, { uid: "phone" });
    expect(STEP_2_MISS_LIMIT).toBe(2);
    expect(record).toMatchObject({ pings: 4, pongs: 1, longestMissRun: 2, revivals: 1 });
    expect(lines[0]).toContain("step 2 would have dropped it (1 revival(s) after)");
  });

  it("says when a socket never answered, and logs nothing for one that closed before a ping", () => {
    const { recorder, ws, lines } = setup();
    recorder.watch(ws);
    recorder.pinged(ws);
    recorder.closed(ws, { uid: "silent", code: 1006 });
    expect(lines[0]).toContain("1 ping(s), 0 pong(s), last pong never before close");

    const { recorder: other, ws: blip, lines: none } = setup();
    other.watch(blip);
    other.closed(blip, { uid: "blip" });
    expect(none).toEqual([]);
  });

  it("acts on nothing: it never closes or terminates the socket", () => {
    const { recorder, ws } = setup();
    const socket = ws as unknown as EventEmitter & { close?: unknown; terminate?: unknown };
    let acted = false;
    socket.close = () => (acted = true);
    socket.terminate = () => (acted = true);
    recorder.watch(ws);
    for (let n = 0; n < 10; n += 1) recorder.pinged(ws);
    recorder.closed(ws);
    expect(acted).toBe(false);
  });
});
