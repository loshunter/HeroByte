/**
 * Characterization tests for AuthenticationManager
 *
 * These tests lock in the existing behavior to ensure
 * zero behavioral changes during refactoring.
 *
 * Tests cover:
 * - Initial authentication state (UNAUTHENTICATED)
 * - Authentication state transitions (PENDING, AUTHENTICATED, FAILED)
 * - Authentication event emission (reset, pending, success, failure)
 * - Authentication message sending
 * - Auth response handling (auth-ok, auth-failed)
 * - Reset behavior on disconnect
 * - Cannot authenticate when socket not open
 * - Re-authentication when already authenticated
 *
 * Source: apps/client/src/services/websocket.ts
 * - authState property (line 78)
 * - authenticate() method (lines 193-203)
 * - handleAuthResponse() method (lines 253-262)
 * - Auth state transitions in connect/disconnect
 *
 * Extracted to: apps/client/src/services/websocket/AuthenticationManager.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthenticationManager } from "../websocket/AuthenticationManager";
import { AuthState } from "../websocket";

describe("AuthenticationManager - Characterization Tests", () => {
  let authManager: AuthenticationManager;
  let mockOnAuthEvent: ReturnType<typeof vi.fn>;
  let mockWebSocket: WebSocket;

  beforeEach(() => {
    mockOnAuthEvent = vi.fn();
    vi.clearAllMocks();

    // Create mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    authManager = new AuthenticationManager({
      onAuthEvent: mockOnAuthEvent,
    });
  });

  describe("Initial State", () => {
    it("should start in UNAUTHENTICATED state", () => {
      expect(authManager.getAuthState()).toBe(AuthState.UNAUTHENTICATED);
    });

    it("should start with isAuthenticated() returning false", () => {
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe("Authentication Process", () => {
    it("should transition to PENDING state when authenticate() is called", () => {
      authManager.authenticate(mockWebSocket, "test-secret");

      expect(authManager.getAuthState()).toBe(AuthState.PENDING);
    });

    it("should emit 'pending' auth event when authenticate() is called", () => {
      authManager.authenticate(mockWebSocket, "test-secret");

      expect(mockOnAuthEvent).toHaveBeenCalledOnce();
      expect(mockOnAuthEvent).toHaveBeenCalledWith({ type: "pending" });
    });

    it("should send authenticate message to WebSocket with secret", () => {
      authManager.authenticate(mockWebSocket, "test-secret-123");

      expect(mockWebSocket.send).toHaveBeenCalledOnce();
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ t: "authenticate", secret: "test-secret-123" }),
      );
    });

    it("should send authenticate message with optional roomId", () => {
      authManager.authenticate(mockWebSocket, "test-secret", "room-456");

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          t: "authenticate",
          secret: "test-secret",
          roomId: "room-456",
        }),
      );
    });

    it("should send authenticate message without roomId when not provided", () => {
      authManager.authenticate(mockWebSocket, "secret-only");

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ t: "authenticate", secret: "secret-only" }),
      );
    });

    it("should NOT send authenticate message when WebSocket is null", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      authManager.authenticate(null, "test-secret");

      expect(mockOnAuthEvent).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[WebSocket] Cannot authenticate before socket is open",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should NOT send authenticate message when WebSocket is not OPEN", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const closedWebSocket = {
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
      } as unknown as WebSocket;

      authManager.authenticate(closedWebSocket, "test-secret");

      expect(closedWebSocket.send).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[WebSocket] Cannot authenticate before socket is open",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should NOT send authenticate message when WebSocket is CONNECTING", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const connectingWebSocket = {
        readyState: WebSocket.CONNECTING,
        send: vi.fn(),
      } as unknown as WebSocket;

      authManager.authenticate(connectingWebSocket, "test-secret");

      expect(connectingWebSocket.send).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Auth Response Handling - Success (auth-ok)", () => {
    it("should transition to AUTHENTICATED state on auth-ok response", () => {
      authManager.handleAuthResponse({ t: "auth-ok" });

      expect(authManager.getAuthState()).toBe(AuthState.AUTHENTICATED);
    });

    it("should emit 'success' auth event on auth-ok response", () => {
      authManager.handleAuthResponse({ t: "auth-ok" });

      expect(mockOnAuthEvent).toHaveBeenCalledOnce();
      expect(mockOnAuthEvent).toHaveBeenCalledWith({ type: "success" });
    });

    it("should set isAuthenticated() to true after auth-ok", () => {
      authManager.handleAuthResponse({ t: "auth-ok" });

      expect(authManager.isAuthenticated()).toBe(true);
    });
  });

  describe("Auth Response Handling - Failure (auth-failed)", () => {
    it("should transition to FAILED state on auth-failed response", () => {
      authManager.handleAuthResponse({
        t: "auth-failed",
        reason: "Invalid credentials",
      });

      expect(authManager.getAuthState()).toBe(AuthState.FAILED);
    });

    it("should emit 'failure' auth event on auth-failed response with reason", () => {
      authManager.handleAuthResponse({
        t: "auth-failed",
        reason: "Invalid credentials",
      });

      expect(mockOnAuthEvent).toHaveBeenCalledOnce();
      expect(mockOnAuthEvent).toHaveBeenCalledWith({
        type: "failure",
        reason: "Invalid credentials",
      });
    });

    it("should emit 'failure' auth event without reason when not provided", () => {
      authManager.handleAuthResponse({ t: "auth-failed" });

      expect(mockOnAuthEvent).toHaveBeenCalledWith({
        type: "failure",
        reason: undefined,
      });
    });

    it("should set isAuthenticated() to false after auth-failed", () => {
      authManager.handleAuthResponse({ t: "auth-failed" });

      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe("Reset Behavior", () => {
    it("should reset to UNAUTHENTICATED state when reset() is called", () => {
      // First authenticate
      authManager.authenticate(mockWebSocket, "secret");
      authManager.handleAuthResponse({ t: "auth-ok" });
      expect(authManager.getAuthState()).toBe(AuthState.AUTHENTICATED);

      // Then reset
      authManager.reset();

      expect(authManager.getAuthState()).toBe(AuthState.UNAUTHENTICATED);
    });

    it("should emit 'reset' auth event when reset() is called", () => {
      // First authenticate
      authManager.authenticate(mockWebSocket, "secret");
      mockOnAuthEvent.mockClear();

      // Then reset
      authManager.reset();

      expect(mockOnAuthEvent).toHaveBeenCalledOnce();
      expect(mockOnAuthEvent).toHaveBeenCalledWith({ type: "reset" });
    });

    it("should set isAuthenticated() to false after reset()", () => {
      // First authenticate
      authManager.authenticate(mockWebSocket, "secret");
      authManager.handleAuthResponse({ t: "auth-ok" });
      expect(authManager.isAuthenticated()).toBe(true);

      // Then reset
      authManager.reset();

      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe("Re-authentication Scenarios", () => {
    it("should allow re-authentication when already authenticated", () => {
      // First authentication
      authManager.authenticate(mockWebSocket, "secret-1");
      authManager.handleAuthResponse({ t: "auth-ok" });
      expect(authManager.getAuthState()).toBe(AuthState.AUTHENTICATED);

      // Second authentication attempt
      authManager.authenticate(mockWebSocket, "secret-2");

      expect(authManager.getAuthState()).toBe(AuthState.PENDING);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockWebSocket.send).toHaveBeenLastCalledWith(
        JSON.stringify({ t: "authenticate", secret: "secret-2" }),
      );
    });

    it("should allow re-authentication after failed attempt", () => {
      // First authentication fails
      authManager.authenticate(mockWebSocket, "wrong-secret");
      authManager.handleAuthResponse({
        t: "auth-failed",
        reason: "Invalid credentials",
      });
      expect(authManager.getAuthState()).toBe(AuthState.FAILED);

      // Second authentication attempt
      authManager.authenticate(mockWebSocket, "correct-secret");

      expect(authManager.getAuthState()).toBe(AuthState.PENDING);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });
  });

  describe("State Query Methods", () => {
    it("should return current auth state via getAuthState()", () => {
      expect(authManager.getAuthState()).toBe(AuthState.UNAUTHENTICATED);

      authManager.authenticate(mockWebSocket, "secret");
      expect(authManager.getAuthState()).toBe(AuthState.PENDING);

      authManager.handleAuthResponse({ t: "auth-ok" });
      expect(authManager.getAuthState()).toBe(AuthState.AUTHENTICATED);

      authManager.reset();
      expect(authManager.getAuthState()).toBe(AuthState.UNAUTHENTICATED);
    });

    it("should only return true for isAuthenticated() when state is AUTHENTICATED", () => {
      expect(authManager.isAuthenticated()).toBe(false); // UNAUTHENTICATED

      authManager.authenticate(mockWebSocket, "secret");
      expect(authManager.isAuthenticated()).toBe(false); // PENDING

      authManager.handleAuthResponse({ t: "auth-ok" });
      expect(authManager.isAuthenticated()).toBe(true); // AUTHENTICATED

      authManager.reset();
      expect(authManager.isAuthenticated()).toBe(false); // UNAUTHENTICATED
    });
  });

  describe("Auth Event Callbacks", () => {
    it("should NOT crash when onAuthEvent callback is undefined", () => {
      const managerNoCallback = new AuthenticationManager({});

      expect(() => {
        managerNoCallback.authenticate(mockWebSocket, "secret");
      }).not.toThrow();

      expect(() => {
        managerNoCallback.handleAuthResponse({ t: "auth-ok" });
      }).not.toThrow();

      expect(() => {
        managerNoCallback.reset();
      }).not.toThrow();
    });

    it("should call onAuthEvent for each state transition", () => {
      // authenticate() -> pending
      authManager.authenticate(mockWebSocket, "secret");
      expect(mockOnAuthEvent).toHaveBeenNthCalledWith(1, { type: "pending" });

      // auth-ok -> success
      authManager.handleAuthResponse({ t: "auth-ok" });
      expect(mockOnAuthEvent).toHaveBeenNthCalledWith(2, { type: "success" });

      // reset() -> reset
      authManager.reset();
      expect(mockOnAuthEvent).toHaveBeenNthCalledWith(3, { type: "reset" });

      expect(mockOnAuthEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle authenticate() called multiple times before response", () => {
      authManager.authenticate(mockWebSocket, "secret-1");
      authManager.authenticate(mockWebSocket, "secret-2");
      authManager.authenticate(mockWebSocket, "secret-3");

      // Should still be in PENDING state
      expect(authManager.getAuthState()).toBe(AuthState.PENDING);
      // Should have sent 3 messages
      expect(mockWebSocket.send).toHaveBeenCalledTimes(3);
      // Should have emitted 3 pending events
      expect(mockOnAuthEvent).toHaveBeenCalledTimes(3);
    });

    it("should handle auth response received when already authenticated", () => {
      // First auth
      authManager.authenticate(mockWebSocket, "secret");
      authManager.handleAuthResponse({ t: "auth-ok" });
      expect(authManager.getAuthState()).toBe(AuthState.AUTHENTICATED);

      // Second auth-ok response (perhaps delayed)
      authManager.handleAuthResponse({ t: "auth-ok" });

      // Should still be authenticated
      expect(authManager.getAuthState()).toBe(AuthState.AUTHENTICATED);
      // Should have emitted success event twice
      expect(mockOnAuthEvent).toHaveBeenCalledWith({ type: "success" });
    });

    it("should handle auth-failed response when already failed", () => {
      authManager.authenticate(mockWebSocket, "secret");
      authManager.handleAuthResponse({ t: "auth-failed", reason: "First failure" });
      expect(authManager.getAuthState()).toBe(AuthState.FAILED);

      // Second failure
      authManager.handleAuthResponse({ t: "auth-failed", reason: "Second failure" });

      // Should still be failed
      expect(authManager.getAuthState()).toBe(AuthState.FAILED);
    });

    it("should handle reset() when already unauthenticated", () => {
      expect(authManager.getAuthState()).toBe(AuthState.UNAUTHENTICATED);

      authManager.reset();

      expect(authManager.getAuthState()).toBe(AuthState.UNAUTHENTICATED);
      expect(mockOnAuthEvent).toHaveBeenCalledWith({ type: "reset" });
    });
  });
});
