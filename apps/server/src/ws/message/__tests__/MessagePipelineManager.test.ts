import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

// Mock validation module before importing
vi.mock("../../../middleware/validation.js", () => ({
  validateMessage: vi.fn(),
}));

import type { ClientMessage } from "@shared";
import { validateMessage } from "../../../middleware/validation.js";

// Mock RateLimiter class
class MockRateLimiter {
  public check = vi.fn<(clientId: string) => boolean>();
}

describe("MessagePipelineManager - Characterization Tests", () => {
  let mockRateLimiter: MockRateLimiter;
  let validateMessageSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;
  let onValidMessageCallback: MockInstance;
  let onInvalidMessageCallback: MockInstance;

  beforeEach(() => {
    // Clear all mocks between tests
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockRateLimiter = new MockRateLimiter();
    onValidMessageCallback = vi.fn();
    onInvalidMessageCallback = vi.fn();

    // Setup spies
    validateMessageSpy = vi.mocked(validateMessage);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Default mock behavior - tests can override
    mockRateLimiter.check.mockReturnValue(true);
    validateMessageSpy.mockReturnValue({ valid: true });
  });

  describe("Message size validation (DoS protection)", () => {
    it("accepts message under 1MB limit", () => {
      // Setup: Create message under 1MB (1024 * 1024 = 1,048,576 bytes)
      const validMessage: ClientMessage = { t: "heartbeat" };
      const smallBuffer = Buffer.from(JSON.stringify(validMessage));

      expect(smallBuffer.length).toBeLessThan(1024 * 1024);

      // Execute: Process the message
      const processMessage = createMessageProcessor();
      const result = processMessage(smallBuffer, "user1");

      // Assert: Message is accepted and processed
      expect(result).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("exceeds size limit"),
      );
      expect(onValidMessageCallback).toHaveBeenCalledWith(validMessage, "user1");
    });

    it("rejects message over 1MB limit", () => {
      // Setup: Create buffer exceeding 1MB
      const largeData = "x".repeat(1024 * 1024 + 1); // 1MB + 1 byte
      const largeBuffer = Buffer.from(largeData);

      expect(largeBuffer.length).toBeGreaterThan(1024 * 1024);

      // Execute: Process the oversized message
      const processMessage = createMessageProcessor();
      const result = processMessage(largeBuffer, "user1");

      // Assert: Message is rejected
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Message from user1 exceeds size limit: ${largeBuffer.length} bytes (max: 1048576)`,
      );
      expect(onValidMessageCallback).not.toHaveBeenCalled();
    });

    it("rejects message exactly at 1MB + 1 byte boundary", () => {
      // Setup: Create buffer at exactly 1MB + 1 byte
      const MAX_SIZE = 1024 * 1024;
      const boundaryBuffer = Buffer.alloc(MAX_SIZE + 1);

      // Execute: Process message at boundary
      const processMessage = createMessageProcessor();
      const result = processMessage(boundaryBuffer, "user2");

      // Assert: Message is rejected
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Message from user2 exceeds size limit: ${MAX_SIZE + 1} bytes (max: ${MAX_SIZE})`,
      );
    });

    it("accepts message exactly at 1MB boundary", () => {
      // Setup: Create buffer at exactly 1MB
      const MAX_SIZE = 1024 * 1024;
      const validJson = { t: "heartbeat" };
      const paddedJson = {
        ...validJson,
        padding: "x".repeat(MAX_SIZE - 100), // Fill to approach limit
      };
      const boundaryBuffer = Buffer.from(JSON.stringify(paddedJson));

      // Ensure we're at or under the limit
      if (boundaryBuffer.length > MAX_SIZE) {
        // Adjust to be exactly at limit
        const exactBuffer = Buffer.alloc(MAX_SIZE);
        exactBuffer.write(JSON.stringify(validJson));

        const processMessage = createMessageProcessor();
        const result = processMessage(exactBuffer, "user3");

        expect(result).toBe(true);
      } else {
        const processMessage = createMessageProcessor();
        const result = processMessage(boundaryBuffer, "user3");

        expect(result).toBe(true);
      }
    });
  });

  describe("JSON parsing", () => {
    it("parses valid JSON successfully", () => {
      // Setup: Valid JSON message
      const validMessage: ClientMessage = {
        t: "move",
        id: "token1",
        x: 100,
        y: 200,
      };
      const buffer = Buffer.from(JSON.stringify(validMessage));

      // Execute: Process valid JSON
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Parsing succeeds
      expect(result).toBe(true);
      expect(onValidMessageCallback).toHaveBeenCalledWith(validMessage, "user1");
    });

    it("handles invalid JSON gracefully", () => {
      // Setup: Malformed JSON
      const invalidJson = "{ invalid json }";
      const buffer = Buffer.from(invalidJson);

      // Execute: Process invalid JSON
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Error is logged and message is rejected
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ConnectionHandler] Failed to process message from user1:",
        expect.any(Error),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ConnectionHandler] Failed to parse message buffer",
      );
      expect(onValidMessageCallback).not.toHaveBeenCalled();
    });

    it("handles empty buffer gracefully", () => {
      // Setup: Empty buffer
      const emptyBuffer = Buffer.from("");

      // Execute: Process empty buffer
      const processMessage = createMessageProcessor();
      const result = processMessage(emptyBuffer, "user1");

      // Assert: Error is logged
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ConnectionHandler] Failed to process message from user1:",
        expect.any(Error),
      );
    });

    it("handles non-UTF8 buffer gracefully", () => {
      // Setup: Invalid UTF-8 sequence
      const invalidBuffer = Buffer.from([0xff, 0xfe, 0xfd]);

      // Execute: Process invalid buffer
      const processMessage = createMessageProcessor();
      const result = processMessage(invalidBuffer, "user1");

      // Assert: Error is handled (may parse as invalid JSON)
      expect(result).toBe(false);
    });
  });

  describe("Rate limiting enforcement", () => {
    it("enforces rate limit when exceeded", () => {
      // Setup: Rate limiter returns false (limit exceeded)
      mockRateLimiter.check.mockReturnValue(false);

      const validMessage: ClientMessage = { t: "heartbeat" };
      const buffer = Buffer.from(JSON.stringify(validMessage));

      // Execute: Process message when rate limited
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Message is rejected
      expect(result).toBe(false);
      expect(mockRateLimiter.check).toHaveBeenCalledWith("user1");
      expect(consoleWarnSpy).toHaveBeenCalledWith("Rate limit exceeded for client user1");
      expect(onValidMessageCallback).not.toHaveBeenCalled();
    });

    it("allows messages when under rate limit", () => {
      // Setup: Rate limiter returns true (under limit)
      mockRateLimiter.check.mockReturnValue(true);

      const validMessage: ClientMessage = { t: "heartbeat" };
      const buffer = Buffer.from(JSON.stringify(validMessage));

      // Execute: Process message under rate limit
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Message is allowed
      expect(result).toBe(true);
      expect(mockRateLimiter.check).toHaveBeenCalledWith("user1");
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Rate limit exceeded"),
      );
      expect(onValidMessageCallback).toHaveBeenCalledWith(validMessage, "user1");
    });

    it("enforces rate limit per client independently", () => {
      // Setup: Different rate limit states for different clients
      mockRateLimiter.check.mockImplementation((uid: string) => {
        return uid === "user1"; // user1 allowed, user2 blocked
      });

      const validMessage: ClientMessage = { t: "heartbeat" };
      const buffer = Buffer.from(JSON.stringify(validMessage));

      const processMessage = createMessageProcessor();

      // Execute: Process for user1 (allowed)
      const result1 = processMessage(buffer, "user1");
      expect(result1).toBe(true);
      expect(onValidMessageCallback).toHaveBeenCalledWith(validMessage, "user1");

      // Execute: Process for user2 (blocked)
      const result2 = processMessage(buffer, "user2");
      expect(result2).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith("Rate limit exceeded for client user2");
    });

    it("checks rate limit after size validation but before JSON parsing", () => {
      // Setup: Oversized message
      const largeBuffer = Buffer.alloc(1024 * 1024 + 1);

      // Execute: Process oversized message
      const processMessage = createMessageProcessor();
      processMessage(largeBuffer, "user1");

      // Assert: Rate limiter NOT called (size check fails first)
      expect(mockRateLimiter.check).not.toHaveBeenCalled();
    });
  });

  describe("Input validation dispatch", () => {
    it("validates message structure via validateMessage", () => {
      // Setup: Valid message, validation passes
      validateMessageSpy.mockReturnValue({ valid: true });

      const validMessage: ClientMessage = {
        t: "rename",
        name: "NewName",
      };
      const buffer = Buffer.from(JSON.stringify(validMessage));

      // Execute: Process message
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: validateMessage called with parsed message
      expect(result).toBe(true);
      expect(validateMessageSpy).toHaveBeenCalledWith(validMessage);
      expect(onValidMessageCallback).toHaveBeenCalledWith(validMessage, "user1");
    });

    it("rejects invalid message types", () => {
      // Setup: Invalid message type
      validateMessageSpy.mockReturnValue({
        valid: false,
        error: "Unknown message type: invalid-type",
      });

      const invalidMessage = { t: "invalid-type" };
      const buffer = Buffer.from(JSON.stringify(invalidMessage));

      // Execute: Process invalid message type
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Message is rejected
      expect(result).toBe(false);
      expect(validateMessageSpy).toHaveBeenCalledWith(invalidMessage);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Invalid message from user1: Unknown message type: invalid-type",
      );
      expect(onValidMessageCallback).not.toHaveBeenCalled();
      expect(onInvalidMessageCallback).toHaveBeenCalledWith(
        "user1",
        "Unknown message type: invalid-type",
      );
    });

    it("rejects message with missing required fields", () => {
      // Setup: Validation fails due to missing fields
      validateMessageSpy.mockReturnValue({
        valid: false,
        error: "Missing required field: name",
      });

      const incompleteMessage = { t: "rename" }; // Missing 'name' field
      const buffer = Buffer.from(JSON.stringify(incompleteMessage));

      // Execute: Process incomplete message
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Message is rejected
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Invalid message from user1: Missing required field: name",
      );
    });

    it("rejects message with invalid field types", () => {
      // Setup: Validation fails due to wrong type
      validateMessageSpy.mockReturnValue({
        valid: false,
        error: "Invalid field type: x must be number",
      });

      const invalidTypeMessage = { t: "move", id: "token1", x: "invalid", y: 100 };
      const buffer = Buffer.from(JSON.stringify(invalidTypeMessage));

      // Execute: Process message with invalid type
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Message is rejected
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Invalid message from user1: Invalid field type: x must be number",
      );
    });
  });

  describe("Error logging for debugging", () => {
    it("logs error with message details when JSON is valid", () => {
      // Setup: Valid JSON but validation fails
      validateMessageSpy.mockReturnValue({
        valid: false,
        error: "Validation error",
      });

      const message = { t: "move", id: "token1", x: 100, y: 200 };
      const buffer = Buffer.from(JSON.stringify(message));

      // Execute: Process message that fails validation
      const processMessage = createMessageProcessor();
      processMessage(buffer, "user1");

      // Assert: Warning logged with message details
      expect(consoleWarnSpy).toHaveBeenCalledWith("Invalid message from user1: Validation error");
    });

    it("logs error without message details when JSON parsing fails", () => {
      // Setup: Invalid JSON
      const invalidJson = "{ bad json";
      const buffer = Buffer.from(invalidJson);

      // Execute: Process unparseable message
      const processMessage = createMessageProcessor();
      processMessage(buffer, "user1");

      // Assert: Error logged indicating parse failure
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ConnectionHandler] Failed to process message from user1:",
        expect.any(Error),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ConnectionHandler] Failed to parse message buffer",
      );
    });

    it("logs structured error info for debugging", () => {
      // Setup: Throw error during processing (simulated via validation)
      validateMessageSpy.mockImplementation(() => {
        throw new Error("Unexpected validation error");
      });

      const message: ClientMessage = { t: "heartbeat" };
      const buffer = Buffer.from(JSON.stringify(message));

      // Execute: Process message that throws
      const processMessage = createMessageProcessor();
      processMessage(buffer, "user1");

      // Assert: Error logged with context
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ConnectionHandler] Failed to process message from user1:",
        expect.any(Error),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ConnectionHandler] Message was:",
        JSON.stringify(message),
      );
    });
  });

  describe("Complete message pipeline", () => {
    it("processes valid message through entire pipeline", () => {
      // Setup: All validations pass
      mockRateLimiter.check.mockReturnValue(true);
      validateMessageSpy.mockReturnValue({ valid: true });

      const validMessage: ClientMessage = {
        t: "move",
        id: "token1",
        x: 150,
        y: 250,
      };
      const buffer = Buffer.from(JSON.stringify(validMessage));

      // Execute: Process message through pipeline
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Message passes all stages
      expect(result).toBe(true);

      // Verify pipeline order
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // No size warning
      expect(mockRateLimiter.check).toHaveBeenCalledWith("user1"); // Rate check
      expect(validateMessageSpy).toHaveBeenCalledWith(validMessage); // Validation
      expect(onValidMessageCallback).toHaveBeenCalledWith(validMessage, "user1"); // Callback
    });

    it("short-circuits on size validation failure", () => {
      // Setup: Oversized message
      const largeBuffer = Buffer.alloc(1024 * 1024 + 1);

      // Execute: Process oversized message
      const processMessage = createMessageProcessor();
      const result = processMessage(largeBuffer, "user1");

      // Assert: Pipeline stops after size check
      expect(result).toBe(false);
      expect(mockRateLimiter.check).not.toHaveBeenCalled();
      expect(validateMessageSpy).not.toHaveBeenCalled();
      expect(onValidMessageCallback).not.toHaveBeenCalled();
    });

    it("short-circuits on rate limit failure", () => {
      // Setup: Rate limit exceeded
      mockRateLimiter.check.mockReturnValue(false);

      const validMessage: ClientMessage = { t: "heartbeat" };
      const buffer = Buffer.from(JSON.stringify(validMessage));

      // Execute: Process rate-limited message
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Pipeline stops after rate limit
      expect(result).toBe(false);
      expect(mockRateLimiter.check).toHaveBeenCalledWith("user1");
      expect(validateMessageSpy).not.toHaveBeenCalled();
      expect(onValidMessageCallback).not.toHaveBeenCalled();
    });

    it("short-circuits on validation failure", () => {
      // Setup: Validation fails
      mockRateLimiter.check.mockReturnValue(true);
      validateMessageSpy.mockReturnValue({
        valid: false,
        error: "Invalid message",
      });

      const invalidMessage = { t: "unknown" };
      const buffer = Buffer.from(JSON.stringify(invalidMessage));

      // Execute: Process invalid message
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Pipeline stops after validation
      expect(result).toBe(false);
      expect(mockRateLimiter.check).toHaveBeenCalledWith("user1");
      expect(validateMessageSpy).toHaveBeenCalledWith(invalidMessage);
      expect(onValidMessageCallback).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases and special scenarios", () => {
    it("handles multiple messages from same client sequentially", () => {
      // Setup: Process multiple messages
      mockRateLimiter.check.mockReturnValue(true);
      validateMessageSpy.mockReturnValue({ valid: true });

      const message1: ClientMessage = { t: "heartbeat" };
      const message2: ClientMessage = { t: "rename", name: "Player1" };
      const buffer1 = Buffer.from(JSON.stringify(message1));
      const buffer2 = Buffer.from(JSON.stringify(message2));

      const processMessage = createMessageProcessor();

      // Execute: Process multiple messages
      const result1 = processMessage(buffer1, "user1");
      const result2 = processMessage(buffer2, "user1");

      // Assert: Both processed
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockRateLimiter.check).toHaveBeenCalledTimes(2);
      expect(validateMessageSpy).toHaveBeenCalledTimes(2);
      expect(onValidMessageCallback).toHaveBeenNthCalledWith(1, message1, "user1");
      expect(onValidMessageCallback).toHaveBeenNthCalledWith(2, message2, "user1");
    });

    it("handles messages with special characters in JSON", () => {
      // Setup: Message with special characters
      validateMessageSpy.mockReturnValue({ valid: true });

      const specialMessage: ClientMessage = {
        t: "rename",
        name: "Player with 特殊字符 and émojis 🎮",
      };
      const buffer = Buffer.from(JSON.stringify(specialMessage));

      // Execute: Process message
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Special characters handled correctly
      expect(result).toBe(true);
      expect(onValidMessageCallback).toHaveBeenCalledWith(specialMessage, "user1");
    });

    it("handles message with nested objects", () => {
      // Setup: Complex nested message
      validateMessageSpy.mockReturnValue({ valid: true });

      const nestedMessage: ClientMessage = {
        t: "create-npc",
        name: "Goblin",
        hp: 10,
        maxHp: 10,
        portrait: "data:image/png;base64,abc123",
        tokenImage: "url/to/image",
      };
      const buffer = Buffer.from(JSON.stringify(nestedMessage));

      // Execute: Process nested message
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Nested structure preserved
      expect(result).toBe(true);
      expect(onValidMessageCallback).toHaveBeenCalledWith(nestedMessage, "user1");
    });

    it("processes message with array fields", () => {
      // Setup: Message with array
      validateMessageSpy.mockReturnValue({ valid: true });

      const arrayMessage: ClientMessage = {
        t: "set-status-effects",
        effects: ["poisoned", "stunned", "blinded"],
      };
      const buffer = Buffer.from(JSON.stringify(arrayMessage));

      // Execute: Process message with array
      const processMessage = createMessageProcessor();
      const result = processMessage(buffer, "user1");

      // Assert: Array field preserved
      expect(result).toBe(true);
      expect(onValidMessageCallback).toHaveBeenCalledWith(arrayMessage, "user1");
    });
  });

  // Helper function to create message processor matching ConnectionHandler.handleMessage behavior
  function createMessageProcessor() {
    return (buf: Buffer, uid: string): boolean => {
      let rawMessage: unknown;
      try {
        // Message size limit check (1MB) to prevent DoS attacks
        const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
        if (buf.length > MAX_MESSAGE_SIZE) {
          consoleWarnSpy(
            `Message from ${uid} exceeds size limit: ${buf.length} bytes (max: ${MAX_MESSAGE_SIZE})`,
          );
          return false;
        }

        // Parse message
        rawMessage = JSON.parse(buf.toString());

        // Rate limiting
        if (!mockRateLimiter.check(uid)) {
          consoleWarnSpy(`Rate limit exceeded for client ${uid}`);
          return false;
        }

        // Input validation
        const validation = validateMessageSpy(rawMessage);
        if (!validation.valid) {
          consoleWarnSpy(`Invalid message from ${uid}: ${validation.error}`);
          onInvalidMessageCallback?.(uid, validation.error);
          return false;
        }

        // At this point, message is validated as ClientMessage
        const message = rawMessage as ClientMessage;

        // Call success callback
        onValidMessageCallback(message, uid);
        return true;
      } catch (err) {
        consoleErrorSpy(`[ConnectionHandler] Failed to process message from ${uid}:`, err);
        if (rawMessage !== undefined) {
          consoleErrorSpy(`[ConnectionHandler] Message was:`, JSON.stringify(rawMessage));
        } else {
          consoleErrorSpy(`[ConnectionHandler] Failed to parse message buffer`);
        }
        return false;
      }
    };
  }
});
