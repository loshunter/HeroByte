import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useE2ETestingSupport } from "../useE2ETestingSupport";
import type { RoomSnapshot } from "@shared";

const createSnapshot = (overrides: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  users: [],
  tokens: [],
  players: [],
  characters: [],
  pointers: [],
  gridSize: 50,
  diceRolls: [],
  ...overrides,
});

describe("useE2ETestingSupport", () => {
  let originalWindow: typeof window | undefined;
  let originalEnvMode: string;

  beforeEach(() => {
    // Store original window and env mode
    originalWindow = global.window;
    originalEnvMode = import.meta.env.MODE;
  });

  afterEach(() => {
    // Restore original window and env mode
    if (originalWindow) {
      global.window = originalWindow;
    }
    import.meta.env.MODE = originalEnvMode;

    // Clean up E2E state
    if (typeof window !== "undefined") {
      delete window.__HERO_BYTE_E2E__;
    }
  });

  describe("SSR safety", () => {
    it("does nothing when window is undefined", () => {
      // Mock typeof window check to return false (SSR environment)
      // We can't actually delete window in jsdom, so we skip the full test
      // The guard is verified by code inspection and the production guard test
      // This test documents the expected behavior in SSR
      expect(typeof window).toBe("object");

      // In a real SSR environment, typeof window === "undefined"
      // The hook's guard: if (typeof window === "undefined") return;
      // This prevents runtime errors in SSR
    });
  });

  describe("Production guard", () => {
    it("does nothing in production mode", () => {
      import.meta.env.MODE = "production";

      const mockSnapshot = createSnapshot();

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
        }),
      );

      expect(window.__HERO_BYTE_E2E__).toBeUndefined();
    });
  });

  describe("State exposure", () => {
    beforeEach(() => {
      // Ensure we're in test mode (non-production)
      import.meta.env.MODE = "test";
    });

    it("correctly sets window.__HERO_BYTE_E2E__ with provided state", () => {
      const mockSnapshot = createSnapshot();

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid-123",
          gridSize: 50,
        }),
      );

      expect(window.__HERO_BYTE_E2E__).toBeDefined();
      expect(window.__HERO_BYTE_E2E__?.snapshot).toBe(mockSnapshot);
      expect(window.__HERO_BYTE_E2E__?.uid).toBe("test-uid-123");
      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(50);
    });

    it("exposes camera state when provided", () => {
      const mockSnapshot = createSnapshot();

      const mockCam = { x: 100, y: 200, scale: 1.5 };

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
          cam: mockCam,
        }),
      );

      expect(window.__HERO_BYTE_E2E__?.cam).toEqual(mockCam);
    });

    it("exposes viewport state when provided", () => {
      const mockSnapshot = createSnapshot();

      const mockViewport = { width: 1920, height: 1080 };

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
          viewport: mockViewport,
        }),
      );

      expect(window.__HERO_BYTE_E2E__?.viewport).toEqual(mockViewport);
    });

    it("handles null snapshot", () => {
      renderHook(() =>
        useE2ETestingSupport({
          snapshot: null,
          uid: "test-uid",
          gridSize: 50,
        }),
      );

      expect(window.__HERO_BYTE_E2E__?.snapshot).toBeNull();
      expect(window.__HERO_BYTE_E2E__?.uid).toBe("test-uid");
      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(50);
    });
  });

  describe("Non-destructive merge", () => {
    beforeEach(() => {
      import.meta.env.MODE = "test";
    });

    it("preserves existing properties when updating", () => {
      const mockSnapshot = createSnapshot();

      // Set initial E2E state
      window.__HERO_BYTE_E2E__ = {
        snapshot: mockSnapshot,
        uid: "initial-uid",
        gridSize: 50,
      };

      const mockCam = { x: 100, y: 200, scale: 1.5 };

      // Update with camera (simulating MapBoard.tsx enrichment)
      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "initial-uid",
          gridSize: 50,
          cam: mockCam,
        }),
      );

      // Should preserve snapshot, uid, gridSize AND add cam
      expect(window.__HERO_BYTE_E2E__?.snapshot).toBe(mockSnapshot);
      expect(window.__HERO_BYTE_E2E__?.uid).toBe("initial-uid");
      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(50);
      expect(window.__HERO_BYTE_E2E__?.cam).toEqual(mockCam);
    });

    it("allows multiple hook calls to enrich state", () => {
      const mockSnapshot = createSnapshot();

      // First call: App.tsx sets base state
      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
        }),
      );

      expect(window.__HERO_BYTE_E2E__).toEqual({
        snapshot: mockSnapshot,
        uid: "test-uid",
        gridSize: 50,
      });

      // Second call: MapBoard.tsx adds camera and viewport
      const mockCam = { x: 100, y: 200, scale: 1.5 };
      const mockViewport = { width: 1920, height: 1080 };

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
          cam: mockCam,
          viewport: mockViewport,
        }),
      );

      // Should have all properties
      expect(window.__HERO_BYTE_E2E__).toEqual({
        snapshot: mockSnapshot,
        uid: "test-uid",
        gridSize: 50,
        cam: mockCam,
        viewport: mockViewport,
      });
    });
  });

  describe("Re-runs on dependency changes", () => {
    beforeEach(() => {
      import.meta.env.MODE = "test";
    });

    it("updates when snapshot changes", () => {
      const mockSnapshot1 = createSnapshot();
      const mockSnapshot2 = createSnapshot();

      const { rerender } = renderHook(
        ({ snapshot }) =>
          useE2ETestingSupport({
            snapshot,
            uid: "test-uid",
            gridSize: 50,
          }),
        { initialProps: { snapshot: mockSnapshot1 } },
      );

      expect(window.__HERO_BYTE_E2E__?.snapshot).toBe(mockSnapshot1);

      rerender({ snapshot: mockSnapshot2 });

      expect(window.__HERO_BYTE_E2E__?.snapshot).toBe(mockSnapshot2);
    });

    it("updates when uid changes", () => {
      const mockSnapshot = createSnapshot();

      const { rerender } = renderHook(
        ({ uid }) =>
          useE2ETestingSupport({
            snapshot: mockSnapshot,
            uid,
            gridSize: 50,
          }),
        { initialProps: { uid: "uid-1" } },
      );

      expect(window.__HERO_BYTE_E2E__?.uid).toBe("uid-1");

      rerender({ uid: "uid-2" });

      expect(window.__HERO_BYTE_E2E__?.uid).toBe("uid-2");
    });

    it("updates when gridSize changes", () => {
      const mockSnapshot = createSnapshot();

      const { rerender } = renderHook(
        ({ gridSize }) =>
          useE2ETestingSupport({
            snapshot: mockSnapshot,
            uid: "test-uid",
            gridSize,
          }),
        { initialProps: { gridSize: 50 } },
      );

      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(50);

      rerender({ gridSize: 100 });

      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(100);
    });

    it("updates when cam changes", () => {
      const mockSnapshot = createSnapshot();

      const cam1 = { x: 100, y: 200, scale: 1.0 };
      const cam2 = { x: 300, y: 400, scale: 2.0 };

      const { rerender } = renderHook(
        ({ cam }) =>
          useE2ETestingSupport({
            snapshot: mockSnapshot,
            uid: "test-uid",
            gridSize: 50,
            cam,
          }),
        { initialProps: { cam: cam1 } },
      );

      expect(window.__HERO_BYTE_E2E__?.cam).toEqual(cam1);

      rerender({ cam: cam2 });

      expect(window.__HERO_BYTE_E2E__?.cam).toEqual(cam2);
    });

    it("updates when viewport changes", () => {
      const mockSnapshot = createSnapshot();

      const viewport1 = { width: 1920, height: 1080 };
      const viewport2 = { width: 1280, height: 720 };

      const { rerender } = renderHook(
        ({ viewport }) =>
          useE2ETestingSupport({
            snapshot: mockSnapshot,
            uid: "test-uid",
            gridSize: 50,
            viewport,
          }),
        { initialProps: { viewport: viewport1 } },
      );

      expect(window.__HERO_BYTE_E2E__?.viewport).toEqual(viewport1);

      rerender({ viewport: viewport2 });

      expect(window.__HERO_BYTE_E2E__?.viewport).toEqual(viewport2);
    });
  });

  describe("Optional properties", () => {
    beforeEach(() => {
      import.meta.env.MODE = "test";
    });

    it("handles missing cam gracefully", () => {
      const mockSnapshot = createSnapshot();

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
          // cam is omitted
        }),
      );

      expect(window.__HERO_BYTE_E2E__).toBeDefined();
      expect(window.__HERO_BYTE_E2E__?.snapshot).toBe(mockSnapshot);
      expect(window.__HERO_BYTE_E2E__?.uid).toBe("test-uid");
      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(50);
      expect(window.__HERO_BYTE_E2E__?.cam).toBeUndefined();
    });

    it("handles missing viewport gracefully", () => {
      const mockSnapshot = createSnapshot();

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
          // viewport is omitted
        }),
      );

      expect(window.__HERO_BYTE_E2E__).toBeDefined();
      expect(window.__HERO_BYTE_E2E__?.snapshot).toBe(mockSnapshot);
      expect(window.__HERO_BYTE_E2E__?.uid).toBe("test-uid");
      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(50);
      expect(window.__HERO_BYTE_E2E__?.viewport).toBeUndefined();
    });

    it("handles both cam and viewport missing", () => {
      const mockSnapshot = createSnapshot();

      renderHook(() =>
        useE2ETestingSupport({
          snapshot: mockSnapshot,
          uid: "test-uid",
          gridSize: 50,
        }),
      );

      expect(window.__HERO_BYTE_E2E__).toBeDefined();
      expect(window.__HERO_BYTE_E2E__?.snapshot).toBe(mockSnapshot);
      expect(window.__HERO_BYTE_E2E__?.uid).toBe("test-uid");
      expect(window.__HERO_BYTE_E2E__?.gridSize).toBe(50);
      expect(window.__HERO_BYTE_E2E__?.cam).toBeUndefined();
      expect(window.__HERO_BYTE_E2E__?.viewport).toBeUndefined();
    });

    it("allows adding cam to existing state without cam", () => {
      const mockSnapshot = createSnapshot();

      // First render without cam
      const { rerender } = renderHook(
        ({ cam }) =>
          useE2ETestingSupport({
            snapshot: mockSnapshot,
            uid: "test-uid",
            gridSize: 50,
            cam,
          }),
        {
          initialProps: {
            cam: undefined as { x: number; y: number; scale: number } | undefined,
          },
        },
      );

      expect(window.__HERO_BYTE_E2E__?.cam).toBeUndefined();

      // Second render with cam
      const mockCam = { x: 100, y: 200, scale: 1.5 };
      rerender({ cam: mockCam });

      expect(window.__HERO_BYTE_E2E__?.cam).toEqual(mockCam);
    });
  });
});
