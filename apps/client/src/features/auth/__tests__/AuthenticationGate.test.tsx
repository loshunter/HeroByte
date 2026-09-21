/**
 * Characterization tests for AuthenticationGate
 *
 * These tests capture the behavior of the authentication gating logic
 * BEFORE extraction from App.tsx. They serve as regression tests during
 * and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 53-267, 283-406)
 * Target: apps/client/src/features/auth/AuthenticationGate.tsx
 *
 * @module features/auth/__tests__/AuthenticationGate
 */

import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthenticationGate } from "../AuthenticationGate";
import { AuthState, ConnectionState } from "../../../services/websocket";
import { startFreshSession } from "../freshSession";

vi.mock("../freshSession", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../freshSession")>()),
  startFreshSession: vi.fn(),
}));

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe("AuthenticationGate - Characterization", () => {
  beforeEach(() => {
    // Reset sessionStorage mock before each test
    mockSessionStorage.clear();
    Object.defineProperty(window, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("unauthenticated state", () => {
    it("should render auth form when not authenticated", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.DISCONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Should show auth form
      expect(screen.getByText("Join Your Table")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Table password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /enter table/i })).toBeInTheDocument();

      // Should NOT show protected content
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("should display connection status in auth form", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.DISCONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      expect(screen.getByText("Disconnected")).toBeInTheDocument();

      // Update connection state
      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.CONNECTING}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      expect(screen.getByText("Connecting")).toBeInTheDocument();
    });

    it("should show the gate with RECLAIM THIS TAB when a logged-in tab is REPLACED", () => {
      // Found live: a replaced tab that had already logged in kept rendering
      // the app with an OFFLINE chip and a "Reconnecting…" banner that could
      // never resolve (REPLACED is terminal). The reclaim affordance lives in
      // the gate, so the gate must show.
      const onConnect = vi.fn();
      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={vi.fn()}
          onConnect={onConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.AUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );
      expect(screen.getByText("Protected Content")).toBeInTheDocument();

      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={vi.fn()}
          onConnect={onConnect}
          isConnected={false}
          connectionState={ConnectionState.REPLACED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.queryByText("Reconnecting…")).not.toBeInTheDocument();
      expect(screen.getByText("Opened in another tab")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Reclaim This Tab" }));
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("should explain a session CONFLICT and offer a manual retry, even after a prior login", () => {
      // The server turned this socket away (another window holds the session
      // and this one could not prove it is the same one). Nothing reconnects
      // by itself, so the gate — not the "Reconnecting…" banner — must show.
      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={vi.fn()}
          onConnect={vi.fn()}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.AUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );
      expect(screen.getByText("Protected Content")).toBeInTheDocument();

      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={vi.fn()}
          onConnect={vi.fn()}
          isConnected={false}
          connectionState={ConnectionState.CONFLICT}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByText("Held in another window")).toBeInTheDocument();
      expect(
        screen.getByText(/This table is still connected as you elsewhere/),
      ).toBeInTheDocument();
      // The copy's one number is the server's SESSION_TOKEN_GRACE_MS, read from
      // its source so the two cannot drift apart silently; its one promise is
      // that retrying does not shorten the hold. Both pinned, so the sentence
      // can drift back neither to "wait a moment" nor to "retrying is futile"
      // (a retry from the same browser DOES take the seat back — the store
      // hands it the newest token).
      const graceSource = readFileSync(
        path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../../../../server/src/ws/auth/SessionTokenService.ts",
        ),
        "utf8",
      );
      const graceHours = Number(
        graceSource.match(/SESSION_TOKEN_GRACE_MS = (\d+) \* 60 \* 60 \* 1000/)?.[1],
      );
      expect(graceHours, "the grace window moved — update the auth gate's copy").toBe(6);
      expect(screen.getByText(/up to six hours/)).toBeInTheDocument();
      expect(screen.getByText(/more retries will not shorten/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    });

    it("offers a fresh session on CONFLICT only after a retry, and acts only on a confirmed click", () => {
      // A browser that lost its session key has no other way in for the whole
      // grace window. The action is irreversible for the old seat, so it sits
      // behind a confirm that names the cost; a cancel does nothing. And a
      // CONFLICT right after a deploy self-heals on the first retry, so the
      // button is offered only once a retry in this conflict has failed.
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      vi.mocked(startFreshSession).mockClear();
      const onConnect = vi.fn();
      const gate = (state: ConnectionState, auth: AuthState = AuthState.UNAUTHENTICATED) => (
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={vi.fn()}
          onConnect={onConnect}
          isConnected={state === ConnectionState.CONNECTED}
          connectionState={state}
          authState={auth}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>
      );
      const { rerender } = render(gate(ConnectionState.CONFLICT));

      expect(
        screen.queryByRole("button", { name: "Start a Fresh Session" }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
      expect(onConnect).toHaveBeenCalledTimes(1);
      // A real retry opens a socket and authenticates before the server
      // refuses again: the count must survive that hop (the browser found it
      // did not, when the effect reset on every non-CONFLICT state).
      rerender(gate(ConnectionState.CONNECTING));
      rerender(gate(ConnectionState.CONNECTED, AuthState.PENDING));
      rerender(gate(ConnectionState.CONFLICT));
      expect(screen.getByRole("button", { name: "Start a Fresh Session" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Start a Fresh Session" }));
      expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/cannot be undone/));
      expect(startFreshSession).not.toHaveBeenCalled();

      confirm.mockReturnValue(true);
      fireEvent.click(screen.getByRole("button", { name: "Start a Fresh Session" }));
      expect(startFreshSession).toHaveBeenCalledTimes(1);

      // REPLACED has its own way back (Reclaim), and a plain disconnect
      // reconnects by itself: neither offers a new identity — and leaving
      // CONFLICT forgets the retry, so the next conflict starts over.
      rerender(gate(ConnectionState.REPLACED));
      expect(
        screen.queryByRole("button", { name: "Start a Fresh Session" }),
      ).not.toBeInTheDocument();
      rerender(gate(ConnectionState.DISCONNECTED));
      expect(
        screen.queryByRole("button", { name: "Start a Fresh Session" }),
      ).not.toBeInTheDocument();
      rerender(gate(ConnectionState.CONFLICT));
      expect(
        screen.queryByRole("button", { name: "Start a Fresh Session" }),
      ).not.toBeInTheDocument();
      // Getting in ends the episode too: the next conflict starts from zero.
      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
      rerender(gate(ConnectionState.CONNECTED, AuthState.AUTHENTICATED));
      rerender(gate(ConnectionState.CONFLICT));
      expect(
        screen.queryByRole("button", { name: "Start a Fresh Session" }),
      ).not.toBeInTheDocument();
    });

    it("counts a retry made with Enter Table (or Enter) exactly like Try Again", () => {
      // The first version counted only the Try Again click; a user retrying
      // with the gold button above it could never reach the fresh-session
      // button, and spent a non-refunded auth token on every attempt.
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const onConnect = vi.fn();
      const gate = (state: ConnectionState, auth: AuthState = AuthState.UNAUTHENTICATED) => (
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={vi.fn()}
          onConnect={onConnect}
          isConnected={state === ConnectionState.CONNECTED}
          connectionState={state}
          authState={auth}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>
      );
      const { rerender } = render(gate(ConnectionState.CONFLICT));

      fireEvent.change(screen.getByPlaceholderText("Table password"), {
        target: { value: "Fun1" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Enter Table" }));
      expect(onConnect).toHaveBeenCalledTimes(1);
      rerender(gate(ConnectionState.CONNECTING));
      rerender(gate(ConnectionState.CONNECTED, AuthState.PENDING));
      rerender(gate(ConnectionState.CONFLICT));

      expect(screen.getByRole("button", { name: "Start a Fresh Session" })).toBeInTheDocument();

      // A rejected password does NOT end the episode: the per-IP budget refusal
      // arrives as the same auth-failed, and hiding the way out from the user
      // who just drained the budget would be the wrong lesson.
      rerender(gate(ConnectionState.CONNECTED, AuthState.FAILED));
      rerender(gate(ConnectionState.CONFLICT));
      expect(screen.getByRole("button", { name: "Start a Fresh Session" })).toBeInTheDocument();
    });

    it("should display auth error when present", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.FAILED}
          authError="Invalid password"
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      expect(screen.getByText("Invalid password")).toBeInTheDocument();
    });

    it("should show retry button when not connected", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.FAILED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const retryButton = screen.getByRole("button", { name: /retry connection/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("authenticated state", () => {
    it("should render children when authenticated", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.AUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Should show protected content
      expect(screen.getByText("Protected Content")).toBeInTheDocument();

      // Should NOT show auth form
      expect(screen.queryByText("Join Your Table")).not.toBeInTheDocument();
    });

    it("should show re-authentication banner when disconnected after authentication", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.AUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Initially authenticated - no banner
      expect(screen.queryByText(/re-authenticating/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();

      // Simulate disconnection
      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.RECONNECTING}
          authState={AuthState.PENDING}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Should show re-authentication banner
      expect(screen.getByText(/re-authenticating/i)).toBeInTheDocument();
    });
  });

  describe("password submission flow", () => {
    it("should handle password submission when connected", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const passwordInput = screen.getByPlaceholderText("Table password");
      const submitButton = screen.getByRole("button", { name: /enter table/i });

      fireEvent.change(passwordInput, { target: { value: "test-password" } });
      fireEvent.click(submitButton);

      expect(mockAuthenticate).toHaveBeenCalledWith("test-password");
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("should connect first if not connected when submitting password", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.DISCONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const passwordInput = screen.getByPlaceholderText("Table password");
      const submitButton = screen.getByRole("button", { name: /enter table/i });

      fireEvent.change(passwordInput, { target: { value: "test-password" } });
      fireEvent.click(submitButton);

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockAuthenticate).not.toHaveBeenCalled();
    });

    it("should not submit empty password", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const submitButton = screen.getByRole("button", { name: /enter table/i });

      fireEvent.click(submitButton);

      expect(mockAuthenticate).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("should trim whitespace from password", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const passwordInput = screen.getByPlaceholderText("Table password");
      const submitButton = screen.getByRole("button", { name: /enter table/i });

      fireEvent.change(passwordInput, { target: { value: "  test-password  " } });
      fireEvent.click(submitButton);

      expect(mockAuthenticate).toHaveBeenCalledWith("test-password");
    });

    it("should disable submit button during authentication", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.PENDING}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const submitButton = screen.getByRole("button", { name: /authenticating/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("session storage integration", () => {
    it("should load initial secret from sessionStorage", () => {
      mockSessionStorage.setItem("herobyte-room-secret", "stored-password");

      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.DISCONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const passwordInput = screen.getByPlaceholderText("Table password") as HTMLInputElement;
      expect(passwordInput.value).toBe("stored-password");
    });

    it("should persist secret to sessionStorage on successful authentication", async () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      const passwordInput = screen.getByPlaceholderText("Table password");
      const submitButton = screen.getByRole("button", { name: /enter table/i });

      fireEvent.change(passwordInput, { target: { value: "test-password" } });
      fireEvent.click(submitButton);

      // Simulate successful authentication
      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.AUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      await waitFor(() => {
        expect(mockSessionStorage.getItem("herobyte-room-secret")).toBe("test-password");
      });
    });

    it("should clear sessionStorage on authentication failure", async () => {
      mockSessionStorage.setItem("herobyte-room-secret", "wrong-password");

      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Simulate failed authentication
      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.FAILED}
          authError="Invalid password"
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      await waitFor(() => {
        expect(mockSessionStorage.getItem("herobyte-room-secret")).toBeNull();
      });
    });
  });

  describe("auto-authentication with stored secret", () => {
    it("should auto-authenticate when connected with stored secret", async () => {
      mockSessionStorage.setItem("herobyte-room-secret", "stored-password");

      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={false}
          connectionState={ConnectionState.DISCONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Initially not connected, should not authenticate yet
      expect(mockAuthenticate).not.toHaveBeenCalled();

      // Simulate connection
      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.UNAUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Should auto-authenticate with stored secret
      await waitFor(() => {
        expect(mockAuthenticate).toHaveBeenCalledWith("stored-password");
      });
    });

    it("should not auto-authenticate if already authenticated", () => {
      mockSessionStorage.setItem("herobyte-room-secret", "stored-password");

      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.AUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      expect(mockAuthenticate).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle sessionStorage access errors gracefully", () => {
      // Mock sessionStorage to throw error
      Object.defineProperty(window, "sessionStorage", {
        get: () => {
          throw new Error("Storage access denied");
        },
        configurable: true,
      });

      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      // Should not crash
      expect(() => {
        render(
          <AuthenticationGate
            url="ws://test"
            uid="test-uid"
            onAuthenticate={mockAuthenticate}
            onConnect={mockConnect}
            isConnected={false}
            connectionState={ConnectionState.DISCONNECTED}
            authState={AuthState.UNAUTHENTICATED}
            authError={null}
          >
            <div>Protected Content</div>
          </AuthenticationGate>,
        );
      }).not.toThrow();
    });

    it("should return to auth form on auth failure", () => {
      const mockAuthenticate = vi.fn();
      const mockConnect = vi.fn();

      const { rerender } = render(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.AUTHENTICATED}
          authError={null}
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Initially shows protected content
      expect(screen.getByText("Protected Content")).toBeInTheDocument();

      // Simulate auth failure
      rerender(
        <AuthenticationGate
          url="ws://test"
          uid="test-uid"
          onAuthenticate={mockAuthenticate}
          onConnect={mockConnect}
          isConnected={true}
          connectionState={ConnectionState.CONNECTED}
          authState={AuthState.FAILED}
          authError="Session expired"
        >
          <div>Protected Content</div>
        </AuthenticationGate>,
      );

      // Should show auth form again
      expect(screen.getByText("Join Your Table")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });
});
