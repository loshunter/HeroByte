import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  currentRoomId,
  forgetRoom,
  generateRoomId,
  listRememberedRooms,
  rememberRoom,
  roomUrl,
} from "../roomDirectory";

describe("roomDirectory", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
      },
      writable: true,
      configurable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("currentRoomId", () => {
    it("reads a valid room from the query string", () => {
      expect(currentRoomId("?room=castle-3f9")).toBe("castle-3f9");
    });

    it("returns undefined for missing or malformed rooms", () => {
      expect(currentRoomId("")).toBeUndefined();
      expect(currentRoomId("?room=")).toBeUndefined();
      expect(currentRoomId("?room=../etc")).toBeUndefined();
      expect(currentRoomId("?room=-leading-dash")).toBeUndefined();
    });
  });

  describe("remembered rooms", () => {
    it("remembers rooms most-recent first and deduplicates", () => {
      vi.setSystemTime(1000);
      rememberRoom("room-a");
      vi.setSystemTime(2000);
      rememberRoom("room-b");
      vi.setSystemTime(3000);
      rememberRoom("room-a");

      expect(listRememberedRooms().map((room) => room.roomId)).toEqual(["room-a", "room-b"]);
    });

    it("caps the shelf at twelve tables", () => {
      for (let index = 0; index < 15; index += 1) {
        vi.setSystemTime(1000 + index);
        rememberRoom(`room-${index}`);
      }

      const rooms = listRememberedRooms();
      expect(rooms).toHaveLength(12);
      expect(rooms[0]!.roomId).toBe("room-14");
    });

    it("forgets a table", () => {
      rememberRoom("room-a");
      rememberRoom("room-b");

      forgetRoom("room-a");

      expect(listRememberedRooms().map((room) => room.roomId)).toEqual(["room-b"]);
    });

    it("ignores malformed ids and corrupted storage", () => {
      rememberRoom("bad room!");
      expect(listRememberedRooms()).toEqual([]);

      store["herobyte-room-directory"] = "{not json";
      expect(listRememberedRooms()).toEqual([]);
    });
  });

  describe("generateRoomId", () => {
    it("mints ids matching the server's room-id rule", () => {
      for (let index = 0; index < 20; index += 1) {
        expect(generateRoomId()).toMatch(/^table-[a-z2-9]{6}$/);
      }
    });
  });

  describe("roomUrl", () => {
    it("sets and clears the room parameter", () => {
      expect(roomUrl("room-a", "http://host/app?room=old&x=1")).toBe(
        "http://host/app?room=room-a&x=1",
      );
      expect(roomUrl(undefined, "http://host/app?room=old&x=1")).toBe("http://host/app?x=1");
    });
  });
});
