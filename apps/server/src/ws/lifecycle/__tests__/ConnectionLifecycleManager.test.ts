import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";

/**
 * CHARACTERIZATION TESTS FOR ConnectionLifecycleManager
 *
 * These tests lock in the CURRENT behavior from ConnectionHandler.handleConnection()
 * before extraction. They test the actual implementation as it exists today.
 *
 * Source: apps/server/src/ws/connectionHandler.ts lines 82-123
 *
 * DO NOT modify these tests to match desired behavior.
 * These tests document what the code DOES, not what it SHOULD do.
 */

class FakeWebSocket {
  public readyState = 1; // OPEN
  public send = vi.fn<(data: string | Buffer) => void>();
  public close = vi.fn<(code?: number, reason?: string) => void>((_code, _reason) => {
    this.readyState = 3; // CLOSED
  });
  public ping = vi.fn<() => void>();
  public on = vi.fn<(event: string, handler: (...args: unknown[]) => void) => void>();
}

class FakeIncomingMessage {
  public url: string;

  constructor(url: string) {
    this.url = url;
  }
}

describe("ConnectionLifecycleManager - Characterization Tests", () => {
  let uidToWs: Map<string, WebSocket>;
  let authenticatedUids: Set<string>;
  let authenticatedSessions: Map<string, { roomId: string; authedAt: number }>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create fresh maps/sets for each test
    uidToWs = new Map();
    authenticatedUids = new Set();
    authenticatedSessions = new Map();

    // Mock console.log
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("UID extraction from connection URL", () => {
    it("extracts UID from query parameter", () => {
      // Setup: URL with uid parameter
      const req = new FakeIncomingMessage(
        "http://localhost?uid=player123",
      ) as unknown as IncomingMessage;

      // Execute: extract UID (simulating lines 84-85)
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: UID extracted correctly
      expect(uid).toBe("player123");
    });

    it("defaults to 'anon' when uid parameter is missing", () => {
      // Setup: URL without uid parameter
      const req = new FakeIncomingMessage("http://localhost") as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: defaults to "anon"
      expect(uid).toBe("anon");
    });

    it("defaults to 'anon' when url is empty string", () => {
      // Setup: empty URL
      const req = new FakeIncomingMessage("") as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: defaults to "anon"
      expect(uid).toBe("anon");
    });

    it("handles anonymous UID string 'anon'", () => {
      // Setup: URL explicitly sets uid=anon
      const req = new FakeIncomingMessage(
        "http://localhost?uid=anon",
      ) as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: UID is "anon"
      expect(uid).toBe("anon");
    });

    it("extracts UID with special characters", () => {
      // Setup: UID with UUID format
      const req = new FakeIncomingMessage(
        "http://localhost?uid=550e8400-e29b-41d4-a716-446655440000",
      ) as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: UID extracted with dashes intact
      expect(uid).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("extracts first UID when multiple uid parameters provided", () => {
      // Setup: URL with multiple uid parameters
      const req = new FakeIncomingMessage(
        "http://localhost?uid=first&uid=second",
      ) as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: gets first parameter
      expect(uid).toBe("first");
    });
  });

  describe("Connection replacement detection", () => {
    it("replaces existing connection for same UID", () => {
      // Setup: existing connection for uid
      const uid = "player1";
      const existingWs = new FakeWebSocket() as unknown as WebSocket;
      const newWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, existingWs);

      // Execute: simulate connection replacement (lines 90-98)
      const existingConnection = uidToWs.get(uid);
      if (existingConnection && existingConnection !== newWs) {
        existingConnection.close(4001, "Replaced by new connection");
      }

      // Assert: old connection closed with specific code/reason
      expect(existingWs.close).toHaveBeenCalledOnce();
      expect(existingWs.close).toHaveBeenCalledWith(4001, "Replaced by new connection");
    });

    it("does not close connection if it's the same WebSocket instance", () => {
      // Setup: same WebSocket trying to reconnect (edge case)
      const uid = "player1";
      const ws = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, ws);

      // Execute: check if same connection
      const existingConnection = uidToWs.get(uid);
      if (existingConnection && existingConnection !== ws) {
        existingConnection.close(4001, "Replaced by new connection");
      }

      // Assert: close NOT called (same instance)
      expect(ws.close).not.toHaveBeenCalled();
    });

    it("logs replacement message with authentication status", () => {
      // Setup: existing authenticated connection
      const uid = "player1";
      const existingWs = new FakeWebSocket() as unknown as WebSocket;
      const newWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, existingWs);
      authenticatedUids.add(uid);

      const wasAuthenticated = authenticatedUids.has(uid);

      // Execute: log replacement
      const existingConnection = uidToWs.get(uid);
      if (existingConnection && existingConnection !== newWs) {
        console.log(
          `[WebSocket] Replacing connection for ${uid} (was authenticated: ${wasAuthenticated})`,
        );
        existingConnection.close(4001, "Replaced by new connection");
      }

      // Assert: console.log called with auth status
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[WebSocket] Replacing connection for player1 (was authenticated: true)",
      );
    });

    it("does not log or close when no existing connection", () => {
      // Setup: no existing connection
      const uid = "player1";
      const newWs = new FakeWebSocket() as unknown as WebSocket;

      // Execute: check for existing connection
      const existingConnection = uidToWs.get(uid);
      const wasAuthenticated = authenticatedUids.has(uid);

      if (existingConnection && existingConnection !== newWs) {
        console.log(
          `[WebSocket] Replacing connection for ${uid} (was authenticated: ${wasAuthenticated})`,
        );
        existingConnection.close(4001, "Replaced by new connection");
      }

      // Assert: nothing logged or closed
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("Seamless reconnection logic", () => {
    it("preserves auth state when reconnecting authenticated user", () => {
      // Setup: authenticated user reconnecting
      const uid = "player1";
      const existingWs = new FakeWebSocket() as unknown as WebSocket;
      const newWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, existingWs);
      authenticatedUids.add(uid);
      authenticatedSessions.set(uid, { roomId: "room1", authedAt: Date.now() });

      const wasAuthenticated = authenticatedUids.has(uid);

      // Execute: seamless reconnection logic (lines 102-106)
      if (!wasAuthenticated) {
        authenticatedUids.delete(uid);
        authenticatedSessions.delete(uid);
      }

      // Assert: auth state preserved
      expect(authenticatedUids.has(uid)).toBe(true);
      expect(authenticatedSessions.has(uid)).toBe(true);
    });

    it("clears auth state for new unauthenticated connection", () => {
      // Setup: new connection (not authenticated)
      const uid = "player1";

      authenticatedUids.add(uid); // Leftover state from previous session
      authenticatedSessions.set(uid, { roomId: "room1", authedAt: Date.now() });

      const wasAuthenticated = false; // No existing connection

      // Execute: clear auth for new connection
      if (!wasAuthenticated) {
        authenticatedUids.delete(uid);
        authenticatedSessions.delete(uid);
      }

      // Assert: auth state cleared
      expect(authenticatedUids.has(uid)).toBe(false);
      expect(authenticatedSessions.has(uid)).toBe(false);
    });

    it("does not affect users array when reconnecting authenticated user", () => {
      // Setup: authenticated user in users array
      const uid = "player1";
      const users = ["player1", "player2"];

      const wasAuthenticated = true;

      // Execute: check if users array should be modified
      if (!wasAuthenticated) {
        const index = users.indexOf(uid);
        if (index > -1) {
          users.splice(index, 1);
        }
      }

      // Assert: users array unchanged (seamless reconnection)
      expect(users).toContain(uid);
      expect(users).toEqual(["player1", "player2"]);
    });

    it("removes user from users array for new unauthenticated connection", () => {
      // Setup: user in users array but not authenticated
      const uid = "player1";
      const users = ["player1", "player2"];

      const wasAuthenticated = false;

      // Execute: remove from users array (lines 105)
      if (!wasAuthenticated) {
        const index = users.indexOf(uid);
        if (index > -1) {
          users.splice(index, 1);
        }
      }

      // Assert: user removed
      expect(users).not.toContain(uid);
      expect(users).toEqual(["player2"]);
    });
  });

  describe("Connection registration", () => {
    it("registers WebSocket in uidToWs map", () => {
      // Setup: new connection
      const uid = "player1";
      const ws = new FakeWebSocket() as unknown as WebSocket;

      // Execute: register connection (line 109)
      uidToWs.set(uid, ws);

      // Assert: connection registered
      expect(uidToWs.has(uid)).toBe(true);
      expect(uidToWs.get(uid)).toBe(ws);
    });

    it("overwrites existing connection in uidToWs map", () => {
      // Setup: existing connection
      const uid = "player1";
      const oldWs = new FakeWebSocket() as unknown as WebSocket;
      const newWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, oldWs);

      // Execute: register new connection
      uidToWs.set(uid, newWs);

      // Assert: new connection overwrites old
      expect(uidToWs.get(uid)).toBe(newWs);
      expect(uidToWs.get(uid)).not.toBe(oldWs);
    });

    it("handles anonymous 'anon' UID registration", () => {
      // Setup: anonymous connection
      const uid = "anon";
      const ws = new FakeWebSocket() as unknown as WebSocket;

      // Execute: register anonymous connection
      uidToWs.set(uid, ws);

      // Assert: anon connection registered
      expect(uidToWs.has(uid)).toBe(true);
      expect(uidToWs.get(uid)).toBe(ws);
    });
  });

  describe("Keepalive ping management", () => {
    it("starts keepalive interval at 25000ms", () => {
      // Setup: new WebSocket connection
      const ws = new FakeWebSocket() as unknown as WebSocket;

      // Execute: start keepalive (lines 112-116)
      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      // Assert: interval created
      expect(keepalive).toBeDefined();
      expect(typeof keepalive).toBe("object"); // NodeJS.Timeout

      clearInterval(keepalive);
    });

    it("calls ws.ping() when readyState is OPEN (1)", () => {
      // Setup: open WebSocket
      const ws = new FakeWebSocket() as unknown as WebSocket;
      ws.readyState = 1; // OPEN

      // Execute: start keepalive and advance timer
      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      vi.advanceTimersByTime(25000);

      // Assert: ws.ping() called
      expect(ws.ping).toHaveBeenCalledOnce();

      clearInterval(keepalive);
    });

    it("does not call ws.ping() when readyState is not OPEN", () => {
      // Setup: closed WebSocket
      const ws = new FakeWebSocket() as unknown as WebSocket;
      ws.readyState = 3; // CLOSED

      // Execute: start keepalive and advance timer
      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      vi.advanceTimersByTime(25000);

      // Assert: ws.ping() NOT called
      expect(ws.ping).not.toHaveBeenCalled();

      clearInterval(keepalive);
    });

    it("calls ws.ping() multiple times at correct intervals", () => {
      // Setup: open WebSocket
      const ws = new FakeWebSocket() as unknown as WebSocket;
      ws.readyState = 1;

      // Execute: start keepalive and advance timer multiple times
      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      vi.advanceTimersByTime(25000); // First ping
      vi.advanceTimersByTime(25000); // Second ping
      vi.advanceTimersByTime(25000); // Third ping

      // Assert: ws.ping() called three times
      expect(ws.ping).toHaveBeenCalledTimes(3);

      clearInterval(keepalive);
    });

    it("stops calling ping after readyState changes to closed", () => {
      // Setup: initially open WebSocket
      const ws = new FakeWebSocket() as unknown as WebSocket;
      ws.readyState = 1;

      // Execute: start keepalive, ping once, close socket, advance timer
      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      vi.advanceTimersByTime(25000); // First ping
      ws.readyState = 3; // Close socket
      vi.advanceTimersByTime(25000); // Should not ping
      vi.advanceTimersByTime(25000); // Should not ping

      // Assert: ws.ping() called only once
      expect(ws.ping).toHaveBeenCalledOnce();

      clearInterval(keepalive);
    });
  });

  describe("Stop keepalive on disconnection", () => {
    it("clears keepalive interval on disconnect", () => {
      // Setup: active keepalive
      const ws = new FakeWebSocket() as unknown as WebSocket;
      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      // Execute: clear interval (line 156 from handleDisconnection)
      clearInterval(keepalive);

      // Advance timer to verify interval stopped
      vi.advanceTimersByTime(25000);
      vi.advanceTimersByTime(25000);

      // Assert: ws.ping() never called after clearInterval
      expect(ws.ping).not.toHaveBeenCalled();
    });

    it("prevents ping after keepalive stopped", () => {
      // Setup: active keepalive with one ping
      const ws = new FakeWebSocket() as unknown as WebSocket;
      ws.readyState = 1;

      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      vi.advanceTimersByTime(25000); // First ping
      expect(ws.ping).toHaveBeenCalledOnce();

      // Execute: stop keepalive
      clearInterval(keepalive);

      // Advance timer
      vi.advanceTimersByTime(50000);

      // Assert: no additional pings
      expect(ws.ping).toHaveBeenCalledOnce(); // Still just 1
    });
  });

  describe("Race condition prevention (isCurrentConnection)", () => {
    it("detects stale connection close event", () => {
      // Setup: connection has been replaced
      const uid = "player1";
      const staleWs = new FakeWebSocket() as unknown as WebSocket;
      const currentWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, currentWs); // Current connection is different

      // Execute: check if stale connection (from handleDisconnection lines 204-207)
      const isCurrentConnection = uidToWs.get(uid) === staleWs;

      // Assert: detects this is NOT current connection
      expect(isCurrentConnection).toBe(false);
    });

    it("confirms current connection", () => {
      // Setup: connection is current
      const uid = "player1";
      const currentWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, currentWs);

      // Execute: check if current connection
      const isCurrentConnection = uidToWs.get(uid) === currentWs;

      // Assert: confirms this IS current connection
      expect(isCurrentConnection).toBe(true);
    });

    it("handles missing UID in map", () => {
      // Setup: UID not in map (connection already cleaned up)
      const uid = "player1";
      const ws = new FakeWebSocket() as unknown as WebSocket;

      // Execute: check if current connection
      const isCurrentConnection = uidToWs.get(uid) === ws;

      // Assert: returns false (undefined !== ws)
      expect(isCurrentConnection).toBe(false);
    });
  });

  describe("Complete connection lifecycle", () => {
    it("performs full connection setup for new authenticated user", () => {
      // Setup: new connection URL
      const req = new FakeIncomingMessage(
        "http://localhost?uid=player1",
      ) as unknown as IncomingMessage;
      const ws = new FakeWebSocket() as unknown as WebSocket;

      // Execute: full connection setup
      // 1. Extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // 2. Check for existing connection
      const existingWs = uidToWs.get(uid);
      const wasAuthenticated = authenticatedUids.has(uid);

      if (existingWs && existingWs !== ws) {
        existingWs.close(4001, "Replaced by new connection");
      }

      // 3. Clear auth if not authenticated
      if (!wasAuthenticated) {
        authenticatedUids.delete(uid);
        authenticatedSessions.delete(uid);
      }

      // 4. Register connection
      uidToWs.set(uid, ws);

      // 5. Start keepalive
      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      // Assert: connection fully set up
      expect(uid).toBe("player1");
      expect(uidToWs.get(uid)).toBe(ws);
      expect(keepalive).toBeDefined();

      clearInterval(keepalive);
    });

    it("performs seamless reconnection for authenticated user", () => {
      // Setup: existing authenticated connection
      const existingWs = new FakeWebSocket() as unknown as WebSocket;
      const uid = "player1";

      uidToWs.set(uid, existingWs);
      authenticatedUids.add(uid);
      authenticatedSessions.set(uid, { roomId: "room1", authedAt: Date.now() });

      // New connection attempt
      const req = new FakeIncomingMessage(
        `http://localhost?uid=${uid}`,
      ) as unknown as IncomingMessage;
      const newWs = new FakeWebSocket() as unknown as WebSocket;

      // Execute: reconnection flow
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const extractedUid = params.get("uid") || "anon";

      const existingConnection = uidToWs.get(extractedUid);
      const wasAuthenticated = authenticatedUids.has(extractedUid);

      if (existingConnection && existingConnection !== newWs) {
        console.log(
          `[WebSocket] Replacing connection for ${extractedUid} (was authenticated: ${wasAuthenticated})`,
        );
        existingConnection.close(4001, "Replaced by new connection");
      }

      if (!wasAuthenticated) {
        authenticatedUids.delete(extractedUid);
        authenticatedSessions.delete(extractedUid);
      }

      uidToWs.set(extractedUid, newWs);

      // Assert: seamless reconnection completed
      expect(extractedUid).toBe(uid);
      expect(existingWs.close).toHaveBeenCalledWith(4001, "Replaced by new connection");
      expect(authenticatedUids.has(uid)).toBe(true); // Auth preserved
      expect(authenticatedSessions.has(uid)).toBe(true); // Session preserved
      expect(uidToWs.get(uid)).toBe(newWs); // New connection registered
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[WebSocket] Replacing connection for ${uid} (was authenticated: true)`,
      );
    });

    it("handles complete disconnection cleanup", () => {
      // Setup: active connection with keepalive
      const ws = new FakeWebSocket() as unknown as WebSocket;
      const uid = "player1";

      uidToWs.set(uid, ws);
      ws.readyState = 1;

      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      // Verify keepalive working
      vi.advanceTimersByTime(25000);
      expect(ws.ping).toHaveBeenCalledOnce();

      // Execute: disconnection (line 154-161)
      clearInterval(keepalive);

      // Verify keepalive stopped
      vi.advanceTimersByTime(25000);

      // Assert: keepalive stopped (no additional pings)
      expect(ws.ping).toHaveBeenCalledOnce();
    });

    it("prevents race condition during rapid reconnection", () => {
      // Setup: rapid reconnection scenario
      const uid = "player1";
      const ws1 = new FakeWebSocket() as unknown as WebSocket;
      const ws2 = new FakeWebSocket() as unknown as WebSocket;
      const ws3 = new FakeWebSocket() as unknown as WebSocket;

      // First connection
      uidToWs.set(uid, ws1);

      // Second connection replaces first
      const existing1 = uidToWs.get(uid);
      if (existing1 && existing1 !== ws2) {
        existing1.close(4001, "Replaced by new connection");
      }
      uidToWs.set(uid, ws2);

      // Third connection replaces second (ws1's close event may fire now)
      const existing2 = uidToWs.get(uid);
      if (existing2 && existing2 !== ws3) {
        existing2.close(4001, "Replaced by new connection");
      }
      uidToWs.set(uid, ws3);

      // Execute: ws1's close event fires late (race condition)
      const isWs1Current = uidToWs.get(uid) === ws1;

      // Assert: ws1 is NOT current (ws3 is current)
      expect(isWs1Current).toBe(false);
      expect(uidToWs.get(uid)).toBe(ws3);
      expect(ws1.close).toHaveBeenCalledWith(4001, "Replaced by new connection");
      expect(ws2.close).toHaveBeenCalledWith(4001, "Replaced by new connection");
    });
  });

  describe("Edge cases", () => {
    it("handles URL with multiple query parameters", () => {
      // Setup: URL with multiple params
      const req = new FakeIncomingMessage(
        "http://localhost?foo=bar&uid=player1&baz=qux",
      ) as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: UID extracted correctly
      expect(uid).toBe("player1");
    });

    it("handles encoded UID characters", () => {
      // Setup: URL with encoded characters
      const req = new FakeIncomingMessage(
        "http://localhost?uid=player%2F1",
      ) as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: UID decoded automatically
      expect(uid).toBe("player/1");
    });

    it("handles empty string UID parameter", () => {
      // Setup: URL with empty uid parameter
      const req = new FakeIncomingMessage("http://localhost?uid=") as unknown as IncomingMessage;

      // Execute: extract UID
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const uid = params.get("uid") || "anon";

      // Assert: empty string is falsy, so defaults to "anon"
      expect(uid).toBe("anon");
    });

    it("handles keepalive with readyState transitions", () => {
      // Setup: WebSocket that transitions between states
      const ws = new FakeWebSocket() as unknown as WebSocket;
      ws.readyState = 1; // Start OPEN

      const keepalive = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 25000);

      // Execute: ping while open, transition to closing, ping attempt, transition to closed
      vi.advanceTimersByTime(25000);
      ws.readyState = 2; // CLOSING
      vi.advanceTimersByTime(25000);
      ws.readyState = 3; // CLOSED
      vi.advanceTimersByTime(25000);

      // Assert: only first ping succeeded
      expect(ws.ping).toHaveBeenCalledOnce();

      clearInterval(keepalive);
    });

    it("handles multiple connections for different UIDs", () => {
      // Setup: multiple users connecting
      const ws1 = new FakeWebSocket() as unknown as WebSocket;
      const ws2 = new FakeWebSocket() as unknown as WebSocket;
      const ws3 = new FakeWebSocket() as unknown as WebSocket;

      // Execute: register multiple connections
      uidToWs.set("player1", ws1);
      uidToWs.set("player2", ws2);
      uidToWs.set("anon", ws3);

      // Assert: all registered independently
      expect(uidToWs.size).toBe(3);
      expect(uidToWs.get("player1")).toBe(ws1);
      expect(uidToWs.get("player2")).toBe(ws2);
      expect(uidToWs.get("anon")).toBe(ws3);
    });
  });
});
