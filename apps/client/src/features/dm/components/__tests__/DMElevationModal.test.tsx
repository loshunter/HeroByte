import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DMElevationModal } from "../DMElevationModal";

function renderModal(overrides: Partial<Parameters<typeof DMElevationModal>[0]> = {}) {
  const props = {
    isOpen: true,
    mode: "elevate" as const,
    isLoading: false,
    error: null,
    currentIsDM: false,
    onElevate: vi.fn(),
    onBootstrap: vi.fn(),
    onRevoke: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const result = render(<DMElevationModal {...props} />);
  return { ...result, props };
}

describe("DMElevationModal", () => {
  it("renders the elevate form and submits the entered password", () => {
    const { props } = renderModal();
    fireEvent.change(screen.getByLabelText("Enter DM Password:"), {
      target: { value: "hunter-two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Elevate to DM" }));
    expect(props.onElevate).toHaveBeenCalledWith("hunter-two");
  });

  it("shows the server error inline in elevate mode", () => {
    renderModal({ error: "Invalid DM password" });
    expect(screen.getByText("Invalid DM password")).toBeTruthy();
  });

  describe("bootstrap mode (table has no DM password yet)", () => {
    it("explains the situation and offers password + confirm fields", () => {
      renderModal({ mode: "bootstrap" });
      expect(screen.getByText(/doesn't have a DM password yet/)).toBeTruthy();
      expect(screen.getByLabelText("New DM Password (8+ characters):")).toBeTruthy();
      expect(screen.getByLabelText("Confirm DM Password:")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Set Password & Become DM" })).toBeTruthy();
    });

    it("rejects passwords under 8 characters without calling onBootstrap", () => {
      const { props } = renderModal({ mode: "bootstrap" });
      fireEvent.change(screen.getByLabelText("New DM Password (8+ characters):"), {
        target: { value: "short" },
      });
      fireEvent.change(screen.getByLabelText("Confirm DM Password:"), {
        target: { value: "short" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Set Password & Become DM" }));
      expect(screen.getByText("DM password needs at least 8 characters.")).toBeTruthy();
      expect(props.onBootstrap).not.toHaveBeenCalled();
    });

    it("rejects mismatched confirmation without calling onBootstrap", () => {
      const { props } = renderModal({ mode: "bootstrap" });
      fireEvent.change(screen.getByLabelText("New DM Password (8+ characters):"), {
        target: { value: "long-enough-pw" },
      });
      fireEvent.change(screen.getByLabelText("Confirm DM Password:"), {
        target: { value: "different-pw" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Set Password & Become DM" }));
      expect(screen.getByText("Passwords do not match.")).toBeTruthy();
      expect(props.onBootstrap).not.toHaveBeenCalled();
    });

    it("submits a valid, confirmed password", () => {
      const { props } = renderModal({ mode: "bootstrap" });
      fireEvent.change(screen.getByLabelText("New DM Password (8+ characters):"), {
        target: { value: "my-table-dm-pw" },
      });
      fireEvent.change(screen.getByLabelText("Confirm DM Password:"), {
        target: { value: "my-table-dm-pw" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Set Password & Become DM" }));
      expect(props.onBootstrap).toHaveBeenCalledWith("my-table-dm-pw");
    });

    it("closes automatically once the user becomes DM", () => {
      const { rerender, props } = renderModal({ mode: "bootstrap" });
      rerender(<DMElevationModal {...props} currentIsDM={true} />);
      expect(props.onClose).toHaveBeenCalled();
    });
  });
});

describe("DMElevationModal — after a failed attempt", () => {
  // A request in flight disables the field, and a disabled field drops the cursor.
  // jsdom does not do that on its own, so the tests do it as the browser does.
  const dropFocusWhileLoading = (
    rerender: (ui: ReactElement) => void,
    props: Parameters<typeof DMElevationModal>[0],
    field: HTMLElement,
  ) => {
    field.focus();
    field.blur();
    rerender(<DMElevationModal {...props} isLoading />);
    expect(document.activeElement).toBe(document.body);
  };

  it("puts the cursor back in the password field, text selected, so the next try replaces it", () => {
    const { rerender, props } = renderModal();
    const field = screen.getByLabelText("Enter DM Password:") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "wrong-one" } });
    dropFocusWhileLoading(rerender, props, field);

    rerender(<DMElevationModal {...props} isLoading={false} error="Invalid DM password" />);

    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe("wrong-one".length);
  });

  it("returns to the new-password field when setting the password is refused", () => {
    const { rerender, props } = renderModal({ mode: "bootstrap" });
    const field = screen.getByLabelText("New DM Password (8+ characters):") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "a-long-enough-pw" } });
    dropFocusWhileLoading(rerender, props, field);

    rerender(
      <DMElevationModal {...props} isLoading={false} error="Could not set the DM password" />,
    );

    expect(document.activeElement).toBe(field);
  });

  it("leaves the cursor alone while nothing has failed", () => {
    const { rerender, props } = renderModal();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    rerender(<DMElevationModal {...props} isLoading />);
    rerender(<DMElevationModal {...props} isLoading={false} />);
    expect(document.activeElement).toBe(cancel);
  });
});
