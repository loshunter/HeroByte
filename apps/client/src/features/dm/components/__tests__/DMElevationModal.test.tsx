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
    roleKnown: true,
    onElevate: vi.fn(),
    onBootstrap: vi.fn(),
    onRevoke: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const result = render(<DMElevationModal {...props} />);
  return { ...result, props };
}

describe("DMElevationModal — Enter DM mode", () => {
  it("renders the password gate and submits the entered password", () => {
    const { props } = renderModal();
    fireEvent.change(screen.getByLabelText("DM password"), {
      target: { value: "hunter-two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter DM mode" }));
    expect(props.onElevate).toHaveBeenCalledWith("hunter-two");
  });

  it("is a labelled, modal dialog named for what it does", () => {
    renderModal();
    const dialog = screen.getByRole("dialog", { name: "Enter DM mode" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("keeps the server's error visible, and the viewer a player", () => {
    // Failed elevation retains the player surface and announces the error: the
    // dialog stays open (nothing closes it but success or Cancel) and the password
    // gate is still there to try again.
    const { props } = renderModal({ error: "Invalid DM password" });
    expect(screen.getByText("Invalid DM password")).toBeTruthy();
    expect(screen.getByLabelText("DM password")).toBeEnabled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("will not submit an empty password", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Enter DM mode" })).toBeDisabled();
  });

  it("says it is working, and locks the field and Cancel, while the server answers", () => {
    renderModal({ isLoading: true });
    expect(screen.getByRole("button", { name: "Entering…" })).toBeDisabled();
    expect(screen.getByLabelText("DM password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("closes automatically once the viewer becomes DM", () => {
    const { rerender, props } = renderModal();
    rerender(<DMElevationModal {...props} currentIsDM={true} />);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("closes once the viewer becomes DM, even with an earlier timeout still on screen", () => {
    // A frame the client flushed after an outage can land after the five seconds are up: the
    // dialog's job is done, and a stale "timed out" must not keep it open.
    const { rerender, props } = renderModal({
      error: "Elevation request timed out. Please try again.",
    });
    expect(props.onClose).not.toHaveBeenCalled();

    rerender(<DMElevationModal {...props} currentIsDM={true} />);

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("cannot be submitted while the roster is not known, even with a password typed", () => {
    renderModal({ roleKnown: false });
    fireEvent.change(screen.getByLabelText("DM password"), { target: { value: "hunter-two" } });
    expect(screen.getByRole("button", { name: "Enter DM mode" })).toBeDisabled();
  });

  it("Cancel closes it without sending anything", () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onElevate).not.toHaveBeenCalled();
  });
});

describe("DMElevationModal — bootstrap mode (table has no DM password yet)", () => {
  it("explains the situation and offers password + confirm fields", () => {
    renderModal({ mode: "bootstrap" });
    expect(screen.getByRole("dialog", { name: "Set the DM password" })).toBeTruthy();
    expect(screen.getByText(/doesn't have a DM password yet/)).toBeTruthy();
    expect(screen.getByLabelText("New DM password (8+ characters)")).toBeTruthy();
    expect(screen.getByLabelText("Confirm DM password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Set password & enter DM mode" })).toBeTruthy();
  });

  it("rejects passwords under 8 characters without calling onBootstrap", () => {
    const { props } = renderModal({ mode: "bootstrap" });
    fireEvent.change(screen.getByLabelText("New DM password (8+ characters)"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm DM password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password & enter DM mode" }));
    expect(screen.getByText("DM password needs at least 8 characters.")).toBeTruthy();
    expect(props.onBootstrap).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation without calling onBootstrap", () => {
    const { props } = renderModal({ mode: "bootstrap" });
    fireEvent.change(screen.getByLabelText("New DM password (8+ characters)"), {
      target: { value: "long-enough-pw" },
    });
    fireEvent.change(screen.getByLabelText("Confirm DM password"), {
      target: { value: "different-pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password & enter DM mode" }));
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(props.onBootstrap).not.toHaveBeenCalled();
  });

  it("submits a valid, confirmed password", () => {
    const { props } = renderModal({ mode: "bootstrap" });
    fireEvent.change(screen.getByLabelText("New DM password (8+ characters)"), {
      target: { value: "my-table-dm-pw" },
    });
    fireEvent.change(screen.getByLabelText("Confirm DM password"), {
      target: { value: "my-table-dm-pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password & enter DM mode" }));
    expect(props.onBootstrap).toHaveBeenCalledWith("my-table-dm-pw");
  });

  it("closes automatically once the user becomes DM", () => {
    const { rerender, props } = renderModal({ mode: "bootstrap" });
    rerender(<DMElevationModal {...props} currentIsDM={true} />);
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("DMElevationModal — Leave DM mode", () => {
  it("puts focus back on Cancel when the attempt fails (both buttons were disabled while it ran, so focus fell to the page)", () => {
    // While the request runs both buttons are disabled and a disabled button cannot hold focus, so
    // a dialog mounted in that state has focus on the page, as a browser leaves it.
    const { rerender, props } = renderModal({ mode: "revoke", currentIsDM: true, isLoading: true });
    expect(document.activeElement).toBe(document.body);
    rerender(
      <DMElevationModal {...props} isLoading={false} error="Revocation request timed out" />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("takes focus when it opens, on Cancel (the safe choice), so a keyboard user is not left behind it", () => {
    // The Table menu closes when Leave DM mode is chosen and passes focus to THIS dialog
    // (U10b, owner's rule 3). The password fields autofocus themselves; this one has none.
    renderModal({ mode: "revoke", currentIsDM: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("is a plain confirm: it says what is kept and how to come back", () => {
    renderModal({ mode: "revoke", currentIsDM: true });
    expect(screen.getByRole("dialog", { name: "Leave DM mode" })).toBeTruthy();
    expect(screen.getByText(/keep your character and your seat/i)).toBeTruthy();
    expect(screen.getByText(/DM password brings them back/i)).toBeTruthy();
  });

  it("leaves DM mode on the one button, which is not styled as a deletion", () => {
    const { props } = renderModal({ mode: "revoke", currentIsDM: true });
    const leave = screen.getByRole("button", { name: "Leave DM mode" });
    expect(leave.className).not.toMatch(/danger/);
    fireEvent.click(leave);
    expect(props.onRevoke).toHaveBeenCalledTimes(1);
  });

  it("asks for no password, and offers none", () => {
    renderModal({ mode: "revoke", currentIsDM: true });
    expect(screen.queryByLabelText("DM password")).toBeNull();
    expect(screen.getByRole("button", { name: "Leave DM mode" })).toBeEnabled();
  });

  it("says it is working while the server answers", () => {
    renderModal({ mode: "revoke", currentIsDM: true, isLoading: true });
    expect(screen.getByRole("button", { name: "Leaving…" })).toBeDisabled();
  });

  it("closes once the roster says the viewer is no longer DM", () => {
    const { rerender, props } = renderModal({ mode: "revoke", currentIsDM: true });
    expect(props.onClose).not.toHaveBeenCalled();
    rerender(<DMElevationModal {...props} currentIsDM={false} />);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("closes on the outcome even with an error on screen: a late answer leaves nothing stale", () => {
    // The leave was confirmed in an outage, timed out, and was then heard after all.
    const { rerender, props } = renderModal({
      mode: "revoke",
      currentIsDM: true,
      error: "Revocation request timed out. Please try again.",
    });
    expect(props.onClose).not.toHaveBeenCalled();

    rerender(<DMElevationModal {...props} currentIsDM={false} />);

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("cannot be confirmed while the roster is not known, and says why", () => {
    // With the socket away a confirm would be QUEUED and sent after re-authentication, long
    // after the dialog had said it timed out.
    const { rerender, props } = renderModal({
      mode: "revoke",
      currentIsDM: true,
      roleKnown: false,
    });
    expect(screen.getByRole("button", { name: "Leave DM mode" })).toBeDisabled();
    expect(screen.getByText(/Reconnecting…/)).toBeInTheDocument();

    rerender(<DMElevationModal {...props} roleKnown />);

    expect(screen.getByRole("button", { name: "Leave DM mode" })).toBeEnabled();
    expect(screen.queryByText(/Reconnecting…/)).toBeNull();
  });

  it("stays open through a reconnect blip: no roster is not 'no longer the DM'", () => {
    // Every socket close nulls the snapshot and the flag reads false with it. An unanswered
    // Leave dialog that closed for that would make the person start again — or think they left.
    const { rerender, props } = renderModal({ mode: "revoke", currentIsDM: true });
    rerender(<DMElevationModal {...props} currentIsDM={false} roleKnown={false} />);
    expect(props.onClose).not.toHaveBeenCalled();
    // ...and still closes when the roster comes back and says so.
    rerender(<DMElevationModal {...props} currentIsDM={false} roleKnown />);
    expect(props.onClose).toHaveBeenCalledTimes(1);
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
    const field = screen.getByLabelText("DM password") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "wrong-one" } });
    dropFocusWhileLoading(rerender, props, field);

    rerender(<DMElevationModal {...props} isLoading={false} error="Invalid DM password" />);

    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe("wrong-one".length);
  });

  it("returns to the new-password field when setting the password is refused", () => {
    const { rerender, props } = renderModal({ mode: "bootstrap" });
    const field = screen.getByLabelText("New DM password (8+ characters)") as HTMLInputElement;
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
