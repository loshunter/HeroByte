// ============================================================================
// SHUTDOWN FLUSH TESTS
// ============================================================================
// SIGTERM used to exit from server.close()'s callback, which never fires while
// a WebSocket is open — so a deploy on a busy table skipped the final flush.
// The shutdown path now awaits flushStoresForShutdown(); these tests pin that
// it saves EVERY loaded room (not just the default) and actually awaits the
// writes before resolving. Driven through a real Container so the stores are
// wired exactly as bootstrap wires them.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
  renameSync: vi.fn(),
}));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}));

import { writeFile, rename } from "fs/promises";
import type { WebSocketServer } from "ws";
import { Container } from "../container.js";
import { flushStoresForShutdown } from "../shutdownFlush.js";
import { RoomRegistry } from "../domains/room/RoomRegistry.js";
import type { AuthService } from "../domains/auth/service.js";

const authServiceStub = {
  verify: () => true,
  hasDMPassword: () => false,
  getSummary: () => ({ source: "fallback", updatedAt: 0 }),
} as unknown as AuthService;

describe("flushStoresForShutdown", () => {
  let container: Container;

  beforeEach(() => {
    vi.mocked(writeFile).mockClear();
    vi.mocked(rename).mockClear();
    container = new Container(
      {} as unknown as WebSocketServer,
      authServiceStub,
      new RoomRegistry({ defaultRoomId: "default" }),
    );
  });

  it("saves every loaded room, not just the default", async () => {
    // Load two private rooms alongside the default and give each real state.
    container.getRoomServiceForRoom("room-a").getState().gridSize = 61;
    container.getRoomServiceForRoom("room-b").getState().gridSize = 62;

    await flushStoresForShutdown(container.roomRegistry, container.mapStudioService);

    // Atomic writes land via rename; the destination names the room's file.
    const destinations = vi.mocked(rename).mock.calls.map(([, dest]) => String(dest));
    expect(destinations.some((p) => p.endsWith("herobyte-state.json"))).toBe(true);
    expect(destinations.some((p) => p.endsWith("herobyte-state.room-a.json"))).toBe(true);
    expect(destinations.some((p) => p.endsWith("herobyte-state.room-b.json"))).toBe(true);
  });

  it("resolves only after the queued writes complete", async () => {
    let writeFinished = false;
    vi.mocked(writeFile).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      writeFinished = true;
    });

    await flushStoresForShutdown(container.roomRegistry, container.mapStudioService);

    expect(writeFinished).toBe(true);
  });
});
