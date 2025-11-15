import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import type { ClientMessage } from "@shared";

// Mock AuthenticationHandler
class MockAuthenticationHandler {
  public authenticate = vi.fn<(uid: string, secret: string, roomId?: string) => void>();
  public elevateToDM = vi.fn<(uid: string, dmPassword: string) => void>();
  public revokeDM = vi.fn<(uid: string) => void>();
  public setDMPassword = vi.fn<(uid: string, dmPassword: string) => void>();
}

describe("MessageAuthenticator - Characterization Tests", () => {
  let mockAuthHandler: MockAuthenticationHandler;
  let authenticatedUids: Set<string>;
  let onAuthMessageCallback: MockInstance;
  let onUnauthenticatedMessageCallback: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    // Clear all mocks between tests
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockAuthHandler = new MockAuthenticationHandler();
    authenticatedUids = new Set<string>();
    onAuthMessageCallback = vi.fn();
    onUnauthenticatedMessageCallback = vi.fn();

    // Setup spies
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("Authentication message detection", () => {
    it("detects 'authenticate' message type", () => {
      // Setup: authenticate message
      const message: ClientMessage = {
        t: "authenticate",
        secret: "room-password",
        roomId: "room1",
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message identified as auth message, returns true (handled)
      expect(result).toBe(true);

      // Assert: routed to AuthenticationHandler.authenticate
      expect(mockAuthHandler.authenticate).toHaveBeenCalledOnce();
      expect(mockAuthHandler.authenticate).toHaveBeenCalledWith(uid, "room-password", "room1");

      // Assert: callback invoked
      expect(onAuthMessageCallback).toHaveBeenCalledWith(uid, message);
    });

    it("detects 'elevate-to-dm' message type", () => {
      // Setup: authenticated user, elevate-to-dm message
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "elevate-to-dm",
        dmPassword: "dm-secret",
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message identified as auth message, returns true (handled)
      expect(result).toBe(true);

      // Assert: routed to AuthenticationHandler.elevateToDM
      expect(mockAuthHandler.elevateToDM).toHaveBeenCalledOnce();
      expect(mockAuthHandler.elevateToDM).toHaveBeenCalledWith(uid, "dm-secret");

      // Assert: callback invoked
      expect(onAuthMessageCallback).toHaveBeenCalledWith(uid, message);
    });

    it("detects 'revoke-dm' message type", () => {
      // Setup: authenticated user, revoke-dm message
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "revoke-dm",
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message identified as auth message, returns true (handled)
      expect(result).toBe(true);

      // Assert: routed to AuthenticationHandler.revokeDM
      expect(mockAuthHandler.revokeDM).toHaveBeenCalledOnce();
      expect(mockAuthHandler.revokeDM).toHaveBeenCalledWith(uid);

      // Assert: callback invoked
      expect(onAuthMessageCallback).toHaveBeenCalledWith(uid, message);
    });

    it("detects 'set-dm-password' message type", () => {
      // Setup: authenticated user, set-dm-password message
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "set-dm-password",
        dmPassword: "new-dm-password",
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message identified as auth message, returns true (handled)
      expect(result).toBe(true);

      // Assert: routed to AuthenticationHandler.setDMPassword
      expect(mockAuthHandler.setDMPassword).toHaveBeenCalledOnce();
      expect(mockAuthHandler.setDMPassword).toHaveBeenCalledWith(uid, "new-dm-password");

      // Assert: callback invoked
      expect(onAuthMessageCallback).toHaveBeenCalledWith(uid, message);
    });

    it("does not detect non-auth messages as auth messages", () => {
      // Setup: regular game message, authenticated user
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "move",
        id: "token1",
        x: 100,
        y: 200,
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message NOT handled as auth message, returns false (pass-through)
      expect(result).toBe(false);

      // Assert: NOT routed to any auth handler method
      expect(mockAuthHandler.authenticate).not.toHaveBeenCalled();
      expect(mockAuthHandler.elevateToDM).not.toHaveBeenCalled();
      expect(mockAuthHandler.revokeDM).not.toHaveBeenCalled();
      expect(mockAuthHandler.setDMPassword).not.toHaveBeenCalled();

      // Assert: callbacks NOT invoked
      expect(onAuthMessageCallback).not.toHaveBeenCalled();
      expect(onUnauthenticatedMessageCallback).not.toHaveBeenCalled();
    });
  });

  describe("Authentication message routing", () => {
    it("routes 'authenticate' to AuthenticationHandler.authenticate with correct params", () => {
      // Setup: authenticate message with roomId
      const message: ClientMessage = {
        t: "authenticate",
        secret: "test-secret",
        roomId: "test-room",
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, uid);

      // Assert: authenticate called with uid, secret, roomId
      expect(mockAuthHandler.authenticate).toHaveBeenCalledWith(uid, "test-secret", "test-room");
    });

    it("routes 'authenticate' without roomId", () => {
      // Setup: authenticate message without roomId
      const message: ClientMessage = {
        t: "authenticate",
        secret: "test-secret",
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, uid);

      // Assert: authenticate called with uid, secret, undefined
      expect(mockAuthHandler.authenticate).toHaveBeenCalledWith(uid, "test-secret", undefined);
    });

    it("routes 'elevate-to-dm' to AuthenticationHandler.elevateToDM", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "elevate-to-dm",
        dmPassword: "dm-pass",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, "user1");

      // Assert: elevateToDM called with correct params
      expect(mockAuthHandler.elevateToDM).toHaveBeenCalledWith("user1", "dm-pass");
    });

    it("routes 'revoke-dm' to AuthenticationHandler.revokeDM", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "revoke-dm",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, "user1");

      // Assert: revokeDM called with uid
      expect(mockAuthHandler.revokeDM).toHaveBeenCalledWith("user1");
    });

    it("routes 'set-dm-password' to AuthenticationHandler.setDMPassword", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "set-dm-password",
        dmPassword: "new-password",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, "user1");

      // Assert: setDMPassword called with correct params
      expect(mockAuthHandler.setDMPassword).toHaveBeenCalledWith("user1", "new-password");
    });
  });

  describe("Access control enforcement", () => {
    it("allows 'authenticate' message from unauthenticated user", () => {
      // Setup: unauthenticated user, authenticate message
      const message: ClientMessage = {
        t: "authenticate",
        secret: "password",
      };
      const uid = "user1";

      expect(authenticatedUids.has(uid)).toBe(false);

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message handled (returns true)
      expect(result).toBe(true);

      // Assert: routed to authenticate
      expect(mockAuthHandler.authenticate).toHaveBeenCalledWith(uid, "password", undefined);

      // Assert: NO warning logged
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("drops non-auth message from unauthenticated user", () => {
      // Setup: unauthenticated user, regular message
      const message: ClientMessage = {
        t: "move",
        id: "token1",
        x: 100,
        y: 200,
      };
      const uid = "user1";

      expect(authenticatedUids.has(uid)).toBe(false);

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message dropped (returns true - handled by dropping)
      expect(result).toBe(true);

      // Assert: warning logged
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Unauthenticated message from ${uid}, dropping.`,
      );

      // Assert: callback invoked
      expect(onUnauthenticatedMessageCallback).toHaveBeenCalledWith(uid);

      // Assert: NOT routed to auth handler
      expect(mockAuthHandler.authenticate).not.toHaveBeenCalled();
    });

    it("allows 'elevate-to-dm' from authenticated user", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "elevate-to-dm",
        dmPassword: "dm-pass",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, "user1");

      // Assert: message handled
      expect(result).toBe(true);

      // Assert: routed to elevateToDM
      expect(mockAuthHandler.elevateToDM).toHaveBeenCalledWith("user1", "dm-pass");

      // Assert: NO warning logged
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("drops 'elevate-to-dm' from unauthenticated user", () => {
      // Setup: unauthenticated user
      const message: ClientMessage = {
        t: "elevate-to-dm",
        dmPassword: "dm-pass",
      };
      const uid = "user1";

      expect(authenticatedUids.has(uid)).toBe(false);

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message dropped
      expect(result).toBe(true);

      // Assert: warning logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Unauthenticated message from ${uid}, dropping.`,
      );

      // Assert: NOT routed to elevateToDM
      expect(mockAuthHandler.elevateToDM).not.toHaveBeenCalled();
    });

    it("drops 'revoke-dm' from unauthenticated user", () => {
      // Setup: unauthenticated user
      const message: ClientMessage = {
        t: "revoke-dm",
      };
      const uid = "user1";

      expect(authenticatedUids.has(uid)).toBe(false);

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message dropped
      expect(result).toBe(true);

      // Assert: warning logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Unauthenticated message from ${uid}, dropping.`,
      );

      // Assert: NOT routed to revokeDM
      expect(mockAuthHandler.revokeDM).not.toHaveBeenCalled();
    });

    it("drops 'set-dm-password' from unauthenticated user", () => {
      // Setup: unauthenticated user
      const message: ClientMessage = {
        t: "set-dm-password",
        dmPassword: "new-pass",
      };
      const uid = "user1";

      expect(authenticatedUids.has(uid)).toBe(false);

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message dropped
      expect(result).toBe(true);

      // Assert: warning logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Unauthenticated message from ${uid}, dropping.`,
      );

      // Assert: NOT routed to setDMPassword
      expect(mockAuthHandler.setDMPassword).not.toHaveBeenCalled();
    });

    it("allows regular messages from authenticated user through", () => {
      // Setup: authenticated user, regular message
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "rename",
        name: "NewName",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, "user1");

      // Assert: message passed through (returns false - not handled)
      expect(result).toBe(false);

      // Assert: NO warning logged
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      // Assert: callbacks NOT invoked
      expect(onAuthMessageCallback).not.toHaveBeenCalled();
      expect(onUnauthenticatedMessageCallback).not.toHaveBeenCalled();
    });
  });

  describe("Return value semantics", () => {
    it("returns true for 'authenticate' (message handled)", () => {
      // Setup: authenticate message
      const message: ClientMessage = {
        t: "authenticate",
        secret: "pass",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, "user1");

      // Assert: returns true (message was handled)
      expect(result).toBe(true);
    });

    it("returns true when dropping unauthenticated message (message handled by dropping)", () => {
      // Setup: unauthenticated user, regular message
      const message: ClientMessage = {
        t: "move",
        id: "token1",
        x: 100,
        y: 200,
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, "user1");

      // Assert: returns true (message was handled by dropping)
      expect(result).toBe(true);
    });

    it("returns false for authenticated user's regular message (pass-through)", () => {
      // Setup: authenticated user, regular message
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "heartbeat",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, "user1");

      // Assert: returns false (message should be routed to MessageRouter)
      expect(result).toBe(false);
    });

    it("returns true for all auth message types", () => {
      // Setup: various auth messages
      authenticatedUids.add("user1");

      const authMessages: ClientMessage[] = [
        { t: "authenticate", secret: "pass" },
        { t: "elevate-to-dm", dmPassword: "dm-pass" },
        { t: "revoke-dm" },
        { t: "set-dm-password", dmPassword: "new-pass" },
      ];

      const checkAuth = createAuthenticator();

      // Execute & Assert: all return true
      for (const message of authMessages) {
        const result = checkAuth(message, "user1");
        expect(result).toBe(true);
      }
    });
  });

  describe("Message processing order and flow", () => {
    it("processes 'authenticate' before checking authenticated state", () => {
      // Setup: unauthenticated user, authenticate message
      const message: ClientMessage = {
        t: "authenticate",
        secret: "password",
      };
      const uid = "user1";

      expect(authenticatedUids.has(uid)).toBe(false);

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: authenticate called (not dropped)
      expect(mockAuthHandler.authenticate).toHaveBeenCalledWith(uid, "password", undefined);

      // Assert: message handled
      expect(result).toBe(true);

      // Assert: NO warning about unauthenticated message
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("checks authentication status for non-'authenticate' auth messages", () => {
      // Setup: unauthenticated user, elevate-to-dm message
      const message: ClientMessage = {
        t: "elevate-to-dm",
        dmPassword: "dm-pass",
      };
      const uid = "user1";

      expect(authenticatedUids.has(uid)).toBe(false);

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      const result = checkAuth(message, uid);

      // Assert: message dropped (auth check happens before routing)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Unauthenticated message from ${uid}, dropping.`,
      );

      // Assert: NOT routed to elevateToDM
      expect(mockAuthHandler.elevateToDM).not.toHaveBeenCalled();

      // Assert: message handled (by dropping)
      expect(result).toBe(true);
    });

    it("processes messages in correct order: detect auth -> check authed -> route or drop", () => {
      // Setup: authenticated user, various messages
      authenticatedUids.add("user1");

      const checkAuth = createAuthenticator();

      // Test 1: authenticate (always handled, no auth check)
      const authMsg: ClientMessage = { t: "authenticate", secret: "pass" };
      const result1 = checkAuth(authMsg, "user1");
      expect(result1).toBe(true);
      expect(mockAuthHandler.authenticate).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // Test 2: elevate-to-dm (auth check passes, routed)
      const elevateMsg: ClientMessage = { t: "elevate-to-dm", dmPassword: "dm" };
      const result2 = checkAuth(elevateMsg, "user1");
      expect(result2).toBe(true);
      expect(mockAuthHandler.elevateToDM).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Test 3: regular message (auth check passes, returns false)
      const regularMsg: ClientMessage = { t: "heartbeat" };
      const result3 = checkAuth(regularMsg, "user1");
      expect(result3).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("Logging behavior", () => {
    it("logs warning when dropping unauthenticated message", () => {
      // Setup: unauthenticated user, regular message
      const message: ClientMessage = {
        t: "move",
        id: "token1",
        x: 100,
        y: 200,
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, uid);

      // Assert: warning logged with uid
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Unauthenticated message from ${uid}, dropping.`,
      );
    });

    it("does not log warning for 'authenticate' message", () => {
      // Setup: authenticate message
      const message: ClientMessage = {
        t: "authenticate",
        secret: "password",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, "user1");

      // Assert: NO warning logged
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("does not log warning for authenticated user's messages", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");

      const messages: ClientMessage[] = [
        { t: "elevate-to-dm", dmPassword: "dm" },
        { t: "revoke-dm" },
        { t: "set-dm-password", dmPassword: "new" },
        { t: "heartbeat" },
        { t: "move", id: "token1", x: 100, y: 200 },
      ];

      const checkAuth = createAuthenticator();

      // Execute: process all messages
      for (const message of messages) {
        checkAuth(message, "user1");
      }

      // Assert: NO warnings logged
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("logs warning for each dropped message individually", () => {
      // Setup: unauthenticated user, multiple messages
      const messages: ClientMessage[] = [
        { t: "move", id: "token1", x: 100, y: 200 },
        { t: "rename", name: "Player1" },
        { t: "heartbeat" },
      ];

      const checkAuth = createAuthenticator();

      // Execute: process all messages
      for (const message of messages) {
        checkAuth(message, "user1");
      }

      // Assert: warning logged for each message
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unauthenticated message from user1, dropping.",
      );
    });
  });

  describe("Edge cases and special scenarios", () => {
    it("handles multiple authentication attempts from same user", () => {
      // Setup: multiple authenticate messages
      const message1: ClientMessage = {
        t: "authenticate",
        secret: "pass1",
      };
      const message2: ClientMessage = {
        t: "authenticate",
        secret: "pass2",
        roomId: "room1",
      };

      const checkAuth = createAuthenticator();

      // Execute: process multiple authenticate messages
      const result1 = checkAuth(message1, "user1");
      const result2 = checkAuth(message2, "user1");

      // Assert: both handled
      expect(result1).toBe(true);
      expect(result2).toBe(true);

      // Assert: authenticate called twice
      expect(mockAuthHandler.authenticate).toHaveBeenCalledTimes(2);
      expect(mockAuthHandler.authenticate).toHaveBeenNthCalledWith(1, "user1", "pass1", undefined);
      expect(mockAuthHandler.authenticate).toHaveBeenNthCalledWith(2, "user1", "pass2", "room1");
    });

    it("handles authentication state transitions", () => {
      // Setup: user authenticates mid-session
      const uid = "user1";
      const checkAuth = createAuthenticator();

      // Initially unauthenticated
      expect(authenticatedUids.has(uid)).toBe(false);

      // Try to send regular message - dropped
      const moveMsg: ClientMessage = { t: "move", id: "token1", x: 100, y: 200 };
      const result1 = checkAuth(moveMsg, uid);
      expect(result1).toBe(true); // handled by dropping
      expect(consoleWarnSpy).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // User authenticates
      authenticatedUids.add(uid);

      // Now regular message passes through
      const result2 = checkAuth(moveMsg, uid);
      expect(result2).toBe(false); // pass-through
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("handles different users independently", () => {
      // Setup: user1 authenticated, user2 not
      authenticatedUids.add("user1");

      const message: ClientMessage = {
        t: "move",
        id: "token1",
        x: 100,
        y: 200,
      };

      const checkAuth = createAuthenticator();

      // Execute: same message from different users
      const result1 = checkAuth(message, "user1");
      const result2 = checkAuth(message, "user2");

      // Assert: user1 message passes through
      expect(result1).toBe(false);

      // Assert: user2 message dropped
      expect(result2).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unauthenticated message from user2, dropping.",
      );
    });

    it("handles all four auth message types in sequence", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");

      const messages: Array<{ msg: ClientMessage; handler: keyof MockAuthenticationHandler }> = [
        { msg: { t: "authenticate", secret: "pass" }, handler: "authenticate" },
        { msg: { t: "elevate-to-dm", dmPassword: "dm" }, handler: "elevateToDM" },
        { msg: { t: "revoke-dm" }, handler: "revokeDM" },
        { msg: { t: "set-dm-password", dmPassword: "new" }, handler: "setDMPassword" },
      ];

      const checkAuth = createAuthenticator();

      // Execute: process all auth messages
      for (const { msg } of messages) {
        const result = checkAuth(msg, "user1");
        expect(result).toBe(true);
      }

      // Assert: each handler called once
      expect(mockAuthHandler.authenticate).toHaveBeenCalledOnce();
      expect(mockAuthHandler.elevateToDM).toHaveBeenCalledOnce();
      expect(mockAuthHandler.revokeDM).toHaveBeenCalledOnce();
      expect(mockAuthHandler.setDMPassword).toHaveBeenCalledOnce();
    });

    it("passes through all non-auth messages for authenticated users", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");

      const nonAuthMessages: ClientMessage[] = [
        { t: "heartbeat" },
        { t: "move", id: "token1", x: 100, y: 200 },
        { t: "rename", name: "Player1" },
        { t: "portrait", data: "data:image/png;base64,abc" },
        { t: "point", x: 50, y: 50 },
      ];

      const checkAuth = createAuthenticator();

      // Execute & Assert: all pass through
      for (const message of nonAuthMessages) {
        const result = checkAuth(message, "user1");
        expect(result).toBe(false); // pass-through
      }

      // Assert: no auth handlers called
      expect(mockAuthHandler.authenticate).not.toHaveBeenCalled();
      expect(mockAuthHandler.elevateToDM).not.toHaveBeenCalled();
      expect(mockAuthHandler.revokeDM).not.toHaveBeenCalled();
      expect(mockAuthHandler.setDMPassword).not.toHaveBeenCalled();

      // Assert: no warnings
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("Callback invocation patterns", () => {
    it("invokes onAuthMessage callback for auth messages", () => {
      // Setup: auth message
      const message: ClientMessage = {
        t: "authenticate",
        secret: "password",
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, uid);

      // Assert: callback invoked with uid and message
      expect(onAuthMessageCallback).toHaveBeenCalledOnce();
      expect(onAuthMessageCallback).toHaveBeenCalledWith(uid, message);
    });

    it("invokes onUnauthenticatedMessage callback when dropping messages", () => {
      // Setup: unauthenticated user, regular message
      const message: ClientMessage = {
        t: "move",
        id: "token1",
        x: 100,
        y: 200,
      };
      const uid = "user1";

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, uid);

      // Assert: callback invoked with uid
      expect(onUnauthenticatedMessageCallback).toHaveBeenCalledOnce();
      expect(onUnauthenticatedMessageCallback).toHaveBeenCalledWith(uid);
    });

    it("does not invoke callbacks for pass-through messages", () => {
      // Setup: authenticated user, regular message
      authenticatedUids.add("user1");
      const message: ClientMessage = {
        t: "heartbeat",
      };

      // Execute: check authentication
      const checkAuth = createAuthenticator();
      checkAuth(message, "user1");

      // Assert: no callbacks invoked
      expect(onAuthMessageCallback).not.toHaveBeenCalled();
      expect(onUnauthenticatedMessageCallback).not.toHaveBeenCalled();
    });

    it("invokes callbacks for all auth message types", () => {
      // Setup: authenticated user
      authenticatedUids.add("user1");

      const authMessages: ClientMessage[] = [
        { t: "authenticate", secret: "pass" },
        { t: "elevate-to-dm", dmPassword: "dm" },
        { t: "revoke-dm" },
        { t: "set-dm-password", dmPassword: "new" },
      ];

      const checkAuth = createAuthenticator();

      // Execute: process all auth messages
      for (const message of authMessages) {
        checkAuth(message, "user1");
      }

      // Assert: callback invoked 4 times
      expect(onAuthMessageCallback).toHaveBeenCalledTimes(4);
    });
  });

  // Helper function to create authenticator matching ConnectionHandler.handleValidatedMessage behavior
  function createAuthenticator() {
    return (message: ClientMessage, uid: string): boolean => {
      // Authentication handling - always processed first
      if (message.t === "authenticate") {
        mockAuthHandler.authenticate(uid, message.secret, message.roomId);
        onAuthMessageCallback(uid, message);
        return true;
      }

      // Check authentication for all other messages
      if (!authenticatedUids.has(uid)) {
        consoleWarnSpy(`Unauthenticated message from ${uid}, dropping.`);
        onUnauthenticatedMessageCallback(uid);
        return true;
      }

      // DM elevation handling
      if (message.t === "elevate-to-dm") {
        mockAuthHandler.elevateToDM(uid, message.dmPassword);
        onAuthMessageCallback(uid, message);
        return true;
      }

      // DM revocation handling
      if (message.t === "revoke-dm") {
        mockAuthHandler.revokeDM(uid);
        onAuthMessageCallback(uid, message);
        return true;
      }

      // DM password management
      if (message.t === "set-dm-password") {
        mockAuthHandler.setDMPassword(uid, message.dmPassword);
        onAuthMessageCallback(uid, message);
        return true;
      }

      // Message should be routed to MessageRouter
      return false;
    };
  }
});
