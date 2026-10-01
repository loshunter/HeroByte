import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { MainLayoutProps } from "../../../layouts/props/MainLayoutProps";
import { buildTableMenuProps, useTableMenuProps } from "../tableMenuProps";

const bag = (overrides: Record<string, unknown> = {}) =>
  ({
    uid: "uid-1",
    isConnected: true,
    isDM: false,
    roleKnown: true,
    handleToggleDM: vi.fn(),
    crtFilter: false,
    setCrtFilter: vi.fn(),
    snapshot: { tableName: "Sunday Game", isPublicTable: false },
    ...overrides,
  }) as unknown as MainLayoutProps;

describe("buildTableMenuProps — one mapping for the header's Table button and the phone's Table screen", () => {
  it("maps the bag onto the menu's shape", () => {
    const props = bag();
    const menu = buildTableMenuProps(props);
    expect(menu).toEqual({
      uid: "uid-1",
      tableName: "Sunday Game",
      isPublicTable: false,
      isConnected: true,
      isDM: false,
      roleKnown: true,
      onToggleDM: props.handleToggleDM,
      crtFilter: false,
      onCrtFilterChange: props.setCrtFilter,
    });
  });

  it("takes the role from the PASSED-IN flag, never from the snapshot's own players", () => {
    // The snapshot's value reads false on reconnect; the bag's isDM is the app's
    // derived truth. A snapshot that says the viewer is a DM cannot override it.
    const menu = buildTableMenuProps(
      bag({
        isDM: false,
        snapshot: {
          players: [{ uid: "uid-1", name: "P", isDM: true }],
          tableName: "Sunday Game",
        },
      }),
    );
    expect(menu.isDM).toBe(false);
  });

  it("carries the roster test through as it was computed: a blip is not a known role", () => {
    expect(buildTableMenuProps(bag({ roleKnown: false, isDM: true })).roleKnown).toBe(false);
  });

  it("copes with no snapshot at all, which is every socket close", () => {
    const menu = buildTableMenuProps(bag({ snapshot: null }));
    expect(menu.tableName).toBeUndefined();
    expect(menu.isPublicTable).toBe(false);
  });

  it("says the connection as the socket has it: a lost server reads offline, and CRT as it is set", () => {
    const menu = buildTableMenuProps(bag({ isConnected: false, snapshot: null, crtFilter: true }));
    expect(menu.isConnected).toBe(false);
    expect(menu.crtFilter).toBe(true);
  });

  it("flags the public test table only when the snapshot says so", () => {
    expect(buildTableMenuProps(bag({ snapshot: { isPublicTable: true } })).isPublicTable).toBe(
      true,
    );
    expect(buildTableMenuProps(bag({ snapshot: {} })).isPublicTable).toBe(false);
  });
});

describe("useTableMenuProps — facts about the table outlast the snapshot", () => {
  // Every socket close nulls the snapshot while the app stays mounted. The table's NAME and
  // whether it is the public test table are facts about the table, not role judgments, and
  // the public-table warning is a ROW of the header now: dropped with the snapshot, it
  // removed a row and put it back on every reconnect, shifting the whole layout.
  it("keeps the name and the public flag through a reconnect's empty snapshot, and takes the next one's", () => {
    const { result, rerender } = renderHook((props: MainLayoutProps) => useTableMenuProps(props), {
      initialProps: bag({ snapshot: { tableName: "Sunday Game", isPublicTable: true } }),
    });
    expect(result.current).toMatchObject({ tableName: "Sunday Game", isPublicTable: true });

    rerender(bag({ snapshot: null, isConnected: false, roleKnown: false }));
    expect(result.current).toMatchObject({ tableName: "Sunday Game", isPublicTable: true });

    rerender(bag({ snapshot: { tableName: "Monday Game", isPublicTable: false } }));
    expect(result.current).toMatchObject({ tableName: "Monday Game", isPublicTable: false });
  });

  it("holds ONLY those facts: the connection and the role are read live, never remembered", () => {
    const { result, rerender } = renderHook((props: MainLayoutProps) => useTableMenuProps(props), {
      initialProps: bag({ isDM: true }),
    });
    expect(result.current).toMatchObject({ isDM: true, roleKnown: true, isConnected: true });
    rerender(bag({ snapshot: null, isDM: false, roleKnown: false, isConnected: false }));
    expect(result.current).toMatchObject({ isDM: false, roleKnown: false, isConnected: false });
  });

  it("has nothing to hold before any snapshot has arrived", () => {
    const { result } = renderHook((props: MainLayoutProps) => useTableMenuProps(props), {
      initialProps: bag({ snapshot: null }),
    });
    expect(result.current).toMatchObject({ tableName: undefined, isPublicTable: false });
  });
});
