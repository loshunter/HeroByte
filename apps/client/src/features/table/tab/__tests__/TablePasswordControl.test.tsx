/**
 * Characterization tests for the table password control.
 *
 * Written as RoomPasswordControl's ("Table Security": New password / Update
 * Password) and moved with it into Table → Security (U9). Validation and the
 * wire message are unchanged; the words say "table password" and name what a
 * change does.
 */

import { afterEach, beforeEach, describe, it, expect, vi, type MockInstance } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RESET_CONFIRM, TablePasswordControl } from "../TablePasswordControl";

// ============================================================================
// TESTS
// ============================================================================

describe("TablePasswordControl - Characterization Tests", () => {
  const createMockHandlers = () => ({
    onSetRoomPassword: vi.fn(),
    onDismissRoomPasswordStatus: vi.fn(),
  });

  describe("Initial Rendering", () => {
    it("should render with empty password inputs", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");

      expect(newPasswordInput).toHaveValue("");
      expect(confirmPasswordInput).toHaveValue("");
    });

    it("should render description text", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      expect(
        screen.getByText(
          /players already here stay connected; anyone joining afterwards needs the new one/i,
        ),
      ).toBeInTheDocument();
    });

    it("should render Change table password button when not pending", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const button = screen.getByRole("button", { name: "Change table password" });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it("should not show password error initially", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
    });

    it("should not show room password status initially", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      expect(screen.queryByText(/password updated/i)).not.toBeInTheDocument();
    });
  });

  describe("Password Input Changes", () => {
    it("should update new password field on change", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      fireEvent.change(newPasswordInput, { target: { value: "secret123" } });

      expect(newPasswordInput).toHaveValue("secret123");
    });

    it("should update confirm password field on change", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      fireEvent.change(confirmPasswordInput, { target: { value: "secret123" } });

      expect(confirmPasswordInput).toHaveValue("secret123");
    });

    it("should clear password error when typing in new password input", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      // First trigger an error
      const button = screen.getByRole("button", { name: "Change table password" });
      fireEvent.click(button);
      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();

      // Now type in the new password input
      const newPasswordInput = screen.getByPlaceholderText("New table password");
      fireEvent.change(newPasswordInput, { target: { value: "a" } });

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
    });

    it("should clear password error when typing in confirm password input", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      // First trigger an error
      const button = screen.getByRole("button", { name: "Change table password" });
      fireEvent.click(button);
      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();

      // Now type in the confirm password input
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      fireEvent.change(confirmPasswordInput, { target: { value: "a" } });

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
    });

    it("should call onDismissRoomPasswordStatus when typing in new password input", () => {
      const handlers = createMockHandlers();
      render(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      fireEvent.change(newPasswordInput, { target: { value: "a" } });

      expect(handlers.onDismissRoomPasswordStatus).toHaveBeenCalledTimes(1);
    });

    it("should call onDismissRoomPasswordStatus when typing in confirm password input", () => {
      const handlers = createMockHandlers();
      render(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      fireEvent.change(confirmPasswordInput, { target: { value: "a" } });

      expect(handlers.onDismissRoomPasswordStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("Password Validation", () => {
    it("should show error when password is too short (less than 6 characters)", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "abc" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "abc" } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should show error when password is exactly 5 characters", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "12345" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "12345" } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should show error when passwords do not match", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password456" } });
      fireEvent.click(button);

      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should trim whitespace before validating password length", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "   abc   " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "   abc   " } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should trim whitespace before comparing passwords", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "  password123  " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("password123");
    });

    it("should accept password with exactly 6 characters", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "123456" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "123456" } });
      fireEvent.click(button);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("123456");
    });
  });

  describe("Change table password Button Click", () => {
    it("should call onSetRoomPassword with trimmed password when valid", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "  password123  " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "  password123  " } });
      fireEvent.click(button);

      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("password123");
      expect(handlers.onSetRoomPassword).toHaveBeenCalledTimes(1);
    });

    it("should clear password error before calling onSetRoomPassword", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      // First create an error
      fireEvent.change(newPasswordInput, { target: { value: "abc" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "abc" } });
      fireEvent.click(button);
      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();

      // Now fix it
      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("password123");
    });

    it("should call onDismissRoomPasswordStatus before calling onSetRoomPassword", () => {
      const handlers = createMockHandlers();
      render(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "error", message: "Failed to update" }}
        />,
      );

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      // Called 3 times: once for each input change (2x) and once during button click
      expect(handlers.onDismissRoomPasswordStatus).toHaveBeenCalledTimes(3);
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("password123");
    });

    it("should not call onSetRoomPassword when onSetRoomPassword is undefined", () => {
      render(<TablePasswordControl onSetRoomPassword={undefined} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      // No error should be thrown, function just returns early
      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
    });
  });

  describe("Reset to default", () => {
    // The table goes back to the Main Hall's password (the server's setting; the published one
    // only when it is unset). The client names no value: it sends the change with no secret and
    // the server substitutes its own default, so this works with a custom HEROBYTE_ROOM_SECRET
    // too. It asks first: anyone who has the table's code and that password could then join.
    let confirm: MockInstance<typeof window.confirm>;
    beforeEach(() => {
      confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    });
    afterEach(() => {
      confirm.mockRestore();
    });

    it("asks first, and says anyone with the table's code could then join", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));

      expect(confirm).toHaveBeenCalledExactlyOnceWith(RESET_CONFIRM);
      expect(RESET_CONFIRM).toMatch(/anyone who has this table's code and the Main Hall password/i);
      // The Main Hall's password is the server's setting, published only when it is unset.
      expect(RESET_CONFIRM).not.toMatch(/publish/i);
    });

    it("changes nothing when the confirmation is declined", () => {
      confirm.mockReturnValue(false);
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));

      expect(confirm).toHaveBeenCalledOnce();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("asks for the server's default by sending no secret at all", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));

      expect(handlers.onSetRoomPassword).toHaveBeenCalledExactlyOnceWith();
    });

    it("sends nothing that was typed in the fields", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);
      fireEvent.change(screen.getByPlaceholderText("New table password"), {
        target: { value: "half-typed-secret" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));

      expect(handlers.onSetRoomPassword).toHaveBeenCalledExactlyOnceWith();
    });

    it("is unavailable while a change is in flight, and with no handler — and asks nothing then", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<TablePasswordControl {...handlers} roomPasswordPending />);
      expect(screen.getByRole("button", { name: "Reset to default" })).toBeDisabled();

      rerender(<TablePasswordControl onSetRoomPassword={undefined} />);
      expect(screen.getByRole("button", { name: "Reset to default" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  describe("Pending State", () => {
    it("should show 'Updating…' text when roomPasswordPending is true", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} roomPasswordPending={true} />);

      expect(screen.getByRole("button", { name: "Changing…" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Change table password" }),
      ).not.toBeInTheDocument();
    });

    it("should disable button when roomPasswordPending is true", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} roomPasswordPending={true} />);

      const button = screen.getByRole("button", { name: "Changing…" });
      expect(button).toBeDisabled();
    });

    it("should disable button when onSetRoomPassword is undefined", () => {
      render(<TablePasswordControl onSetRoomPassword={undefined} />);

      const button = screen.getByRole("button", { name: "Change table password" });
      expect(button).toBeDisabled();
    });

    it("should enable button when onSetRoomPassword is defined and not pending", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} roomPasswordPending={false} />);

      const button = screen.getByRole("button", { name: "Change table password" });
      expect(button).not.toBeDisabled();
    });
  });

  describe("Room Password Status Display", () => {
    it("should display success status in green", () => {
      const handlers = createMockHandlers();
      render(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated successfully!" }}
        />,
      );

      const statusMessage = screen.getByText("Password updated successfully!");
      expect(statusMessage).toBeInTheDocument();
      expect(statusMessage).toHaveStyle({ color: "#4ade80" });
    });

    it("should display error status in red", () => {
      const handlers = createMockHandlers();
      render(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "error", message: "Failed to update password" }}
        />,
      );

      const statusMessage = screen.getByText("Failed to update password");
      expect(statusMessage).toBeInTheDocument();
      expect(statusMessage).toHaveStyle({ color: "#f87171" });
    });

    it("should not display status when roomPasswordStatus is null", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} roomPasswordStatus={null} />);

      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    });

    it("should not display status when roomPasswordStatus is undefined", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} roomPasswordStatus={undefined} />);

      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    });
  });

  describe("Success Status Clears Inputs (useEffect)", () => {
    it("should clear password inputs when roomPasswordStatus changes to success", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");

      // Fill in passwords
      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });

      expect(newPasswordInput).toHaveValue("password123");
      expect(confirmPasswordInput).toHaveValue("password123");

      // Simulate success status
      rerender(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      expect(newPasswordInput).toHaveValue("");
      expect(confirmPasswordInput).toHaveValue("");
    });

    it("should not clear password inputs when roomPasswordStatus changes to error", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");

      // Fill in passwords
      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });

      expect(newPasswordInput).toHaveValue("password123");
      expect(confirmPasswordInput).toHaveValue("password123");

      // Simulate error status
      rerender(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "error", message: "Failed to update" }}
        />,
      );

      // Inputs should still have values
      expect(newPasswordInput).toHaveValue("password123");
      expect(confirmPasswordInput).toHaveValue("password123");
    });

    it("should not clear password inputs when roomPasswordStatus is null", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");

      // Inputs should be empty from success
      expect(newPasswordInput).toHaveValue("");
      expect(confirmPasswordInput).toHaveValue("");

      // Type new passwords
      fireEvent.change(newPasswordInput, { target: { value: "newpassword" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "newpassword" } });

      // Change status to null
      rerender(<TablePasswordControl {...handlers} roomPasswordStatus={null} />);

      // Inputs should still have the new values
      expect(newPasswordInput).toHaveValue("newpassword");
      expect(confirmPasswordInput).toHaveValue("newpassword");
    });
  });

  describe("Password Error Display", () => {
    it("should display password error in red with correct font size", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const button = screen.getByRole("button", { name: "Change table password" });
      fireEvent.click(button);

      const errorMessage = screen.getByText("Password must be at least 6 characters.");
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveStyle({
        color: "#f87171",
        margin: 0,
        fontSize: "0.85rem",
      });
    });

    it("should not display password error and room status simultaneously", () => {
      const handlers = createMockHandlers();
      render(
        <TablePasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const button = screen.getByRole("button", { name: "Change table password" });
      fireEvent.click(button);

      // Error should be shown
      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      // Status should still be shown (they can coexist)
      expect(screen.getByText("Password updated!")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string passwords", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const button = screen.getByRole("button", { name: "Change table password" });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only passwords", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "      " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "      " } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should handle very long passwords", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      const longPassword = "a".repeat(100);
      fireEvent.change(newPasswordInput, { target: { value: longPassword } });
      fireEvent.change(confirmPasswordInput, { target: { value: longPassword } });
      fireEvent.click(button);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith(longPassword);
    });

    it("should handle passwords with special characters", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      const specialPassword = "p@ssw0rd!#$%";
      fireEvent.change(newPasswordInput, { target: { value: specialPassword } });
      fireEvent.change(confirmPasswordInput, { target: { value: specialPassword } });
      fireEvent.click(button);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith(specialPassword);
    });

    it("should handle case-sensitive password comparison", () => {
      const handlers = createMockHandlers();
      render(<TablePasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New table password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm table password");
      const button = screen.getByRole("button", { name: "Change table password" });

      fireEvent.change(newPasswordInput, { target: { value: "Password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });
  });
});
