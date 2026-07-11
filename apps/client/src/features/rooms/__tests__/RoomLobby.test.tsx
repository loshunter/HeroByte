import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RoomLobby } from "../RoomLobby";
import { rememberRoom } from "../roomDirectory";

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

  it("shows the default table when no room is in the URL", () => {
    render(<RoomLobby onNavigate={vi.fn()} />);
    expect(screen.getByText(/Main Hall/)).toBeInTheDocument();
  });

  it("lists remembered tables and navigates on click", () => {
    rememberRoom("dragons-den");
    const onNavigate = vi.fn();
    render(<RoomLobby onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "dragons-den" }));

    expect(onNavigate).toHaveBeenCalledWith("dragons-den");
  });

  it("forgets a table without navigating", () => {
    rememberRoom("dragons-den");
    const onNavigate = vi.fn();
    render(<RoomLobby onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Forget dragons-den" }));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "dragons-den" })).toBeNull();
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

    fireEvent.change(screen.getByLabelText("New room password"), {
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
  });

  it("rejects a too-short room password before calling the server", () => {
    const onNavigate = vi.fn();
    const onCreateRoom = vi.fn().mockResolvedValue(undefined);
    render(<RoomLobby onNavigate={onNavigate} onCreateRoom={onCreateRoom} />);

    fireEvent.click(screen.getByRole("button", { name: /New Table/i }));
    fireEvent.change(screen.getByLabelText("New room password"), { target: { value: "short" } });
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
