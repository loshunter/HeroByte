/**
 * Characterization tests for RoomPasswordControl component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:466-532, 177-196, 143-148
 * Target: apps/client/src/features/dm/components/RoomPasswordControl.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoomPasswordControl } from "../../session-controls/RoomPasswordControl";

// ============================================================================
// TESTS
// ============================================================================

describe("RoomPasswordControl - Characterization Tests", () => {
  const createMockHandlers = () => ({
    onSetRoomPassword: vi.fn(),
    onDismissRoomPasswordStatus: vi.fn(),
  });

  describe("Initial Rendering", () => {
    it("should render with empty password inputs", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");

      expect(newPasswordInput).toHaveValue("");
      expect(confirmPasswordInput).toHaveValue("");
    });

    it("should render description text", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      expect(
        screen.getByText(/Update the shared room password\. Current players remain connected/i),
      ).toBeInTheDocument();
    });

    it("should render Update Password button when not pending", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const button = screen.getByRole("button", { name: "Update Password" });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it("should not show password error initially", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
    });

    it("should not show room password status initially", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      expect(screen.queryByText(/password updated/i)).not.toBeInTheDocument();
    });
  });

  describe("Password Input Changes", () => {
    it("should update new password field on change", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      fireEvent.change(newPasswordInput, { target: { value: "secret123" } });

      expect(newPasswordInput).toHaveValue("secret123");
    });

    it("should update confirm password field on change", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      fireEvent.change(confirmPasswordInput, { target: { value: "secret123" } });

      expect(confirmPasswordInput).toHaveValue("secret123");
    });

    it("should clear password error when typing in new password input", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      // First trigger an error
      const button = screen.getByRole("button", { name: "Update Password" });
      fireEvent.click(button);
      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();

      // Now type in the new password input
      const newPasswordInput = screen.getByPlaceholderText("New password");
      fireEvent.change(newPasswordInput, { target: { value: "a" } });

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
    });

    it("should clear password error when typing in confirm password input", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      // First trigger an error
      const button = screen.getByRole("button", { name: "Update Password" });
      fireEvent.click(button);
      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();

      // Now type in the confirm password input
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      fireEvent.change(confirmPasswordInput, { target: { value: "a" } });

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
    });

    it("should call onDismissRoomPasswordStatus when typing in new password input", () => {
      const handlers = createMockHandlers();
      render(
        <RoomPasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const newPasswordInput = screen.getByPlaceholderText("New password");
      fireEvent.change(newPasswordInput, { target: { value: "a" } });

      expect(handlers.onDismissRoomPasswordStatus).toHaveBeenCalledTimes(1);
    });

    it("should call onDismissRoomPasswordStatus when typing in confirm password input", () => {
      const handlers = createMockHandlers();
      render(
        <RoomPasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      fireEvent.change(confirmPasswordInput, { target: { value: "a" } });

      expect(handlers.onDismissRoomPasswordStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("Password Validation", () => {
    it("should show error when password is too short (less than 6 characters)", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "abc" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "abc" } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should show error when password is exactly 5 characters", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "12345" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "12345" } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should show error when passwords do not match", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password456" } });
      fireEvent.click(button);

      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should trim whitespace before validating password length", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "   abc   " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "   abc   " } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should trim whitespace before comparing passwords", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "  password123  " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("password123");
    });

    it("should accept password with exactly 6 characters", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "123456" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "123456" } });
      fireEvent.click(button);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("123456");
    });
  });

  describe("Update Password Button Click", () => {
    it("should call onSetRoomPassword with trimmed password when valid", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "  password123  " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "  password123  " } });
      fireEvent.click(button);

      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("password123");
      expect(handlers.onSetRoomPassword).toHaveBeenCalledTimes(1);
    });

    it("should clear password error before calling onSetRoomPassword", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

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
        <RoomPasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "error", message: "Failed to update" }}
        />,
      );

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      // Called 3 times: once for each input change (2x) and once during button click
      expect(handlers.onDismissRoomPasswordStatus).toHaveBeenCalledTimes(3);
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith("password123");
    });

    it("should not call onSetRoomPassword when onSetRoomPassword is undefined", () => {
      render(<RoomPasswordControl onSetRoomPassword={undefined} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      // No error should be thrown, function just returns early
      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
    });
  });

  describe("Pending State", () => {
    it("should show 'Updating…' text when roomPasswordPending is true", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} roomPasswordPending={true} />);

      expect(screen.getByRole("button", { name: "Updating…" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Update Password" })).not.toBeInTheDocument();
    });

    it("should disable button when roomPasswordPending is true", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} roomPasswordPending={true} />);

      const button = screen.getByRole("button", { name: "Updating…" });
      expect(button).toBeDisabled();
    });

    it("should disable button when onSetRoomPassword is undefined", () => {
      render(<RoomPasswordControl onSetRoomPassword={undefined} />);

      const button = screen.getByRole("button", { name: "Update Password" });
      expect(button).toBeDisabled();
    });

    it("should enable button when onSetRoomPassword is defined and not pending", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} roomPasswordPending={false} />);

      const button = screen.getByRole("button", { name: "Update Password" });
      expect(button).not.toBeDisabled();
    });
  });

  describe("Room Password Status Display", () => {
    it("should display success status in green", () => {
      const handlers = createMockHandlers();
      render(
        <RoomPasswordControl
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
        <RoomPasswordControl
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
      render(<RoomPasswordControl {...handlers} roomPasswordStatus={null} />);

      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    });

    it("should not display status when roomPasswordStatus is undefined", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} roomPasswordStatus={undefined} />);

      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    });
  });

  describe("Success Status Clears Inputs (useEffect)", () => {
    it("should clear password inputs when roomPasswordStatus changes to success", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");

      // Fill in passwords
      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });

      expect(newPasswordInput).toHaveValue("password123");
      expect(confirmPasswordInput).toHaveValue("password123");

      // Simulate success status
      rerender(
        <RoomPasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      expect(newPasswordInput).toHaveValue("");
      expect(confirmPasswordInput).toHaveValue("");
    });

    it("should not clear password inputs when roomPasswordStatus changes to error", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");

      // Fill in passwords
      fireEvent.change(newPasswordInput, { target: { value: "password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });

      expect(newPasswordInput).toHaveValue("password123");
      expect(confirmPasswordInput).toHaveValue("password123");

      // Simulate error status
      rerender(
        <RoomPasswordControl
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
        <RoomPasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");

      // Inputs should be empty from success
      expect(newPasswordInput).toHaveValue("");
      expect(confirmPasswordInput).toHaveValue("");

      // Type new passwords
      fireEvent.change(newPasswordInput, { target: { value: "newpassword" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "newpassword" } });

      // Change status to null
      rerender(<RoomPasswordControl {...handlers} roomPasswordStatus={null} />);

      // Inputs should still have the new values
      expect(newPasswordInput).toHaveValue("newpassword");
      expect(confirmPasswordInput).toHaveValue("newpassword");
    });
  });

  describe("Password Error Display", () => {
    it("should display password error in red with correct font size", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const button = screen.getByRole("button", { name: "Update Password" });
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
        <RoomPasswordControl
          {...handlers}
          roomPasswordStatus={{ type: "success", message: "Password updated!" }}
        />,
      );

      const button = screen.getByRole("button", { name: "Update Password" });
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
      render(<RoomPasswordControl {...handlers} />);

      const button = screen.getByRole("button", { name: "Update Password" });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only passwords", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "      " } });
      fireEvent.change(confirmPasswordInput, { target: { value: "      " } });
      fireEvent.click(button);

      expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });

    it("should handle very long passwords", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      const longPassword = "a".repeat(100);
      fireEvent.change(newPasswordInput, { target: { value: longPassword } });
      fireEvent.change(confirmPasswordInput, { target: { value: longPassword } });
      fireEvent.click(button);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith(longPassword);
    });

    it("should handle passwords with special characters", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      const specialPassword = "p@ssw0rd!#$%";
      fireEvent.change(newPasswordInput, { target: { value: specialPassword } });
      fireEvent.change(confirmPasswordInput, { target: { value: specialPassword } });
      fireEvent.click(button);

      expect(screen.queryByText("Password must be at least 6 characters.")).not.toBeInTheDocument();
      expect(handlers.onSetRoomPassword).toHaveBeenCalledWith(specialPassword);
    });

    it("should handle case-sensitive password comparison", () => {
      const handlers = createMockHandlers();
      render(<RoomPasswordControl {...handlers} />);

      const newPasswordInput = screen.getByPlaceholderText("New password");
      const confirmPasswordInput = screen.getByPlaceholderText("Confirm password");
      const button = screen.getByRole("button", { name: "Update Password" });

      fireEvent.change(newPasswordInput, { target: { value: "Password123" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
      fireEvent.click(button);

      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
      expect(handlers.onSetRoomPassword).not.toHaveBeenCalled();
    });
  });
});
