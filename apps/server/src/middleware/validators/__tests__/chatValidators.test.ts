import { describe, it, expect } from "vitest";
import { validateChatMessage } from "../chatValidators.js";
import { STRING_LIMITS } from "../constants.js";
import { validateMessage } from "../../validation.js";

describe("validateChatMessage", () => {
  it("accepts a plain public message", () => {
    expect(validateChatMessage({ t: "chat", text: "hello table" })).toEqual({ valid: true });
  });

  it("accepts a whisper", () => {
    expect(validateChatMessage({ t: "chat", text: "psst", to: "player-2" })).toEqual({
      valid: true,
    });
  });

  it("rejects a missing or non-string body", () => {
    expect(validateChatMessage({ t: "chat" }).valid).toBe(false);
    expect(validateChatMessage({ t: "chat", text: 42 }).valid).toBe(false);
    expect(validateChatMessage({ t: "chat", text: null }).valid).toBe(false);
  });

  it("rejects empty and whitespace-only bodies", () => {
    // Whitespace-only must not slip through as "technically a string of
    // length 5" — it renders as a blank line nobody sent.
    expect(validateChatMessage({ t: "chat", text: "" }).valid).toBe(false);
    expect(validateChatMessage({ t: "chat", text: "     " }).valid).toBe(false);
    expect(validateChatMessage({ t: "chat", text: "\n\t " }).valid).toBe(false);
  });

  it("accepts exactly the cap and rejects one past it", () => {
    const atCap = "x".repeat(STRING_LIMITS.CHAT_TEXT_MAX);
    expect(validateChatMessage({ t: "chat", text: atCap }).valid).toBe(true);
    expect(validateChatMessage({ t: "chat", text: atCap + "x" }).valid).toBe(false);
  });

  it("measures the cap AFTER trimming, so padding cannot smuggle length", () => {
    const padded = "  " + "x".repeat(STRING_LIMITS.CHAT_TEXT_MAX) + "  ";
    expect(validateChatMessage({ t: "chat", text: padded }).valid).toBe(true);
  });

  it("rejects a malformed whisper target", () => {
    expect(validateChatMessage({ t: "chat", text: "hi", to: "" }).valid).toBe(false);
    expect(validateChatMessage({ t: "chat", text: "hi", to: "   " }).valid).toBe(false);
    expect(validateChatMessage({ t: "chat", text: "hi", to: 7 }).valid).toBe(false);
    expect(
      validateChatMessage({ t: "chat", text: "hi", to: "x".repeat(STRING_LIMITS.SECRET_MAX + 1) })
        .valid,
    ).toBe(false);
  });

  it("does not reject an unknown whisper target (no uid enumeration oracle)", () => {
    // A validation error that distinguished real uids from fake ones would
    // let anyone probe who is at the table. Unknown targets validate fine and
    // simply reach nobody.
    expect(validateChatMessage({ t: "chat", text: "hi", to: "nobody-here" }).valid).toBe(true);
  });
});

describe("chat is registered in the message validator map", () => {
  // The registry is the gate: an unregistered type is rejected at runtime
  // with "Unknown message type", regardless of how correct its handler is.
  it("routes chat through its validator rather than rejecting it as unknown", () => {
    expect(validateMessage({ t: "chat", text: "hello" })).toEqual({ valid: true });
  });

  it("still rejects a genuinely unknown type", () => {
    const result = validateMessage({ t: "chat-but-not-really", text: "hello" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unknown message type");
  });

  it("rejects an invalid chat payload through the top-level entry point", () => {
    expect(validateMessage({ t: "chat", text: "" }).valid).toBe(false);
  });

  it("accepts clear-chat-log", () => {
    expect(validateMessage({ t: "clear-chat-log" })).toEqual({ valid: true });
  });
});
