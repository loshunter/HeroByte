import { describe, it, expect, vi } from "vitest";
import type { WebSocket } from "ws";
import { RoomService } from "../service.js";
import type { BroadcastMetricsLogger } from "../metrics/BroadcastMetricsLogger.js";

describe("RoomService.broadcast telemetry", () => {
  it("logs aggregated metrics for each broadcast", () => {
    const metricsLogger = {
      log: vi.fn(),
    } as unknown as BroadcastMetricsLogger;

    const service = new RoomService({ metricsLogger });
    vi.spyOn(service, "saveState").mockImplementation(() => {});

    const mockSend = vi.fn();
    const fakeSocket = {
      readyState: 1,
      send: mockSend,
    } as unknown as WebSocket;

    const clients = new Set<WebSocket>([fakeSocket]);
    const uidToWs = new Map<string, WebSocket>([["player-1", fakeSocket]]);

    const state = service.getState();
    state.players.push({
      uid: "player-1",
      name: "Alice",
      hp: 10,
      maxHp: 10,
      lastHeartbeat: Date.now(),
      isDM: false,
    });

    service.broadcast(clients, uidToWs, { reason: "test-reason" });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(typeof payload).toBe("string");

    const snapshot = JSON.parse(payload);
    expect(snapshot.stateVersion).toBe(1);
    expect(service.getState().stateVersion).toBe(1);

    service.broadcast(clients, uidToWs, { reason: "test-reason-2" });
    const secondPayload = mockSend.mock.calls[1][0];
    expect(JSON.parse(secondPayload).stateVersion).toBe(2);
    expect(service.getState().stateVersion).toBe(2);

    expect(metricsLogger.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clientCount: 1,
        snapshotBytes: Buffer.byteLength(secondPayload, "utf8"),
        reason: "test-reason-2",
      }),
    );
  });

  it("allows skipping state version bump when requested", () => {
    const metricsLogger = {
      log: vi.fn(),
    } as unknown as BroadcastMetricsLogger;

    const service = new RoomService({ metricsLogger });
    vi.spyOn(service, "saveState").mockImplementation(() => {});

    const mockSend = vi.fn();
    const fakeSocket = {
      readyState: 1,
      send: mockSend,
    } as unknown as WebSocket;

    const clients = new Set<WebSocket>([fakeSocket]);

    service.broadcast(clients);
    expect(service.getState().stateVersion).toBe(1);

    service.broadcast(clients, undefined, { skipVersionBump: true });
    expect(service.getState().stateVersion).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
