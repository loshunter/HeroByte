/**
 * Characterization tests for SessionPersistenceControl component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:417-462
 * Target: apps/client/src/features/dm/components/SessionPersistenceControl.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionPersistenceControl } from "../../session-controls/SessionPersistenceControl";

describe("SessionPersistenceControl - Characterization Tests", () => {
  const createMockHandlers = () => ({
    setSessionName: vi.fn(),
    onRequestSaveSession: vi.fn(),
    onRequestLoadSession: vi.fn(),
  });

  describe("Initial Rendering", () => {
    it("should render with default session name", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Session Name")).toHaveValue("session");
    });

    it("should render session name input with custom name", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="my-adventure"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Session Name")).toHaveValue("my-adventure");
    });

    it("should render both Save and Load buttons", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByRole("button", { name: /save game state/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /load game state/i })).toBeInTheDocument();
    });

    it("should render file input with JSON accept attribute", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute("accept", "application/json");
      expect(fileInput).toHaveStyle({ display: "none" });
    });
  });

  describe("Session Name Input", () => {
    it("should call setSessionName when input value changes", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const input = screen.getByLabelText("Session Name");
      fireEvent.change(input, { target: { value: "new-session" } });

      expect(handlers.setSessionName).toHaveBeenCalledWith("new-session");
    });

    it("should call setSessionName with empty string", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const input = screen.getByLabelText("Session Name");
      fireEvent.change(input, { target: { value: "" } });

      expect(handlers.setSessionName).toHaveBeenCalledWith("");
    });

    it("should update session name with special characters", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const input = screen.getByLabelText("Session Name");
      fireEvent.change(input, { target: { value: "session_2024-01-15" } });

      expect(handlers.setSessionName).toHaveBeenCalledWith("session_2024-01-15");
    });
  });

  describe("Save Button", () => {
    it("should call onRequestSaveSession with session name when clicked", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="my-session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("my-session");
      expect(handlers.onRequestSaveSession).toHaveBeenCalledTimes(1);
    });

    it("should trim whitespace from session name before saving", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="  my-session  "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("my-session");
    });

    it("should use default 'session' name when session name is empty", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName=""
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("session");
    });

    it("should use default 'session' name when session name is only whitespace", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="   "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("session");
    });

    it("should be disabled when saveDisabled prop is true", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      expect(saveButton).toBeDisabled();
    });

    it("should show tooltip when saveDisabled is true", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      expect(saveButton).toHaveAttribute(
        "title",
        "Save is unavailable until the room state is ready.",
      );
    });

    it("should not call onRequestSaveSession when callback is undefined", () => {
      const handlers = {
        setSessionName: vi.fn(),
        onRequestSaveSession: undefined,
        onRequestLoadSession: vi.fn(),
      };
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      // No error should occur
      expect(handlers.setSessionName).not.toHaveBeenCalled();
    });

    it("should not call onRequestSaveSession when button is disabled", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).not.toHaveBeenCalled();
    });
  });

  describe("Load Button", () => {
    it("should trigger file input click when load button is clicked", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      const loadButton = screen.getByRole("button", { name: /load game state/i });
      fireEvent.click(loadButton);

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when loadDisabled prop is true", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={true}
          {...handlers}
        />,
      );

      const loadButton = screen.getByRole("button", { name: /load game state/i });
      expect(loadButton).toBeDisabled();
    });

    it("should show tooltip when loadDisabled is true", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={true}
          {...handlers}
        />,
      );

      const loadButton = screen.getByRole("button", { name: /load game state/i });
      expect(loadButton).toHaveAttribute("title", "Loading is unavailable at the moment.");
    });
  });

  describe("File Selection", () => {
    it("should call onRequestLoadSession with selected file", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const file = new File(['{"test": "data"}'], "session.json", { type: "application/json" });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(handlers.onRequestLoadSession).toHaveBeenCalledWith(file);
      expect(handlers.onRequestLoadSession).toHaveBeenCalledTimes(1);
    });

    it("should reset file input value after file selection", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const file = new File(['{"test": "data"}'], "session.json", { type: "application/json" });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(fileInput.value).toBe("");
    });

    it("should not call onRequestLoadSession when no file is selected", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [] } });

      expect(handlers.onRequestLoadSession).not.toHaveBeenCalled();
    });

    it("should not call onRequestLoadSession when callback is undefined", () => {
      const handlers = {
        setSessionName: vi.fn(),
        onRequestSaveSession: vi.fn(),
        onRequestLoadSession: undefined,
      };
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const file = new File(['{"test": "data"}'], "session.json", { type: "application/json" });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });

      // No error should occur
      expect(fileInput.value).toBe("");
    });

    it("should allow selecting the same file again after reset", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const file = new File(['{"test": "data"}'], "session.json", { type: "application/json" });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // First selection
      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(handlers.onRequestLoadSession).toHaveBeenCalledTimes(1);
      expect(fileInput.value).toBe("");

      // Second selection of same file
      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(handlers.onRequestLoadSession).toHaveBeenCalledTimes(2);
      expect(fileInput.value).toBe("");
    });
  });

  describe("File Input Attributes", () => {
    it("should only accept JSON files", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute("accept", "application/json");
    });

    it("should hide file input from view", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveStyle({ display: "none" });
    });
  });

  describe("Props Updates", () => {
    it("should update session name input when sessionName prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Session Name")).toHaveValue("session");

      rerender(
        <SessionPersistenceControl
          sessionName="new-session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Session Name")).toHaveValue("new-session");
    });

    it("should update save button disabled state when saveDisabled prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      expect(saveButton).not.toBeDisabled();

      rerender(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(saveButton).toBeDisabled();
    });

    it("should update load button disabled state when loadDisabled prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const loadButton = screen.getByRole("button", { name: /load game state/i });
      expect(loadButton).not.toBeDisabled();

      rerender(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={true}
          {...handlers}
        />,
      );

      expect(loadButton).toBeDisabled();
    });

    it("should handle both buttons disabled simultaneously", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={true}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      const loadButton = screen.getByRole("button", { name: /load game state/i });

      expect(saveButton).toBeDisabled();
      expect(loadButton).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long session names", () => {
      const handlers = createMockHandlers();
      const longName = "a".repeat(200);
      render(
        <SessionPersistenceControl
          sessionName={longName}
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith(longName);
    });

    it("should handle session name with only spaces", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="     "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("session");
    });

    it("should handle session name with leading and trailing spaces", () => {
      const handlers = createMockHandlers();
      render(
        <SessionPersistenceControl
          sessionName="  test-session  "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /save game state/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("test-session");
    });

    it("should handle file selection with multiple files (only first file used)", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <SessionPersistenceControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const file1 = new File(['{"test": "data1"}'], "session1.json", { type: "application/json" });
      const file2 = new File(['{"test": "data2"}'], "session2.json", { type: "application/json" });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file1, file2] } });

      expect(handlers.onRequestLoadSession).toHaveBeenCalledWith(file1);
      expect(handlers.onRequestLoadSession).toHaveBeenCalledTimes(1);
    });
  });
});
