// Characterization for the invite panel (it had no unit test) — what a DM sees,
// copies, and is told, including the clipboard-refused case the LAN-IP invite hits.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TableInviteControl } from "../TableInviteControl";
import { installMemoryStorage } from "../../../../test-utils/memoryStorage";

const writeText = vi.fn();

beforeEach(() => {
  installMemoryStorage();
  vi.useRealTimers();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("TableInviteControl — Invite", () => {
  it("shows the table's name and code, and the link that goes to it", () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    render(<TableInviteControl tableName="Sunday Game" />);
    expect(screen.getByText("Sunday Game (table-abc123)")).toBeInTheDocument();
    expect(screen.getByText(/\?room=table-abc123$/)).toBeInTheDocument();
  });

  it("names the table from this browser's shelf when the snapshot has not said (a DM who joined by link has none)", () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    localStorage.setItem(
      "herobyte-room-directory",
      JSON.stringify([{ roomId: "table-abc123", lastJoined: 1, name: "Shelf Name" }]),
    );
    render(<TableInviteControl />);
    expect(screen.getByText("Shelf Name (table-abc123)")).toBeInTheDocument();
  });

  it("falls back to the bare code when nothing names the table", () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    render(<TableInviteControl />);
    expect(screen.getByText("table-abc123")).toBeInTheDocument();
  });

  it("copies the link, says so, and forgets it a moment later", async () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    render(<TableInviteControl tableName="Sunday Game" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toMatch(/\?room=table-abc123$/);
    expect(await screen.findByRole("button", { name: "✓ Copied" })).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByRole("button", { name: "Copy invite link" })).toBeInTheDocument(),
      { timeout: 3_000 },
    );
  });

  it("shows the link for a manual copy when the clipboard is refused (a LAN IP is not a secure origin)", async () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    writeText.mockRejectedValue(new Error("not allowed"));
    render(<TableInviteControl />);
    fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }));
    const manual = (await screen.findByLabelText(
      "Invite link — copy this manually",
    )) as HTMLInputElement;
    expect(manual.readOnly).toBe(true);
    expect(manual.value).toMatch(/\?room=table-abc123$/);
    expect(screen.queryByRole("button", { name: "✓ Copied" })).toBeNull();
  });

  it("says the link never carries the password on a private table", () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    render(<TableInviteControl />);
    expect(
      screen.getByText(/never carries the password, so send it separately/i),
    ).toBeInTheDocument();
  });

  // The client cannot tell whether the host changed the Main Hall password, so it
  // names the setup docs' one only as the default.
  it("on the default table names the Main Hall password, the setup docs' one by default", () => {
    render(<TableInviteControl />);
    expect(screen.getByText("Main Hall — public test table")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Anyone with the Main Hall password can reach this table: the one in the setup docs, unless the host changed it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/password is the one published/i)).toBeNull();
  });
});
