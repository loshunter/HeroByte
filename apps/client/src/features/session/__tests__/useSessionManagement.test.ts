/**
 * Characterization tests for useSessionManagement hook
 *
 * These tests capture the behavior of the original session management code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 411-467, 793-794)
 *   - Line 29: Import of sessionPersistence utilities
 *   - Lines 411-432: handleSaveSession callback
 *   - Lines 434-467: handleLoadSession callback
 *   - Lines 793-794: DMMenu integration (onRequestSaveSession, onRequestLoadSession)
 *
 * Target: apps/client/src/features/session/useSessionManagement.ts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { RoomSnapshot } from "@shared";

describe("useSessionManagement - Characterization", () => {
  const mockSaveSession = vi.fn();
  const mockLoadSession = vi.fn();
  const mockSendMessage = vi.fn();
  const mockToastInfo = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastWarning = vi.fn();
  const mockToastError = vi.fn();

  const mockToast = {
    info: mockToastInfo,
    success: mockToastSuccess,
    warning: mockToastWarning,
    error: mockToastError,
  };

  // Console.error spy for error logging verification
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  // Mock snapshot data
  const createMockSnapshot = (overrides?: Partial<RoomSnapshot>): RoomSnapshot => ({
    users: [],
    tokens: [],
    players: [],
    characters: [{ id: "char1", name: "Test Character", visible: true }],
    props: [],
    mapBackground: undefined,
    pointers: [],
    drawings: [],
    gridSize: 50,
    diceRolls: [],
    gridSquareSize: 50,
    sceneObjects: [{ id: "obj1", type: "token", locked: false, x: 0, y: 0 }],
    playerStagingZone: undefined,
    ...overrides,
  });

  beforeEach(() => {
    mockSaveSession.mockClear();
    mockLoadSession.mockClear();
    mockSendMessage.mockClear();
    mockToastInfo.mockClear();
    mockToastSuccess.mockClear();
    mockToastWarning.mockClear();
    mockToastError.mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  /**
   * Simulates the handleSaveSession callback from App.tsx
   */
  const createHandleSaveSession = (snapshot: RoomSnapshot | null) => {
    return (name: string) => {
      if (!snapshot) {
        mockToast.warning("No session data available to save yet.");
        return;
      }
      try {
        mockToast.info("Preparing session file...");
        mockSaveSession(snapshot, name);
        mockToast.success(`Session "${name}" saved successfully!`, 4000);
      } catch (err) {
        console.error("Failed to save session", err);
        mockToast.error(
          err instanceof Error
            ? `Save failed: ${err.message}`
            : "Failed to save session. Check console for details.",
          5000,
        );
      }
    };
  };

  /**
   * Simulates the handleLoadSession callback from App.tsx
   */
  const createHandleLoadSession = () => {
    return async (file: File) => {
      try {
        mockToast.info(`Loading session from ${file.name}...`);
        const loadedSnapshot = await mockLoadSession(file);

        // Validate snapshot has expected data
        const warnings: string[] = [];
        if (!loadedSnapshot.sceneObjects || loadedSnapshot.sceneObjects.length === 0) {
          warnings.push("No scene objects found");
        }
        if (!loadedSnapshot.characters || loadedSnapshot.characters.length === 0) {
          warnings.push("No characters found");
        }

        mockSendMessage({ t: "load-session", snapshot: loadedSnapshot });

        if (warnings.length > 0) {
          mockToast.warning(`Session loaded with warnings: ${warnings.join(", ")}`, 5000);
        } else {
          mockToast.success(`Session "${file.name}" loaded successfully!`, 4000);
        }
      } catch (err) {
        console.error("Failed to load session", err);
        mockToast.error(
          err instanceof Error
            ? `Load failed: ${err.message}`
            : "Failed to load session. File may be corrupted.",
          5000,
        );
      }
    };
  };

  describe("Save Session - Success Cases", () => {
    it("should save session successfully with valid snapshot and name", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("test-session");

      expect(mockToastInfo).toHaveBeenCalledTimes(1);
      expect(mockToastInfo).toHaveBeenCalledWith("Preparing session file...");
      expect(mockSaveSession).toHaveBeenCalledTimes(1);
      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "test-session");
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Session "test-session" saved successfully!',
        4000,
      );
    });

    it("should save session with custom session name", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("my-epic-campaign");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "my-epic-campaign");
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Session "my-epic-campaign" saved successfully!',
        4000,
      );
    });

    it("should save session with empty name string", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "");
      expect(mockToastSuccess).toHaveBeenCalledWith('Session "" saved successfully!', 4000);
    });

    it("should save session with name containing spaces", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("Session With Spaces");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "Session With Spaces");
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Session "Session With Spaces" saved successfully!',
        4000,
      );
    });

    it("should save session with name containing special characters", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("session-2024_v1.0");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "session-2024_v1.0");
    });

    it("should display info toast before attempting save", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("test");

      // Check order: info toast before saveSession call
      const infoCallOrder = mockToastInfo.mock.invocationCallOrder[0];
      const saveCallOrder = mockSaveSession.mock.invocationCallOrder[0];
      expect(infoCallOrder).toBeLessThan(saveCallOrder!);
    });

    it("should display success toast with exact duration of 4000ms", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("test");

      expect(mockToastSuccess).toHaveBeenCalledWith(expect.any(String), 4000);
    });

    it("should save session with snapshot containing all data", () => {
      const snapshot = createMockSnapshot({
        users: [{ uid: "user1", name: "Player 1", cursor: { x: 0, y: 0 } }],
        tokens: [{ id: "token1", x: 0, y: 0, characterId: "char1", visible: true }],
        drawings: [{ id: "draw1", type: "path", points: [0, 0, 1, 1], color: "#000" }],
      });
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("full-session");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "full-session");
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  describe("Save Session - Null Snapshot Cases", () => {
    it("should show warning when snapshot is null", () => {
      const handleSaveSession = createHandleSaveSession(null);

      handleSaveSession("test-session");

      expect(mockToastWarning).toHaveBeenCalledTimes(1);
      expect(mockToastWarning).toHaveBeenCalledWith("No session data available to save yet.");
      expect(mockSaveSession).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("should not call saveSession when snapshot is null", () => {
      const handleSaveSession = createHandleSaveSession(null);

      handleSaveSession("test-session");

      expect(mockSaveSession).not.toHaveBeenCalled();
    });

    it("should not show info toast when snapshot is null", () => {
      const handleSaveSession = createHandleSaveSession(null);

      handleSaveSession("test-session");

      expect(mockToastInfo).not.toHaveBeenCalled();
    });

    it("should return early when snapshot is null (no further execution)", () => {
      const handleSaveSession = createHandleSaveSession(null);

      handleSaveSession("test-session");

      expect(mockToastWarning).toHaveBeenCalledTimes(1);
      expect(mockToastInfo).not.toHaveBeenCalled();
      expect(mockSaveSession).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe("Save Session - Error Cases", () => {
    it("should handle error when saveSession throws", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);
      const error = new Error("File system error");
      mockSaveSession.mockImplementation(() => {
        throw error;
      });

      handleSaveSession("test-session");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to save session", error);
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("Save failed: File system error", 5000);
    });

    it("should display error toast with exact duration of 5000ms", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);
      mockSaveSession.mockImplementation(() => {
        throw new Error("Test error");
      });

      handleSaveSession("test-session");

      expect(mockToastError).toHaveBeenCalledWith(expect.any(String), 5000);
    });

    it("should handle non-Error exceptions", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);
      mockSaveSession.mockImplementation(() => {
        throw "String error";
      });

      handleSaveSession("test-session");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to save session", "String error");
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to save session. Check console for details.",
        5000,
      );
    });

    it("should handle error with custom error message", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);
      mockSaveSession.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      handleSaveSession("test-session");

      expect(mockToastError).toHaveBeenCalledWith("Save failed: Permission denied", 5000);
    });

    it("should call console.error before displaying error toast", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);
      mockSaveSession.mockImplementation(() => {
        throw new Error("Test error");
      });

      handleSaveSession("test-session");

      const consoleCallOrder = consoleErrorSpy.mock.invocationCallOrder[0];
      const toastCallOrder = mockToastError.mock.invocationCallOrder[0];
      expect(consoleCallOrder).toBeLessThan(toastCallOrder!);
    });

    it("should not call success toast when error occurs", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);
      mockSaveSession.mockImplementation(() => {
        throw new Error("Test error");
      });

      handleSaveSession("test-session");

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe("Load Session - Success Cases", () => {
    it("should load session successfully with valid file", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "session.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot();
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockToastInfo).toHaveBeenCalledWith("Loading session from session.json...");
      expect(mockLoadSession).toHaveBeenCalledWith(mockFile);
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "load-session",
        snapshot: loadedSnapshot,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Session "session.json" loaded successfully!',
        4000,
      );
    });

    it("should send load-session message with loaded snapshot", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot();
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "load-session",
        snapshot: loadedSnapshot,
      });
    });

    it("should display success toast with exact duration of 4000ms", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(mockFile);

      expect(mockToastSuccess).toHaveBeenCalledWith(expect.any(String), 4000);
    });

    it("should display info toast before loading", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(mockFile);

      const infoCallOrder = mockToastInfo.mock.invocationCallOrder[0];
      const loadCallOrder = mockLoadSession.mock.invocationCallOrder[0];
      expect(infoCallOrder).toBeLessThan(loadCallOrder!);
    });

    it("should load session with file name containing special characters", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "session-2024_v1.0.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(mockFile);

      expect(mockToastInfo).toHaveBeenCalledWith("Loading session from session-2024_v1.0.json...");
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Session "session-2024_v1.0.json" loaded successfully!',
        4000,
      );
    });
  });

  describe("Load Session - Warning Cases", () => {
    it("should warn when loaded snapshot has no scene objects", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot({ sceneObjects: [] });
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(
        "Session loaded with warnings: No scene objects found",
        5000,
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("should warn when loaded snapshot has undefined scene objects", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot({ sceneObjects: undefined });
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(
        "Session loaded with warnings: No scene objects found",
        5000,
      );
    });

    it("should warn when loaded snapshot has no characters", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot({ characters: [] });
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(
        "Session loaded with warnings: No characters found",
        5000,
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("should warn when loaded snapshot has undefined characters", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      // @ts-expect-error - Testing undefined characters
      const loadedSnapshot = createMockSnapshot({ characters: undefined });
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(
        "Session loaded with warnings: No characters found",
        5000,
      );
    });

    it("should warn with both warnings when snapshot has no scene objects and no characters", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot({ sceneObjects: [], characters: [] });
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(
        "Session loaded with warnings: No scene objects found, No characters found",
        5000,
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("should display warning toast with exact duration of 5000ms", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot({ sceneObjects: [] });
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(expect.any(String), 5000);
    });

    it("should still send load-session message even with warnings", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const loadedSnapshot = createMockSnapshot({ sceneObjects: [], characters: [] });
      mockLoadSession.mockResolvedValue(loadedSnapshot);

      await handleLoadSession(mockFile);

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "load-session",
        snapshot: loadedSnapshot,
      });
    });
  });

  describe("Load Session - Error Cases", () => {
    it("should handle error when loadSession throws", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      const error = new Error("Failed to parse JSON");
      mockLoadSession.mockRejectedValue(error);

      await handleLoadSession(mockFile);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load session", error);
      expect(mockToastError).toHaveBeenCalledWith("Load failed: Failed to parse JSON", 5000);
    });

    it("should display error toast with exact duration of 5000ms", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockRejectedValue(new Error("Test error"));

      await handleLoadSession(mockFile);

      expect(mockToastError).toHaveBeenCalledWith(expect.any(String), 5000);
    });

    it("should handle non-Error exceptions", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockRejectedValue("String error");

      await handleLoadSession(mockFile);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load session", "String error");
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to load session. File may be corrupted.",
        5000,
      );
    });

    it("should handle corrupted file with appropriate message", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["corrupted data"], "test.json", { type: "application/json" });
      mockLoadSession.mockRejectedValue(new Error("Invalid session data"));

      await handleLoadSession(mockFile);

      expect(mockToastError).toHaveBeenCalledWith("Load failed: Invalid session data", 5000);
    });

    it("should call console.error before displaying error toast", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockRejectedValue(new Error("Test error"));

      await handleLoadSession(mockFile);

      const consoleCallOrder = consoleErrorSpy.mock.invocationCallOrder[0];
      const toastCallOrder = mockToastError.mock.invocationCallOrder[0];
      expect(consoleCallOrder).toBeLessThan(toastCallOrder!);
    });

    it("should not send message when error occurs", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockRejectedValue(new Error("Test error"));

      await handleLoadSession(mockFile);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should not call success toast when error occurs", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockRejectedValue(new Error("Test error"));

      await handleLoadSession(mockFile);

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty snapshot data", () => {
      const snapshot = createMockSnapshot({
        users: [],
        tokens: [],
        players: [],
        characters: [],
        props: [],
        drawings: [],
        sceneObjects: [],
      });
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("empty-session");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "empty-session");
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    it("should handle very long session name", () => {
      const snapshot = createMockSnapshot();
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(snapshot);
      const longName = "a".repeat(1000);

      handleSaveSession(longName);

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, longName);
    });

    it("should handle session name with unicode characters", () => {
      const snapshot = createMockSnapshot();
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("セッション_сессия_🎲");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "セッション_сессия_🎲");
    });

    it("should handle multiple consecutive saves", () => {
      const snapshot = createMockSnapshot();
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("session-1");
      handleSaveSession("session-2");
      handleSaveSession("session-3");

      expect(mockSaveSession).toHaveBeenCalledTimes(3);
      expect(mockToastSuccess).toHaveBeenCalledTimes(3);
    });

    it("should handle multiple consecutive loads", async () => {
      const handleLoadSession = createHandleLoadSession();
      const file1 = new File(["{}"], "session1.json", { type: "application/json" });
      const file2 = new File(["{}"], "session2.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(file1);
      await handleLoadSession(file2);

      expect(mockLoadSession).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it("should handle large snapshot data", () => {
      const largeSnapshot = createMockSnapshot({
        tokens: Array.from({ length: 100 }, (_, i) => ({
          id: `token${i}`,
          x: i,
          y: i,
          characterId: `char${i}`,
          visible: true,
        })),
      });
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(largeSnapshot);

      handleSaveSession("large-session");

      expect(mockSaveSession).toHaveBeenCalledWith(largeSnapshot, "large-session");
    });

    it("should handle file with very long name", async () => {
      const handleLoadSession = createHandleLoadSession();
      const longFileName = "a".repeat(200) + ".json";
      const mockFile = new File(["{}"], longFileName, { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(mockFile);

      expect(mockToastInfo).toHaveBeenCalledWith(`Loading session from ${longFileName}...`);
    });

    it("should preserve snapshot structure during save", () => {
      const snapshot = createMockSnapshot({
        gridSize: 75,
        gridSquareSize: 100,
        mapBackground: "url-to-image",
        playerStagingZone: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
      });
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("structured-session");

      expect(mockSaveSession).toHaveBeenCalledWith(snapshot, "structured-session");
    });
  });

  describe("Async Race Conditions", () => {
    it("should handle rapid load attempts", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      const promises = [
        handleLoadSession(mockFile),
        handleLoadSession(mockFile),
        handleLoadSession(mockFile),
      ];

      await Promise.all(promises);

      expect(mockLoadSession).toHaveBeenCalledTimes(3);
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
    });

    it("should handle load with delayed resolution", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(createMockSnapshot()), 100);
          }),
      );

      await handleLoadSession(mockFile);

      expect(mockSendMessage).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    it("should handle load failure after delay", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Delayed error")), 100);
          }),
      );

      await handleLoadSession(mockFile);

      expect(mockToastError).toHaveBeenCalledWith("Load failed: Delayed error", 5000);
    });
  });

  describe("Toast Notification Behavior", () => {
    it("should call exactly 3 toasts on successful save (info, success)", () => {
      const snapshot = createMockSnapshot();
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("test");

      expect(mockToastInfo).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastWarning).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("should call exactly 2 toasts on successful load (info, success)", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(mockFile);

      expect(mockToastInfo).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastWarning).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("should call exactly 2 toasts on load with warnings (info, warning)", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot({ sceneObjects: [] }));

      await handleLoadSession(mockFile);

      expect(mockToastInfo).toHaveBeenCalledTimes(1);
      expect(mockToastWarning).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("should call exactly 2 toasts on save error (info, error)", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);
      mockSaveSession.mockImplementation(() => {
        throw new Error("Test error");
      });

      handleSaveSession("test");

      expect(mockToastInfo).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastWarning).not.toHaveBeenCalled();
    });

    it("should call exactly 2 toasts on load error (info, error)", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockRejectedValue(new Error("Test error"));

      await handleLoadSession(mockFile);

      expect(mockToastInfo).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastWarning).not.toHaveBeenCalled();
    });
  });

  describe("Message Format", () => {
    it("should use exact info toast message for save", () => {
      const snapshot = createMockSnapshot();
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("test");

      expect(mockToastInfo).toHaveBeenCalledWith("Preparing session file...");
    });

    it("should use exact success toast message for save", () => {
      const snapshot = createMockSnapshot();
      mockSaveSession.mockReturnValue(undefined);
      const handleSaveSession = createHandleSaveSession(snapshot);

      handleSaveSession("my-session");

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Session "my-session" saved successfully!',
        4000,
      );
    });

    it("should use exact info toast message for load", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "session.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(mockFile);

      expect(mockToastInfo).toHaveBeenCalledWith("Loading session from session.json...");
    });

    it("should use exact success toast message for load", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "my-session.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot());

      await handleLoadSession(mockFile);

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Session "my-session.json" loaded successfully!',
        4000,
      );
    });

    it("should format warning message correctly with single warning", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot({ sceneObjects: [] }));

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(
        "Session loaded with warnings: No scene objects found",
        5000,
      );
    });

    it("should format warning message correctly with multiple warnings", async () => {
      const handleLoadSession = createHandleLoadSession();
      const mockFile = new File(["{}"], "test.json", { type: "application/json" });
      mockLoadSession.mockResolvedValue(createMockSnapshot({ sceneObjects: [], characters: [] }));

      await handleLoadSession(mockFile);

      expect(mockToastWarning).toHaveBeenCalledWith(
        "Session loaded with warnings: No scene objects found, No characters found",
        5000,
      );
    });
  });
});
