/**
 * Characterization tests for the table backup control.
 *
 * Written as SessionPersistenceControl's ("Session Save/Load": Save Game State /
 * Load Game State) and moved with it into Table → Backups (U9), where its buttons
 * name their scope before a file is chosen — Download table backup, Restore table
 * backup… Behaviour is unchanged; only the words and the place moved.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableBackupControl } from "../TableBackupControl";

describe("TableBackupControl - Characterization Tests", () => {
  const createMockHandlers = () => ({
    setSessionName: vi.fn(),
    onRequestSaveSession: vi.fn(),
    onRequestLoadSession: vi.fn(),
  });

  describe("Initial Rendering", () => {
    it("should render with default session name", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Backup file name")).toHaveValue("session");
    });

    it("should render session name input with custom name", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="my-adventure"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Backup file name")).toHaveValue("my-adventure");
    });

    it("should render both Save and Load buttons", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByRole("button", { name: /download table backup/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /restore table backup/i })).toBeInTheDocument();
    });

    it("should render file input with JSON accept attribute", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
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
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const input = screen.getByLabelText("Backup file name");
      fireEvent.change(input, { target: { value: "new-session" } });

      expect(handlers.setSessionName).toHaveBeenCalledWith("new-session");
    });

    it("should call setSessionName with empty string", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const input = screen.getByLabelText("Backup file name");
      fireEvent.change(input, { target: { value: "" } });

      expect(handlers.setSessionName).toHaveBeenCalledWith("");
    });

    it("should update session name with special characters", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const input = screen.getByLabelText("Backup file name");
      fireEvent.change(input, { target: { value: "session_2024-01-15" } });

      expect(handlers.setSessionName).toHaveBeenCalledWith("session_2024-01-15");
    });
  });

  describe("Save Button", () => {
    it("should call onRequestSaveSession with session name when clicked", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="my-session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("my-session");
      expect(handlers.onRequestSaveSession).toHaveBeenCalledTimes(1);
    });

    it("should trim whitespace from session name before saving", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="  my-session  "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("my-session");
    });

    it("should use the default 'table-backup' name when the file name is empty", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName=""
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("table-backup");
    });

    it("should use the default 'table-backup' name when the file name is only whitespace", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="   "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("table-backup");
    });

    it("should be disabled when saveDisabled prop is true", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      expect(saveButton).toBeDisabled();
    });

    it("should show tooltip when saveDisabled is true", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      expect(saveButton).toHaveAttribute(
        "title",
        "Downloading is unavailable until the table state is ready.",
      );
    });

    it("should not call onRequestSaveSession when callback is undefined", () => {
      const handlers = {
        setSessionName: vi.fn(),
        onRequestSaveSession: undefined,
        onRequestLoadSession: vi.fn(),
      };
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      // No error should occur
      expect(handlers.setSessionName).not.toHaveBeenCalled();
    });

    it("should not call onRequestSaveSession when button is disabled", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).not.toHaveBeenCalled();
    });
  });

  describe("Load Button", () => {
    it("should trigger file input click when load button is clicked", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      const loadButton = screen.getByRole("button", { name: /restore table backup/i });
      fireEvent.click(loadButton);

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when loadDisabled prop is true", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={true}
          {...handlers}
        />,
      );

      const loadButton = screen.getByRole("button", { name: /restore table backup/i });
      expect(loadButton).toBeDisabled();
    });

    it("should show tooltip when loadDisabled is true", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={true}
          {...handlers}
        />,
      );

      const loadButton = screen.getByRole("button", { name: /restore table backup/i });
      expect(loadButton).toHaveAttribute("title", "Restoring is unavailable at the moment.");
    });
  });

  describe("File Selection", () => {
    it("should call onRequestLoadSession with selected file", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
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

    it("should not call onRequestLoadSession when no file is selected", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
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
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const file = new File(['{"test": "data"}'], "session.json", { type: "application/json" });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      expect(() => fireEvent.change(fileInput, { target: { files: [file] } })).not.toThrow();
    });

    it("resets the chooser after EVERY choice, so the same file can be picked twice", () => {
      // jsdom's file input reports "" whatever was done to it, so the chooser's value is replaced
      // and the assignment the component makes is what is observed.
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const file = new File(['{"test": "data"}'], "session.json", { type: "application/json" });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const assigned: string[] = [];
      Object.defineProperty(fileInput, "value", {
        configurable: true,
        get: () => "C:\\fakepath\\session.json",
        set: (next: string) => {
          assigned.push(next);
        },
      });

      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(handlers.onRequestLoadSession).toHaveBeenCalledTimes(2);
      expect(assigned).toEqual(["", ""]);
    });
  });

  describe("File Input Attributes", () => {
    it("should only accept JSON files", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
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
        <TableBackupControl
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
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Backup file name")).toHaveValue("session");

      rerender(
        <TableBackupControl
          sessionName="new-session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Backup file name")).toHaveValue("new-session");
    });

    it("should update save button disabled state when saveDisabled prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      expect(saveButton).not.toBeDisabled();

      rerender(
        <TableBackupControl
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
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const loadButton = screen.getByRole("button", { name: /restore table backup/i });
      expect(loadButton).not.toBeDisabled();

      rerender(
        <TableBackupControl
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
        <TableBackupControl
          sessionName="session"
          saveDisabled={true}
          loadDisabled={true}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      const loadButton = screen.getByRole("button", { name: /restore table backup/i });

      expect(saveButton).toBeDisabled();
      expect(loadButton).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long session names", () => {
      const handlers = createMockHandlers();
      const longName = "a".repeat(200);
      render(
        <TableBackupControl
          sessionName={longName}
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith(longName);
    });

    it("should handle session name with only spaces", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="     "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("table-backup");
    });

    it("should handle session name with leading and trailing spaces", () => {
      const handlers = createMockHandlers();
      render(
        <TableBackupControl
          sessionName="  test-session  "
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );

      const saveButton = screen.getByRole("button", { name: /download table backup/i });
      fireEvent.click(saveButton);

      expect(handlers.onRequestSaveSession).toHaveBeenCalledWith("test-session");
    });

    it("should handle file selection with multiple files (only first file used)", () => {
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
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

    it("resets the chooser after each choice, so the same backup can be picked again", () => {
      // Declined, or refused by name, a file left in the chooser would make choosing it
      // a second time a change event the browser never fires. The chooser's own value
      // is replaced here so the assignment the component makes is what is observed.
      const handlers = createMockHandlers();
      const { container } = render(
        <TableBackupControl
          sessionName="session"
          saveDisabled={false}
          loadDisabled={false}
          {...handlers}
        />,
      );
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const assigned: string[] = [];
      Object.defineProperty(fileInput, "value", {
        configurable: true,
        get: () => "C:\\fakepath\\table.json",
        set: (next: string) => {
          assigned.push(next);
        },
      });

      fireEvent.change(fileInput, {
        target: { files: [new File(["{}"], "table.json", { type: "application/json" })] },
      });

      expect(handlers.onRequestLoadSession).toHaveBeenCalledTimes(1);
      expect(assigned).toEqual([""]);
    });
  });
});
