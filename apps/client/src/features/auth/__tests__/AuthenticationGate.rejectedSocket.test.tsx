import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationGate, type AuthenticationGateProps } from "../AuthenticationGate";
import { AuthState, ConnectionState } from "../../../services/websocket";

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

function setup() {
  const onAuthenticate = vi.fn();
  const props: AuthenticationGateProps = {
    url: "ws://localhost",
    uid: "password-recovery",
    onAuthenticate,
    onConnect: vi.fn(),
    isConnected: true,
    connectionState: ConnectionState.CONNECTED,
    authState: AuthState.FAILED,
    authError: "Invalid table password",
    children: <div>Table</div>,
  };
  const view = render(<AuthenticationGate {...props} />);
  const input = screen.getByPlaceholderText("Table password");
  fireEvent.change(input, { target: { value: "corrected-password" } });
  return { ...view, props, input, onAuthenticate };
}

describe("password correction while the rejected socket is closing", () => {
  it("keeps the reason and editable correction but does not offer submission on the rejected connection", () => {
    const h = setup();
    expect(screen.getByText("Invalid table password")).toBeVisible();
    expect(h.input).toBeEnabled();
    expect(h.input).toHaveValue("corrected-password");
    expect(screen.getByRole("button", { name: "Enter Table" })).toBeDisabled();
    expect(h.onAuthenticate).not.toHaveBeenCalled();
  });

  it("also guards the form handler when a submission bypasses the disabled button", () => {
    const h = setup();
    fireEvent.submit(h.input.closest("form")!);
    expect(h.onAuthenticate).not.toHaveBeenCalled();
  });

  it("keeps the correction through reset and permits exactly one submission after reconnect", () => {
    const h = setup();
    h.rerender(
      <AuthenticationGate
        {...h.props}
        isConnected={false}
        authState={AuthState.UNAUTHENTICATED}
        connectionState={ConnectionState.RECONNECTING}
      />,
    );
    expect(h.input).toHaveValue("corrected-password");
    expect(screen.getByRole("button", { name: "Connecting..." })).toBeDisabled();
    expect(screen.getByText("Invalid table password")).toBeVisible();
    h.rerender(<AuthenticationGate {...h.props} authState={AuthState.UNAUTHENTICATED} />);
    const enter = screen.getByRole("button", { name: "Enter Table" });
    expect(enter).toBeEnabled();
    fireEvent.click(enter);
    expect(h.onAuthenticate).toHaveBeenCalledExactlyOnceWith("corrected-password");
  });
});
