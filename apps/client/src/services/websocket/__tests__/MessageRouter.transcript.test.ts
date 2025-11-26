import { describe, it, expect, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";
import { canonicalServerTranscript } from "./fixtures/canonicalServerTranscript";

describe("MessageRouter canonical transcript contract", () => {
  it("processes auth → control → snapshot flow without regression", () => {
    const snapshotSpy = vi.fn();
    const rtcSpy = vi.fn();
    const authSpy = vi.fn();
    const controlSpy = vi.fn();
    const hbAckSpy = vi.fn();
    const ackSpy = vi.fn();

    const router = new MessageRouter({
      onMessage: snapshotSpy,
      onRtcSignal: rtcSpy,
      onAuthResponse: authSpy,
      onControlMessage: controlSpy,
      onHeartbeatAck: hbAckSpy,
      onAck: ackSpy,
    });

    canonicalServerTranscript.forEach((entry) => router.route(entry.payload));

    expect(rtcSpy).toHaveBeenCalledTimes(1);
    expect(authSpy).toHaveBeenCalledWith({ t: "auth-ok" });
    expect(controlSpy).toHaveBeenCalledWith({ t: "dm-status", isDM: true });
    expect(hbAckSpy).toHaveBeenCalledWith(1_730_000_000_000);
    expect(ackSpy).toHaveBeenCalledWith("cmd-1");
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
    const snapshot = snapshotSpy.mock.calls[0][0];
    expect(snapshot.gridSize).toBe(50);
    expect(snapshot.diceRolls).toEqual([]);
  });

  it("routes delta messages via onDelta callback", () => {
    const snapshotSpy = vi.fn();
    const deltaSpy = vi.fn();

    const router = new MessageRouter({
      onMessage: snapshotSpy,
      onDelta: deltaSpy,
    });

    router.route(
      JSON.stringify({
        t: "token-updated",
        stateVersion: 7,
        token: { id: "token-1", owner: "p1", x: 12, y: 8, color: "#ff0000" },
      }),
    );

    expect(deltaSpy).toHaveBeenCalledWith({
      t: "token-updated",
      stateVersion: 7,
      token: { id: "token-1", owner: "p1", x: 12, y: 8, color: "#ff0000" },
    });
    expect(snapshotSpy).not.toHaveBeenCalled();
  });

  it("routes pointer preview messages via onPointerPreview callback", () => {
    const previewSpy = vi.fn();
    const router = new MessageRouter({
      onMessage: vi.fn(),
      onPointerPreview: previewSpy,
    });

    router.route(
      JSON.stringify({
        t: "pointer-preview",
        pointer: { id: "ptr-1", uid: "player-1", x: 5, y: 6, timestamp: 123, name: "Alice" },
      }),
    );

    expect(previewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ptr-1", uid: "player-1", x: 5, y: 6 }),
    );
  });

  it("routes drag preview messages via onDragPreview callback", () => {
    const dragSpy = vi.fn();
    const router = new MessageRouter({
      onMessage: vi.fn(),
      onDragPreview: dragSpy,
    });

    router.route(
      JSON.stringify({
        t: "drag-preview",
        preview: {
          uid: "player-2",
          timestamp: 999,
          objects: [{ tokenId: "token-1", id: "token:token-1", x: 4, y: 9 }],
        },
      }),
    );

    expect(dragSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "player-2",
        objects: [expect.objectContaining({ tokenId: "token-1", x: 4, y: 9 })],
      }),
    );
  });

  it("routes nack messages via onNack callback", () => {
    const nackSpy = vi.fn();
    const router = new MessageRouter({
      onMessage: vi.fn(),
      onNack: nackSpy,
    });

    router.route(JSON.stringify({ t: "nack", commandId: "cmd-2", reason: "invalid" }));

    expect(nackSpy).toHaveBeenCalledWith("cmd-2", "invalid");
  });
});
