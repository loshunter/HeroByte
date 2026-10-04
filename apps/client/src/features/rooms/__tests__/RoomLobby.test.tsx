import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RoomLobby } from "../RoomLobby";
import { rememberRoom } from "../roomDirectory";
import { readNewTable } from "../../table/newTableMarker";

describe("RoomLobby", () => {
  beforeEach(() => {
    let store: Record<string, string> = {};
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
    store = {};
  });

  // Which table you're joining, and the list of remembered ones, moved to
  // TablePicker (it sits above the single password field now). What's left here
  // are the actions around that choice.
  it("forgets the table you're currently on, without navigating", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    window.history.replaceState({}, "", "/?room=dragons-den");
    rememberRoom("dragons-den");
    const onNavigate = vi.fn();
    render(<RoomLobby onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Forget dragons-den" }));

    expect(onNavigate).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    window.history.replaceState({}, "", "/");
  });

  it("offers no forget action on the test table — there is nothing to forget", () => {
    render(<RoomLobby onNavigate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Forget/ })).toBeNull();
  });

  it("mints a fresh table id for NEW TABLE (no create handler → plain navigate)", () => {
    const onNavigate = vi.fn();
    render(<RoomLobby onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /New Table/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0]![0]).toMatch(/^table-[a-z2-9]{6}$/);
  });

  it("creates a private table with a room password, then navigates into it", async () => {
    const onNavigate = vi.fn();
    const onCreateRoom = vi.fn().mockResolvedValue(undefined);
    render(<RoomLobby onNavigate={onNavigate} onCreateRoom={onCreateRoom} />);

    // New Table opens a form instead of navigating immediately.
    fireEvent.click(screen.getByRole("button", { name: /New Table/i }));
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("New table password"), {
      target: { value: "dragons6" },
    });
    fireEvent.change(screen.getByLabelText("New DM password"), {
      target: { value: "masterkey8" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create private table/i }));

    await vi.waitFor(() => expect(onCreateRoom).toHaveBeenCalledTimes(1));
    const input = onCreateRoom.mock.calls[0]![0];
    expect(input.roomId).toMatch(/^table-[a-z2-9]{6}$/);
    expect(input.roomPassword).toBe("dragons6");
    expect(input.dmPassword).toBe("masterkey8");
    await vi.waitFor(() => expect(onNavigate).toHaveBeenCalledWith(input.roomId));
    // The page is about to be replaced: leave a note for the next one that THIS tab
    // made the table, so its host is shown what to do next (Enter DM mode, Invite).
    expect(readNewTable(input.roomId)).toBe(true);
  });

  it("a create the server refuses leaves no note and goes nowhere", async () => {
    const onNavigate = vi.fn();
    const onCreateRoom = vi.fn().mockRejectedValue(new Error("Name taken"));
    render(<RoomLobby onNavigate={onNavigate} onCreateRoom={onCreateRoom} />);

    fireEvent.click(screen.getByRole("button", { name: /New Table/i }));
    fireEvent.change(screen.getByLabelText("New table password"), {
      target: { value: "dragons6" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create private table/i }));

    expect(await screen.findByText("Name taken")).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    const attempted = onCreateRoom.mock.calls[0]![0].roomId as string;
    expect(readNewTable(attempted)).toBe(false);
  });

  it("rejects a too-short room password before calling the server", () => {
    const onNavigate = vi.fn();
    const onCreateRoom = vi.fn().mockResolvedValue(undefined);
    render(<RoomLobby onNavigate={onNavigate} onCreateRoom={onCreateRoom} />);

    fireEvent.click(screen.getByRole("button", { name: /New Table/i }));
    fireEvent.change(screen.getByLabelText("New table password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /Create private table/i }));

    expect(onCreateRoom).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
  });

  it("joins by code after validating it", () => {
    const onNavigate = vi.fn();
    render(<RoomLobby onNavigate={onNavigate} />);
    const input = screen.getByLabelText("Table code");

    fireEvent.change(input, { target: { value: "bad code!" } });
    fireEvent.submit(input.closest("form")!);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText(/letters, numbers/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "castle-3f9" } });
    fireEvent.submit(input.closest("form")!);
    expect(onNavigate).toHaveBeenCalledWith("castle-3f9");
  });
});
