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
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthenticationGate } from "../AuthenticationGate";
import { AuthState, ConnectionState } from "../../../services/websocket";

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
      expect(screen.getByText("Join Your Room")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Room password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /enter room/i })).toBeInTheDocument();

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
      expect(screen.queryByText("Join Your Room")).not.toBeInTheDocument();
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

      const passwordInput = screen.getByPlaceholderText("Room password");
      const submitButton = screen.getByRole("button", { name: /enter room/i });

      fireEvent.change(passwordInput, { target: { value: "test-password" } });
      fireEvent.click(submitButton);

      expect(mockAuthenticate).toHaveBeenCalledWith("test-password");
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

      const passwordInput = screen.getByPlaceholderText("Room password");
      const submitButton = screen.getByRole("button", { name: /enter room/i });

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

      const submitButton = screen.getByRole("button", { name: /enter room/i });

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

      const passwordInput = screen.getByPlaceholderText("Room password");
      const submitButton = screen.getByRole("button", { name: /enter room/i });

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

      const passwordInput = screen.getByPlaceholderText("Room password") as HTMLInputElement;
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

      const passwordInput = screen.getByPlaceholderText("Room password");
      const submitButton = screen.getByRole("button", { name: /enter room/i });

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
      expect(screen.getByText("Join Your Room")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });
});
