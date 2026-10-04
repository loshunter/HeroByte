import { describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { buildTableControls, type TableControlsWiring } from "../tableControls";

const wiring = (): TableControlsWiring => ({
  onToggleDM: vi.fn(),
  connectedUids: ["p1"],
  onSelectPlayerTokens: vi.fn(),
  onRemovePlayer: vi.fn(),
  onPlayerPropsEnabledChange: vi.fn(),
  onInitiativeManualOverrideChange: vi.fn(),
  onRequestSaveSession: vi.fn(),
  onRequestLoadSession: vi.fn(),
  onSetRoomPassword: vi.fn(),
  roomPasswordStatus: null,
  roomPasswordPending: false,
  onDismissRoomPasswordStatus: vi.fn(),
  onSaveAsPrivateTable: undefined,
});

const snapshot = (overrides: Record<string, unknown> = {}) =>
  ({
    players: [{ uid: "p1", name: "Alice" }],
    characters: [{ id: "c1" }],
    sceneObjects: [{ id: "token:t1" }],
    ...overrides,
  }) as unknown as RoomSnapshot;

describe("buildTableControls — the Table tab's one object", () => {
  it("passes the wiring through untouched, so a sender cannot be silently swapped", () => {
    const w = wiring();
    const controls = buildTableControls(snapshot(), w);
    expect(controls.onToggleDM).toBe(w.onToggleDM);
    expect(controls.onRemovePlayer).toBe(w.onRemovePlayer);
    expect(controls.onRequestLoadSession).toBe(w.onRequestLoadSession);
    expect(controls.onSetRoomPassword).toBe(w.onSetRoomPassword);
    expect(controls.connectedUids).toBe(w.connectedUids);
  });

  it("reads the roster and what is on the table off the snapshot", () => {
    const controls = buildTableControls(snapshot(), wiring());
    expect(controls.players).toEqual([{ uid: "p1", name: "Alice" }]);
    expect(controls.characters).toEqual([{ id: "c1" }]);
    expect(controls.sceneObjects).toEqual([{ id: "token:t1" }]);
  });

  it("names the table and whether it is the public test table", () => {
    expect(buildTableControls(snapshot({ tableName: "Sunday Game" }), wiring()).tableName).toBe(
      "Sunday Game",
    );
    expect(buildTableControls(snapshot({ isPublicTable: true }), wiring()).isPublicTable).toBe(
      true,
    );
    expect(buildTableControls(snapshot(), wiring()).isPublicTable).toBe(false);
  });

  it("player props default OFF and hand-entered rolls default ON, which the snapshot encodes differently", () => {
    // The snapshot carries `initiativeManualOverride` only when it is off, and
    // `playerPropsEnabled` only when it is on: the asymmetry is where it breaks.
    const fresh = buildTableControls(snapshot(), wiring());
    expect(fresh.playerPropsEnabled).toBe(false);
    expect(fresh.initiativeManualOverride).toBe(true);

    const changed = buildTableControls(
      snapshot({ playerPropsEnabled: true, initiativeManualOverride: false }),
      wiring(),
    );
    expect(changed.playerPropsEnabled).toBe(true);
    expect(changed.initiativeManualOverride).toBe(false);
  });

  it("is safe with no snapshot, which is every socket close", () => {
    const controls = buildTableControls(null, wiring());
    expect(controls.players).toEqual([]);
    expect(controls.sceneObjects).toEqual([]);
    expect(controls.characters).toEqual([]);
    expect(controls.tableName).toBeUndefined();
    expect(controls.isPublicTable).toBe(false);
    expect(controls.initiativeManualOverride).toBe(true);
  });
});
