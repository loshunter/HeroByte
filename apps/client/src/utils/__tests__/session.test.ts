/**
 * Comprehensive tests for session utilities
 *
 * Tests cover:
 * - getSessionUID when no existing UID exists (creates new one)
 * - getSessionUID when existing UID exists (returns existing)
 * - getSessionUID generates valid UUID format
 * - getSessionUID stores in localStorage with correct key
 * - clearSessionUID removes from localStorage
 * - clearSessionUID when no existing UID (safe to call)
 * - localStorage mock verification
 * - UUID generation mock verification
 *
 * Source: apps/client/src/utils/session.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSessionUID, clearSessionUID } from "../session";
import * as uuidModule from "../uuid";

describe("Session Utilities", () => {
  // Mock localStorage
  let localStorageMock: Record<string, string>;
  const SESSION_UID_KEY = "herobyte-session-uid";

  beforeEach(() => {
    // Create a fresh localStorage mock for each test
    localStorageMock = {};

    // Mock localStorage methods
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSessionUID", () => {
    describe("when no existing UID exists", () => {
      it("should create a new session UID", () => {
        const mockUUID = "test-uuid-12345";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        const result = getSessionUID();

        expect(result).toBe(mockUUID);
      });

      it("should call generateUUID to create new UID", () => {
        const generateUUIDSpy = vi.spyOn(uuidModule, "generateUUID").mockReturnValue("new-uuid");

        getSessionUID();

        expect(generateUUIDSpy).toHaveBeenCalledOnce();
      });

      it("should store new UID in localStorage", () => {
        const mockUUID = "stored-uuid-67890";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        getSessionUID();

        expect(localStorage.setItem).toHaveBeenCalledOnce();
        expect(localStorage.setItem).toHaveBeenCalledWith(SESSION_UID_KEY, mockUUID);
      });

      it("should store UID with correct key in localStorage", () => {
        const mockUUID = "key-test-uuid";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        getSessionUID();

        expect(localStorageMock[SESSION_UID_KEY]).toBe(mockUUID);
      });

      it("should check localStorage for existing UID before creating new one", () => {
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue("new-uuid");

        getSessionUID();

        expect(localStorage.getItem).toHaveBeenCalledOnce();
        expect(localStorage.getItem).toHaveBeenCalledWith(SESSION_UID_KEY);
      });
    });

    describe("when existing UID exists", () => {
      it("should return existing session UID", () => {
        const existingUID = "existing-uuid-abc123";
        localStorageMock[SESSION_UID_KEY] = existingUID;

        const result = getSessionUID();

        expect(result).toBe(existingUID);
      });

      it("should NOT generate a new UUID when one exists", () => {
        const generateUUIDSpy = vi.spyOn(uuidModule, "generateUUID");
        localStorageMock[SESSION_UID_KEY] = "existing-uuid";

        getSessionUID();

        expect(generateUUIDSpy).not.toHaveBeenCalled();
      });

      it("should NOT call setItem when existing UID is found", () => {
        localStorageMock[SESSION_UID_KEY] = "existing-uuid";

        getSessionUID();

        expect(localStorage.setItem).not.toHaveBeenCalled();
      });

      it("should retrieve UID from localStorage with correct key", () => {
        localStorageMock[SESSION_UID_KEY] = "correct-key-uuid";

        getSessionUID();

        expect(localStorage.getItem).toHaveBeenCalledWith(SESSION_UID_KEY);
      });

      it("should return same UID on multiple calls", () => {
        const existingUID = "persistent-uuid-xyz";
        localStorageMock[SESSION_UID_KEY] = existingUID;

        const firstCall = getSessionUID();
        const secondCall = getSessionUID();
        const thirdCall = getSessionUID();

        expect(firstCall).toBe(existingUID);
        expect(secondCall).toBe(existingUID);
        expect(thirdCall).toBe(existingUID);
      });
    });

    describe("UUID format validation", () => {
      it("should generate valid UUID format (using real generateUUID)", () => {
        vi.restoreAllMocks(); // Use real generateUUID

        const result = getSessionUID();

        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(result).toMatch(uuidRegex);
      });

      it("should store UUID that matches valid format", () => {
        const mockUUID = "550e8400-e29b-41d4-a716-446655440000";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        getSessionUID();

        const storedValue = localStorageMock[SESSION_UID_KEY];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(storedValue).toMatch(uuidRegex);
      });

      it("should generate unique UIDs on separate test runs", () => {
        vi.restoreAllMocks();

        const uid1 = getSessionUID();
        clearSessionUID(); // Clear for next generation
        const uid2 = getSessionUID();
        clearSessionUID();
        const uid3 = getSessionUID();

        // All three should be different (statistically guaranteed for UUIDs)
        expect(uid1).not.toBe(uid2);
        expect(uid2).not.toBe(uid3);
        expect(uid1).not.toBe(uid3);
      });
    });

    describe("edge cases", () => {
      it("should treat empty string as falsy and create new UID", () => {
        // Store empty string in localStorage
        localStorageMock[SESSION_UID_KEY] = "";
        const mockUUID = "new-uuid-for-empty";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        // Empty string is falsy in the conditional check, so it creates new UID
        const result = getSessionUID();

        // Implementation uses if (existing) which is false for empty string
        expect(result).toBe(mockUUID);
        expect(uuidModule.generateUUID).toHaveBeenCalledOnce();
      });

      it("should handle null return from localStorage.getItem", () => {
        // Explicitly set getItem to return null
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
        const mockUUID = "null-case-uuid";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        const result = getSessionUID();

        expect(result).toBe(mockUUID);
        expect(uuidModule.generateUUID).toHaveBeenCalledOnce();
      });

      it("should handle undefined return from localStorage.getItem", () => {
        // Explicitly set getItem to return undefined
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
        const mockUUID = "undefined-case-uuid";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        const result = getSessionUID();

        expect(result).toBe(mockUUID);
        expect(uuidModule.generateUUID).toHaveBeenCalledOnce();
      });
    });
  });

  describe("clearSessionUID", () => {
    describe("when existing UID exists", () => {
      it("should remove session UID from localStorage", () => {
        localStorageMock[SESSION_UID_KEY] = "uid-to-remove";

        clearSessionUID();

        expect(localStorage.removeItem).toHaveBeenCalledOnce();
        expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_UID_KEY);
      });

      it("should actually delete the UID from storage", () => {
        localStorageMock[SESSION_UID_KEY] = "uid-to-delete";

        clearSessionUID();

        expect(localStorageMock[SESSION_UID_KEY]).toBeUndefined();
      });

      it("should remove UID with correct key", () => {
        localStorageMock[SESSION_UID_KEY] = "correct-key-removal";

        clearSessionUID();

        expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_UID_KEY);
      });

      it("should allow getSessionUID to create new UID after clearing", () => {
        const originalUID = "original-uid";
        const newUID = "new-uid-after-clear";
        localStorageMock[SESSION_UID_KEY] = originalUID;

        // Verify existing UID is returned
        expect(getSessionUID()).toBe(originalUID);

        // Clear the UID
        clearSessionUID();

        // Mock new UUID generation
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(newUID);

        // Should generate new UID
        const result = getSessionUID();
        expect(result).toBe(newUID);
        expect(result).not.toBe(originalUID);
      });
    });

    describe("when no existing UID exists", () => {
      it("should safely call removeItem even when no UID exists", () => {
        // No UID in storage
        expect(localStorageMock[SESSION_UID_KEY]).toBeUndefined();

        // Should not throw
        expect(() => clearSessionUID()).not.toThrow();
      });

      it("should still call localStorage.removeItem when no UID exists", () => {
        clearSessionUID();

        expect(localStorage.removeItem).toHaveBeenCalledOnce();
        expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_UID_KEY);
      });

      it("should be safe to call multiple times", () => {
        clearSessionUID();
        clearSessionUID();
        clearSessionUID();

        expect(localStorage.removeItem).toHaveBeenCalledTimes(3);
        expect(() => clearSessionUID()).not.toThrow();
      });
    });

    describe("integration with getSessionUID", () => {
      it("should clear UID that was just created", () => {
        const mockUUID = "just-created-uuid";
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

        // Create new UID
        getSessionUID();
        expect(localStorageMock[SESSION_UID_KEY]).toBe(mockUUID);

        // Clear it
        clearSessionUID();
        expect(localStorageMock[SESSION_UID_KEY]).toBeUndefined();
      });

      it("should support full session lifecycle (create, use, clear, recreate)", () => {
        const firstUID = "first-session-uid";
        const secondUID = "second-session-uid";

        // Create first session
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(firstUID);
        const session1 = getSessionUID();
        expect(session1).toBe(firstUID);

        // Use it (multiple calls return same value)
        expect(getSessionUID()).toBe(firstUID);
        expect(getSessionUID()).toBe(firstUID);

        // Clear session
        clearSessionUID();
        expect(localStorageMock[SESSION_UID_KEY]).toBeUndefined();

        // Create new session
        vi.spyOn(uuidModule, "generateUUID").mockReturnValue(secondUID);
        const session2 = getSessionUID();
        expect(session2).toBe(secondUID);
        expect(session2).not.toBe(firstUID);
      });
    });
  });

  describe("localStorage interaction verification", () => {
    it("should only use expected localStorage methods", () => {
      const mockUUID = "verify-methods-uuid";
      vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

      // Test getSessionUID
      getSessionUID();
      expect(localStorage.getItem).toHaveBeenCalled();
      expect(localStorage.setItem).toHaveBeenCalled();

      // Test clearSessionUID
      clearSessionUID();
      expect(localStorage.removeItem).toHaveBeenCalled();

      // Should NOT use clear() method
      expect(localStorage.clear).not.toHaveBeenCalled();
    });

    it("should use localStorage.getItem before setItem in getSessionUID", () => {
      const mockUUID = "order-verification-uuid";
      vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

      getSessionUID();

      // getItem should be called before setItem
      const getItemCallOrder = (localStorage.getItem as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0];
      const setItemCallOrder = (localStorage.setItem as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0];

      expect(getItemCallOrder).toBeLessThan(setItemCallOrder);
    });

    it("should use correct localStorage key consistently", () => {
      const mockUUID = "consistent-key-uuid";
      vi.spyOn(uuidModule, "generateUUID").mockReturnValue(mockUUID);

      // Create UID
      getSessionUID();
      expect(localStorage.getItem).toHaveBeenCalledWith(SESSION_UID_KEY);
      expect(localStorage.setItem).toHaveBeenCalledWith(SESSION_UID_KEY, mockUUID);

      // Clear UID
      clearSessionUID();
      expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_UID_KEY);
    });
  });
});
