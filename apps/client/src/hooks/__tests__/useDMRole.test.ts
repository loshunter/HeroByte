/**
 * Tests for useDMRole hook
 *
 * Tests the hook that manages DM role state and provides elevation functionality.
 * Follows SOLID principles with single-responsibility tests organized by concern.
 *
 * Source: apps/client/src/hooks/useDMRole.ts
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useClearOnDemotion, useDMRole } from "../useDMRole.js";
import type { RoomSnapshot, ClientMessage, Player } from "@herobyte/shared";

describe("useDMRole - isDM Computation", () => {
  const mockSend = vi.fn<(message: ClientMessage) => void>();
  const testUid = "player-123";

  beforeEach(() => {
    mockSend.mockClear();
  });

  describe("when player is DM", () => {
    it("should return isDM as true when player has isDM flag set", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [
          { uid: testUid, name: "Player 1", isDM: true },
          { uid: "other-uid", name: "Player 2", isDM: false },
        ],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      expect(result.current.isDM).toBe(true);
    });

    it("should return isDM as true when player has isDM flag explicitly true", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "DM Player", isDM: true }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      expect(result.current.isDM).toBe(true);
    });
  });

  describe("when player is not DM", () => {
    it("should return isDM as false when player has isDM flag set to false", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Regular Player", isDM: false }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      expect(result.current.isDM).toBe(false);
    });

    it("should return isDM as false when player has no isDM flag (undefined)", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player without isDM" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      expect(result.current.isDM).toBe(false);
    });
  });

  describe("when snapshot is null", () => {
    it("should return isDM as false when snapshot is null", () => {
      const { result } = renderHook(() =>
        useDMRole({ snapshot: null, uid: testUid, send: mockSend }),
      );

      expect(result.current.isDM).toBe(false);
    });
  });

  describe("when players array is empty", () => {
    it("should return isDM as false when players array is empty", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      expect(result.current.isDM).toBe(false);
    });
  });

  describe("when players array is undefined", () => {
    it("should return isDM as false when players array is undefined", () => {
      const snapshot = {
        users: [],
        tokens: [],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      } as unknown as RoomSnapshot;

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      expect(result.current.isDM).toBe(false);
    });
  });

  describe("when player is not found in array", () => {
    it("should return isDM as false when player UID does not match any player", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [
          { uid: "other-player-1", name: "Player 1", isDM: true },
          { uid: "other-player-2", name: "Player 2", isDM: false },
        ],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      expect(result.current.isDM).toBe(false);
    });

    it("should return isDM as false when player UID is empty string", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: "player-1", name: "Player 1", isDM: true }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: "", send: mockSend }));

      expect(result.current.isDM).toBe(false);
    });
  });
});

describe("useDMRole - roleKnown (the roster has arrived)", () => {
  const send = vi.fn<(message: ClientMessage) => void>();
  const uid = "player-123";
  const snapshotWith = (players: Player[]): RoomSnapshot =>
    ({
      users: [],
      tokens: [],
      players,
      characters: [],
      pointers: [],
      drawings: [],
      gridSize: 50,
      diceRolls: [],
    }) as RoomSnapshot;
  const read = (snapshot: RoomSnapshot | null) =>
    renderHook(() => useDMRole({ snapshot, uid, send })).result.current;

  it("is true once the viewer's own seat is in the roster, DM or not", () => {
    expect(read(snapshotWith([{ uid, name: "P", isDM: true }])).roleKnown).toBe(true);
    expect(read(snapshotWith([{ uid, name: "P", isDM: false }])).roleKnown).toBe(true);
  });

  it("is false while there is no snapshot: every socket close, when isDM reads false for a DM too", () => {
    const blip = read(null);
    expect(blip.isDM).toBe(false);
    expect(blip.roleKnown).toBe(false);
  });

  it("is false for a snapshot whose roster is someone else's, empty, or missing", () => {
    expect(read(snapshotWith([{ uid: "other", name: "O", isDM: true }])).roleKnown).toBe(false);
    expect(read(snapshotWith([])).roleKnown).toBe(false);
    expect(
      read({ ...snapshotWith([]), players: undefined } as unknown as RoomSnapshot).roleKnown,
    ).toBe(false);
  });
});

describe("useDMRole - elevateToDM Function", () => {
  const mockSend = vi.fn<(message: ClientMessage) => void>();
  const testUid = "player-123";

  beforeEach(() => {
    mockSend.mockClear();
  });

  describe("message sending", () => {
    it("should send elevate-to-dm message with correct password", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player", isDM: false }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      result.current.elevateToDM("secret-password");

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        t: "elevate-to-dm",
        dmPassword: "secret-password",
      });
    });

    it("should send message with empty string password", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      result.current.elevateToDM("");

      expect(mockSend).toHaveBeenCalledWith({
        t: "elevate-to-dm",
        dmPassword: "",
      });
    });

    it("should send message with password containing special characters", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      const specialPassword = "p@$$w0rd!#$%^&*()";
      result.current.elevateToDM(specialPassword);

      expect(mockSend).toHaveBeenCalledWith({
        t: "elevate-to-dm",
        dmPassword: specialPassword,
      });
    });

    it("should send message with password containing whitespace", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      const passwordWithSpaces = "  password with spaces  ";
      result.current.elevateToDM(passwordWithSpaces);

      expect(mockSend).toHaveBeenCalledWith({
        t: "elevate-to-dm",
        dmPassword: passwordWithSpaces,
      });
    });

    it("should send message with unicode password", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      const unicodePassword = "пароль密码🔒";
      result.current.elevateToDM(unicodePassword);

      expect(mockSend).toHaveBeenCalledWith({
        t: "elevate-to-dm",
        dmPassword: unicodePassword,
      });
    });
  });

  describe("multiple calls", () => {
    it("should send message for each call with different passwords", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

      result.current.elevateToDM("password1");
      result.current.elevateToDM("password2");
      result.current.elevateToDM("password3");

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend).toHaveBeenNthCalledWith(1, {
        t: "elevate-to-dm",
        dmPassword: "password1",
      });
      expect(mockSend).toHaveBeenNthCalledWith(2, {
        t: "elevate-to-dm",
        dmPassword: "password2",
      });
      expect(mockSend).toHaveBeenNthCalledWith(3, {
        t: "elevate-to-dm",
        dmPassword: "password3",
      });
    });
  });
});

describe("useDMRole - Callback Stability", () => {
  const testUid = "player-123";

  describe("isDM memoization", () => {
    it("should recompute isDM when snapshot.players changes", () => {
      const mockSend = vi.fn<(message: ClientMessage) => void>();

      const snapshot1: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player", isDM: false }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result, rerender } = renderHook(
        ({ snapshot }: { snapshot: RoomSnapshot | null }) =>
          useDMRole({ snapshot, uid: testUid, send: mockSend }),
        { initialProps: { snapshot: snapshot1 } },
      );

      expect(result.current.isDM).toBe(false);

      const snapshot2: RoomSnapshot = {
        ...snapshot1,
        players: [{ uid: testUid, name: "Player", isDM: true }],
      };

      rerender({ snapshot: snapshot2 });

      expect(result.current.isDM).toBe(true);
    });

    it("should recompute isDM when uid changes", () => {
      const mockSend = vi.fn<(message: ClientMessage) => void>();

      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [
          { uid: "player-1", name: "Player 1", isDM: true },
          { uid: "player-2", name: "Player 2", isDM: false },
        ],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result, rerender } = renderHook(
        ({ uid }: { uid: string }) => useDMRole({ snapshot, uid, send: mockSend }),
        { initialProps: { uid: "player-1" } },
      );

      expect(result.current.isDM).toBe(true);

      rerender({ uid: "player-2" });

      expect(result.current.isDM).toBe(false);
    });

    it("should not recompute isDM when unrelated snapshot properties change", () => {
      const mockSend = vi.fn<(message: ClientMessage) => void>();

      const players: Player[] = [{ uid: testUid, name: "Player", isDM: true }];

      const snapshot1: RoomSnapshot = {
        users: [],
        tokens: [],
        players,
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result, rerender } = renderHook(
        ({ snapshot }: { snapshot: RoomSnapshot | null }) =>
          useDMRole({ snapshot, uid: testUid, send: mockSend }),
        { initialProps: { snapshot: snapshot1 } },
      );

      const firstIsDM = result.current.isDM;

      // Change unrelated property (same players reference)
      const snapshot2: RoomSnapshot = {
        ...snapshot1,
        gridSize: 100,
      };

      rerender({ snapshot: snapshot2 });

      // Should be same boolean value
      expect(result.current.isDM).toBe(firstIsDM);
    });
  });

  describe("elevateToDM callback stability", () => {
    it("should maintain callback reference when send is stable", () => {
      const mockSend = vi.fn<(message: ClientMessage) => void>();

      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result, rerender } = renderHook(() =>
        useDMRole({ snapshot, uid: testUid, send: mockSend }),
      );

      const firstCallback = result.current.elevateToDM;
      rerender();
      const secondCallback = result.current.elevateToDM;

      expect(firstCallback).toBe(secondCallback);
    });

    it("should update callback when send function changes", () => {
      const mockSend1 = vi.fn<(message: ClientMessage) => void>();
      const mockSend2 = vi.fn<(message: ClientMessage) => void>();

      const snapshot: RoomSnapshot = {
        users: [],
        tokens: [],
        players: [{ uid: testUid, name: "Player" }],
        characters: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
      };

      const { result, rerender } = renderHook(
        ({ send }: { send: (msg: ClientMessage) => void }) =>
          useDMRole({ snapshot, uid: testUid, send }),
        { initialProps: { send: mockSend1 } },
      );

      const firstCallback = result.current.elevateToDM;

      rerender({ send: mockSend2 });

      const secondCallback = result.current.elevateToDM;

      expect(firstCallback).not.toBe(secondCallback);

      // Verify new send is used
      result.current.elevateToDM("test-password");

      expect(mockSend1).not.toHaveBeenCalled();
      expect(mockSend2).toHaveBeenCalledWith({
        t: "elevate-to-dm",
        dmPassword: "test-password",
      });
    });
  });
});

describe("useDMRole - Return Value", () => {
  const mockSend = vi.fn<(message: ClientMessage) => void>();
  const testUid = "player-123";

  it("should return object with isDM and elevateToDM properties", () => {
    const snapshot: RoomSnapshot = {
      users: [],
      tokens: [],
      players: [{ uid: testUid, name: "Player" }],
      characters: [],
      pointers: [],
      drawings: [],
      gridSize: 50,
      diceRolls: [],
    };

    const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

    expect(result.current).toHaveProperty("isDM");
    expect(result.current).toHaveProperty("elevateToDM");
  });

  it("should return boolean for isDM property", () => {
    const snapshot: RoomSnapshot = {
      users: [],
      tokens: [],
      players: [{ uid: testUid, name: "Player" }],
      characters: [],
      pointers: [],
      drawings: [],
      gridSize: 50,
      diceRolls: [],
    };

    const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

    expect(typeof result.current.isDM).toBe("boolean");
  });

  it("should return function for elevateToDM property", () => {
    const snapshot: RoomSnapshot = {
      users: [],
      tokens: [],
      players: [{ uid: testUid, name: "Player" }],
      characters: [],
      pointers: [],
      drawings: [],
      gridSize: 50,
      diceRolls: [],
    };

    const { result } = renderHook(() => useDMRole({ snapshot, uid: testUid, send: mockSend }));

    expect(typeof result.current.elevateToDM).toBe("function");
  });
});

describe("useClearOnDemotion — the DM snapshot cache ends with the role", () => {
  // App caches the last DM-visible snapshot so a DM's NPCs and tokens do not vanish while a
  // reconnect is in flight. A restart or a revoke that clears the elevation must end that
  // cache: left behind, every LATER blip would paint the pre-demotion snapshot — hidden
  // NPCs included — over what is now a player's screen.
  const cache = { players: [] };
  const run = (serverIsDM: boolean, roleKnown: boolean, cached: boolean) => {
    const clear = vi.fn();
    const view = renderHook(
      (props) => useClearOnDemotion(props.isDM, props.known, props.cache, clear),
      { initialProps: { isDM: serverIsDM, known: roleKnown, cache: cached ? cache : null } },
    );
    return { clear, ...view };
  };

  it("clears the cache once the roster says this seat is no DM", () => {
    const { clear } = run(false, true, true);
    expect(clear).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("does not clear for a reconnect blip: the roster is not back, so the flag reads false for no reason", () => {
    const { clear } = run(false, false, true);
    expect(clear).not.toHaveBeenCalled();
  });

  it("does not clear while the viewer IS a DM", () => {
    const { clear } = run(true, true, true);
    expect(clear).not.toHaveBeenCalled();
  });

  it("has nothing to clear without a cache", () => {
    const { clear } = run(false, true, false);
    expect(clear).not.toHaveBeenCalled();
  });

  it("acts on the demotion when it arrives after the blip that started it", () => {
    // A restart: the socket closes (blip, cache kept), then the roster returns WITHOUT the DM flag.
    const { clear, rerender } = run(true, true, true);
    rerender({ isDM: false, known: false, cache });
    expect(clear).not.toHaveBeenCalled();
    rerender({ isDM: false, known: true, cache });
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
